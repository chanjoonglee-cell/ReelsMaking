/**
 * Web Server — Reels Generator
 * Express + multer + SSE 기반 웹 인터페이스
 *
 * 실행: node src/server.js  (또는 npm run server)
 * 접속: http://localhost:3000
 *
 * API:
 *   POST /api/generate         → 사진 + 일기 업로드 → { jobId }
 *   GET  /api/progress/:jobId  → SSE 진행률 스트리밍
 *   GET  /api/download/:jobId  → 완성된 MP4 다운로드
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const { analyzeMood } = require('./analyzeMood');
const { matchAssets } = require('./matchAssets');
const { selectBestShots } = require('./selectBestShots');
const { generateVideo } = require('./generateVideo');

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ASSETS_DIR = path.join(ROOT, 'assets');
const JOBS_DIR = path.join(ROOT, 'jobs');
const TMP_DIR = path.join(ROOT, 'tmp');

const PORT = process.env.PORT || 3000;
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour before auto-cleanup

// ── Job store (in-memory) ──────────────────────────────────────────────────
// { jobId → { status, events[], listeners[], photosDir, diaries[], outputPath, error } }
const jobs = new Map();

// ── Express setup ──────────────────────────────────────────────────────────
const app = express();
app.use(express.static(PUBLIC_DIR));

// ── Multer: temp disk storage ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: TMP_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB per file
    files: 60,                   // max 60 photos
  },
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|webp)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식: ${file.originalname} (JPG/PNG/WEBP만 허용)`));
    }
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse raw diary text into structured diary array.
 * Splits on blank lines; each paragraph = one diary entry.
 */
function parseDiaryText(text) {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length >= 15)
    .map((entryText, i, arr) => ({
      date: new Date(Date.now() - (arr.length - 1 - i) * 86400000)
        .toISOString()
        .split('T')[0],
      text: entryText,
      photoFile: '',
    }));
}

/** Send an SSE event to all active listeners of a job and store it for replay. */
function emit(job, data) {
  job.events.push(data);
  for (const res of job.listeners) {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  }
}

/** Remove a response from the listener list. */
function unsubscribe(job, res) {
  job.listeners = job.listeners.filter(l => l !== res);
}

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/generate
 * Body: multipart/form-data
 *   photos[]   — image files (min 20)
 *   diaryText  — plain text, entries separated by blank lines (min 7)
 */
app.post('/api/generate', (req, res, next) => {
  upload.array('photos', 60)(req, res, err => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `업로드 오류: ${err.message}` });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const tmpFiles = (req.files || []).map(f => f.path);

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('서버에 OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }

    const photos = req.files || [];
    const diaryText = (req.body.diaryText || '').trim();
    const errors = [];

    if (photos.length < 20) {
      errors.push(`사진 ${photos.length}장 업로드됨 → 최소 20장 필요`);
    }

    const diaries = parseDiaryText(diaryText);
    if (diaries.length < 7) {
      errors.push(`일기 ${diaries.length}개 항목 감지 → 최소 7개 필요 (빈 줄로 구분)`);
    }

    if (errors.length > 0) {
      for (const f of tmpFiles) await fs.remove(f).catch(() => {});
      return res.status(400).json({ error: errors.join(' | ') });
    }

    // Create job directory and move uploaded files there
    const jobId = uuidv4();
    const photosDir = path.join(JOBS_DIR, jobId, 'photos');
    await fs.ensureDir(photosDir);

    for (const file of photos) {
      await fs.move(file.path, path.join(photosDir, file.filename));
    }

    const job = {
      id: jobId,
      status: 'pending',
      events: [],
      listeners: [],
      photosDir,
      diaries,
      outputPath: null,
      error: null,
      createdAt: Date.now(),
    };
    jobs.set(jobId, job);

    res.json({ jobId });

    // Run pipeline async (don't await — respond first)
    runJob(jobId);

    // Schedule auto-cleanup after TTL
    setTimeout(() => cleanupJob(jobId), JOB_TTL_MS);

  } catch (err) {
    for (const f of tmpFiles) await fs.remove(f).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/:jobId
 * Server-Sent Events stream.
 * Replays past events on connect so clients that join mid-processing catch up.
 */
app.get('/api/progress/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders();

  // Replay all past events so the client catches up
  for (const ev of job.events) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  // If job is already finished, close immediately
  if (job.status === 'done' || job.status === 'error') {
    return res.end();
  }

  // Subscribe to future events
  job.listeners.push(res);

  // Keep-alive comment every 20s to prevent proxy timeouts
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 20000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe(job, res);
  });
});

