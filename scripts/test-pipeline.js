/**
 * Test Pipeline Script
 * ────────────────────
 * OpenAI API 없이 ffmpeg 파이프라인 전체를 검증합니다.
 * Tests the full ffmpeg video pipeline without any OpenAI API calls.
 *
 * 사용법 | Usage:
 *   node scripts/test-pipeline.js [--mood warm|calm|energetic|melancholic]
 *
 * 동작:
 * 1. sharp로 20장의 합성 테스트 사진 생성 (컬러 그라디언트)
 * 2. 무드를 --mood 플래그로 직접 지정 (기본값: warm)
 * 3. 에셋 매칭 (실제 로직 사용)
 * 4. ffmpeg 영상 합성 실행 → output/test_reels_<timestamp>.mp4
 *
 * Requirements: ffmpeg must be installed. No .env or API key needed.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');

const { matchAssets } = require('../src/matchAssets');
const { generateVideo } = require('../src/generateVideo');

const ROOT = path.resolve(__dirname, '..');
const TMP_PHOTOS_DIR = path.join(ROOT, 'output', 'test_photos_tmp');
const OUTPUT_DIR = path.join(ROOT, 'output');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DIARIES_FILE = path.join(ROOT, 'input', 'diaries.json');

const PHOTO_COUNT = 20;

// Parse --mood flag
function parseMood() {
  const idx = process.argv.indexOf('--mood');
  const valid = ['warm', 'calm', 'energetic', 'melancholic'];
  if (idx !== -1 && process.argv[idx + 1]) {
    const m = process.argv[idx + 1].toLowerCase();
    if (valid.includes(m)) return m;
    console.warn(`Unknown mood "${m}", defaulting to "warm"`);
  }
  return 'warm';
}

/**
 * Generate a synthetic gradient photo (1080×1920) for testing.
 * Each photo gets a unique hue so they look visually distinct.
 */
async function generateTestPhoto(outputPath, index, total) {
  const hue = Math.round((index / total) * 360);

  // Convert HSL to approximate RGB (simplified, assumes full saturation/lightness 0.5)
  const h = hue / 60;
  const i = Math.floor(h);
  const f = h - i;
  const vals = [
    [1, f, 0],
    [1 - f, 1, 0],
    [0, 1, f],
    [0, 1 - f, 1],
    [f, 0, 1],
    [1, 0, 1 - f],
  ];
  const [r, g, b] = vals[i % 6].map(v => Math.round(v * 200 + 30));

  // Create a 1080×1920 solid-color image with a lighter center spot
  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 3,
      background: { r, g, b },
    },
  })
    .jpeg({ quality: 85 })
    .toFile(outputPath);
}

function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '_' +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

function elapsed(startMs) {
  const sec = Math.round((Date.now() - startMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

async function main() {
  const startTime = Date.now();
  const mood = parseMood();

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  릴스 파이프라인 테스트 | Reels Pipeline Test     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  무드: ${mood}  |  사진: ${PHOTO_COUNT}장 (합성)  |  API 호출: 없음`);
  console.log('');

  // ── Step 1: Generate synthetic test photos ─────────────────────────────
  console.log('[1/4] 테스트 사진 생성 중... | Generating synthetic photos...');
  await fs.ensureDir(TMP_PHOTOS_DIR);

  const photos = [];
  for (let i = 0; i < PHOTO_COUNT; i++) {
    const filePath = path.join(TMP_PHOTOS_DIR, `test_${String(i).padStart(3, '0')}.jpg`);
    await generateTestPhoto(filePath, i, PHOTO_COUNT);
    photos.push(filePath);
    process.stdout.write(`      ${i + 1}/${PHOTO_COUNT}\r`);
  }
  process.stdout.write('\n');
  console.log(`      완료 | Done: ${PHOTO_COUNT}장 생성됨`);

  // ── Step 2: Match assets ───────────────────────────────────────────────
  console.log('\n[2/4] 에셋 매칭 중... | Matching assets...');
  const { bgmPath, slideDuration, targetPhotoCount, ffmpegFilter, description } = matchAssets(mood, ASSETS_DIR);

  const bgmExists = await fs.pathExists(bgmPath);
  console.log(`      무드: ${mood} | 슬라이드: ${slideDuration}s/장 | 필터: ${description}`);
  if (!bgmExists) {
    console.log(`      [경고] BGM 없음 — 무음으로 진행 | No BGM found — silent video`);
    console.log(`      BGM 경로: ${bgmPath}`);
  } else {
    console.log(`      BGM: ${path.basename(bgmPath)}`);
  }

  // Use targetPhotoCount photos (or fewer if not enough generated)
  const selectedPhotos = photos.slice(0, Math.min(targetPhotoCount, photos.length));
  const estimatedDuration = (selectedPhotos.length * slideDuration - (selectedPhotos.length - 1) * 0.8).toFixed(1);
  console.log(`      사진 ${selectedPhotos.length}장 사용 → 예상 길이 ~${estimatedDuration}s`);

  // ── Step 3: Load sample diaries ───────────────────────────────────────
  console.log('\n[3/4] 일기 데이터 로드... | Loading diary data...');
  let diaries;
  if (await fs.pathExists(DIARIES_FILE)) {
    diaries = await fs.readJson(DIARIES_FILE);
    console.log(`      input/diaries.json 사용 (${diaries.length}개)`);
  } else {
    // Fallback: minimal inline sample
    diaries = Array.from({ length: 7 }, (_, i) => ({
      date: `2025-03-0${i + 1}`,
      text: `Test diary entry ${i + 1}. Today was a wonderful day full of learning and joy.`,
      photoFile: `test_${i}.jpg`,
    }));
    console.log('      샘플 일기 사용 (input/diaries.json 없음)');
  }

  // ── Step 4: Generate video ─────────────────────────────────────────────
  console.log(`\n[4/4] 영상 합성 중... | Generating video... (~${estimatedDuration}s)`);
  await fs.ensureDir(OUTPUT_DIR);
  const outputFileName = `test_reels_${timestamp()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  let lastReported = -1;
  await generateVideo({
    photos: selectedPhotos,
    diaries,
    bgmPath: bgmExists ? bgmPath : null,
    slideDuration,
    ffmpegFilter,
    outputPath,
    onProgress: pct => {
      const bucket = Math.floor(pct / 10) * 10;
      if (bucket > lastReported) {
        lastReported = bucket;
        process.stdout.write(`      Processing... ${pct}%\r`);
        if (pct >= 100) process.stdout.write('\n');
      }
    },
  });

  // ── Cleanup ────────────────────────────────────────────────────────────
  await fs.remove(TMP_PHOTOS_DIR);

  // ── Done ──────────────────────────────────────────────────────────────
  console.log('');
  console.log('✓ 테스트 완료! | Test passed!');
  console.log(`  영상 저장됨: output/${outputFileName}`);
  console.log(`  총 소요 시간: ${elapsed(startTime)}`);
  console.log('');
  console.log('  다음 무드로도 테스트하려면:');
  console.log('  node scripts/test-pipeline.js --mood calm');
  console.log('  node scripts/test-pipeline.js --mood energetic');
  console.log('  node scripts/test-pipeline.js --mood melancholic');
  console.log('');
}

main().catch(err => {
  console.error('\n[오류 | Error]', err.message);
  // Cleanup temp photos on failure too
  fs.remove(TMP_PHOTOS_DIR).catch(() => {});
  process.exit(1);
});
