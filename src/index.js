/**
 * CLI Entry Point — Reels Generator
 * 언어의숲 (Eoneoeuisup) AI Memory Reels
 *
 * Usage: node src/index.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');

const { selectBestShots } = require('./selectBestShots');
const { analyzeMood } = require('./analyzeMood');
const { matchAssets } = require('./matchAssets');
const { generateVideo } = require('./generateVideo');

// ── Constants ──────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'input');
const PHOTOS_DIR = path.join(INPUT_DIR, 'photos');
const DIARIES_FILE = path.join(INPUT_DIR, 'diaries.json');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUTPUT_DIR = path.join(ROOT, 'output');

const MIN_DIARIES = 7;
const MIN_PHOTOS = 20;

// ── Helpers ────────────────────────────────────────────────────────────────
function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '_' +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function log(step, total, msg) {
  console.log(`\n[${step}/${total}] ${msg}`);
}

function indent(msg) {
  console.log(`      ${msg}`);
}

function elapsed(startMs) {
  const sec = Math.round((Date.now() - startMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

// ── Validation ─────────────────────────────────────────────────────────────
async function validateInputs() {
  // Check OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('.env 파일에 OPENAI_API_KEY가 설정되지 않았습니다.\nSet OPENAI_API_KEY in your .env file.');
  }

  // Check diaries.json
  if (!(await fs.pathExists(DIARIES_FILE))) {
    throw new Error(`input/diaries.json 파일이 없습니다. | ${DIARIES_FILE} not found.`);
  }
  const diaries = await fs.readJson(DIARIES_FILE);
  if (!Array.isArray(diaries) || diaries.length < MIN_DIARIES) {
    throw new Error(
      `일기가 ${diaries.length}개 입니다. 최소 ${MIN_DIARIES}개 이상 필요합니다.\n` +
      `Found ${diaries.length} diaries. Minimum ${MIN_DIARIES} required.`
    );
  }

  // Check photos
  if (!(await fs.pathExists(PHOTOS_DIR))) {
    throw new Error(`input/photos/ 폴더가 없습니다. | ${PHOTOS_DIR} not found.`);
  }
  const photoFiles = (await fs.readdir(PHOTOS_DIR)).filter(f =>
    /\.(jpe?g|png|webp)$/i.test(f)
  );
  if (photoFiles.length < MIN_PHOTOS) {
    throw new Error(
      `사진이 ${photoFiles.length}장 입니다. 최소 ${MIN_PHOTOS}장 이상 필요합니다.\n` +
      `Found ${photoFiles.length} photos. Minimum ${MIN_PHOTOS} required.`
    );
  }

  return { diaries, photoCount: photoFiles.length };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  const TOTAL_STEPS = 5;

  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║    언어의숲 릴스 생성기 | Reels Generator    ║');
  console.log('╚════════════════════════════════════════════╝');

  // ── Step 1: Validate inputs ──────────────────────────────────────────────
  log(1, TOTAL_STEPS, '데이터 확인 중... | Checking input data...');
  const { diaries, photoCount } = await validateInputs();
  indent(`일기 ${diaries.length}개, 사진 ${photoCount}장 확인됨 | Found ${diaries.length} diaries, ${photoCount} photos`);

  // ── Step 2: Mood analysis ────────────────────────────────────────────────
  log(2, TOTAL_STEPS, '무드 분석 중... | Analyzing mood...');
  const { mood, confidence, reasoning } = await analyzeMood(diaries);
  indent(`결과: ${mood} (신뢰도 ${confidence}%) | Result: ${mood} (confidence ${confidence}%)`);
  if (reasoning) indent(`근거: ${reasoning}`);

  // ── Step 3: Best shots ───────────────────────────────────────────────────
  log(3, TOTAL_STEPS, `베스트컷 선정 중... | Selecting best shots...`);
  const { topShots, estimatedCost } = await selectBestShots(PHOTOS_DIR);
  indent(`선정 완료: ${topShots.length}장 | Selected: ${topShots.length} photos`);
  indent(`예상 API 비용: ${estimatedCost}`);

  // ── Step 4: Match assets ─────────────────────────────────────────────────
  log(4, TOTAL_STEPS, 'BGM & 필터 매칭 중... | Matching BGM & filter...');
  const { bgmPath, slideDuration, ffmpegFilter, description } = matchAssets(mood, ASSETS_DIR);

  const bgmExists = await fs.pathExists(bgmPath);
  if (!bgmExists) {
    console.warn(`      [경고] BGM 파일 없음 — 무음으로 진행합니다: ${bgmPath}`);
    console.warn(`      [Warning] BGM file not found — proceeding without audio: ${bgmPath}`);
  }
  indent(`BGM: ${bgmPath}`);
  indent(`필터: ${description}`);

  // ── Step 5: Generate video ───────────────────────────────────────────────
  log(5, TOTAL_STEPS, '영상 합성 중... | Generating video...');
  await fs.ensureDir(OUTPUT_DIR);
  const outputFileName = `reels_${timestamp()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  let lastReported = -1;
  await generateVideo({
    photos: topShots,
    diaries,
    bgmPath: bgmExists ? bgmPath : null,
    slideDuration,
    ffmpegFilter,
    outputPath,
    onProgress: pct => {
      // Report every 10%
      const bucket = Math.floor(pct / 10) * 10;
      if (bucket > lastReported) {
        lastReported = bucket;
        process.stdout.write(`      Processing... ${pct}%\r`);
        if (pct >= 100) process.stdout.write('\n');
      }
    },
  });

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log('완료! | Done!');
  indent(`영상 저장됨: output/${outputFileName}`);
  indent(`총 소요 시간: ${elapsed(startTime)}`);
  console.log('');
}

main().catch(err => {
  console.error('\n[오류 | Error]', err.message);
  process.exit(1);
});