/**
 * GET /api/download/:jobId
 * Stream the completed MP4 as a file download.
 */
app.get('/api/download/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job || !job.outputPath) {
    return res.status(404).json({ error: '영상 준비되지 않음 또는 만료됨' });
  }
  if (!(await fs.pathExists(job.outputPath))) {
    return res.status(404).json({ error: '영상 파일을 찾을 수 없습니다 (만료되었을 수 있음)' });
  }

  const stat = await fs.stat(job.outputPath);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  res.setHeader('Content-Disposition', `attachment; filename="reels_${date}.mp4"`);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);

  fs.createReadStream(job.outputPath).pipe(res);
});

// ── Job runner ─────────────────────────────────────────────────────────────

async function runJob(jobId) {
  const job = jobs.get(jobId);
  const send = data => emit(job, data);

  try {
    job.status = 'running';

    // ── Step 1: Mood analysis ────────────────────────────────────────────
    send({ type: 'step', step: 1, total: 4, label: '무드 분석 중... | Analyzing mood...', status: 'running' });
    const { mood, confidence, reasoning } = await analyzeMood(job.diaries);
    send({
      type: 'step', step: 1, total: 4, status: 'done', mood,
      label: `무드: ${mood} (신뢰도 ${confidence}%)${reasoning ? '  — ' + reasoning : ''}`,
    });

    // ── Step 2: Asset matching ────────────────────────────────────────────
    send({ type: 'step', step: 2, total: 4, label: 'BGM & 필터 매칭 중... | Matching assets...', status: 'running' });
    const { bgmPath, slideDuration, targetPhotoCount, ffmpegFilter, description } = matchAssets(mood, ASSETS_DIR);
    const bgmExists = await fs.pathExists(bgmPath);
    send({
      type: 'step', step: 2, total: 4, status: 'done',
      label: `필터: ${description}${bgmExists ? '' : ' (BGM 파일 없음 — 무음)'}`,
    });

    // ── Step 3: Best shot selection ───────────────────────────────────────
    send({
      type: 'step', step: 3, total: 4, status: 'running',
      label: `베스트컷 선정 중... | Selecting best shots (목표 ${targetPhotoCount}장)`,
    });
    const { topShots, estimatedCost } = await selectBestShots(job.photosDir, targetPhotoCount);
    const estDuration = (topShots.length * slideDuration - (topShots.length - 1) * 0.8).toFixed(1);
    send({
      type: 'step', step: 3, total: 4, status: 'done',
      label: `선정 완료: ${topShots.length}장 · ${estimatedCost} · 예상 ${estDuration}s`,
    });

    // ── Step 4: Video generation ──────────────────────────────────────────
    const outputPath = path.join(JOBS_DIR, jobId, 'reels.mp4');
    send({
      type: 'step', step: 4, total: 4, status: 'running',
      label: `영상 합성 중... | Generating video (~${estDuration}s)`,
    });

    await generateVideo({
      photos: topShots,
      diaries: job.diaries,
      bgmPath: bgmExists ? bgmPath : null,
      slideDuration,
      ffmpegFilter,
      outputPath,
      onProgress: pct => send({ type: 'progress', step: 4, pct }),
    });

    // ── Done ──────────────────────────────────────────────────────────────
    const stat = await fs.stat(outputPath);
    job.outputPath = outputPath;
    job.status = 'done';
    send({
      type: 'done',
      downloadUrl: `/api/download/${jobId}`,
      duration: estDuration,
      fileSizeMB: (stat.size / (1024 * 1024)).toFixed(1),
    });

  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    send({ type: 'error', message: err.message });
  }
}

async function cleanupJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  await fs.remove(path.join(JOBS_DIR, jobId)).catch(() => {});
  jobs.delete(jobId);
}

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  await fs.ensureDir(TMP_DIR);
  await fs.ensureDir(JOBS_DIR);
  await fs.ensureDir(PUBLIC_DIR);

  app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║    언어의숲 릴스 생성기 웹 서버              ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`  → http://localhost:${PORT}`);
    console.log('');
    if (!process.env.OPENAI_API_KEY) {
      console.warn('  ⚠️  OPENAI_API_KEY 미설정 — .env 파일을 확인하세요');
    }
  });
}

start();
