/**
 * Step 1: Best Shot Selection
 * Uses OpenAI Vision (gpt-4o) to score photos on composition,
 * brightness, and emotional impact. Returns top 10 photo paths.
 */

const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { OpenAI } = require('openai');

const MAX_PHOTOS_TO_ANALYZE = 30;

/**
 * Retry an async function with exponential backoff.
 * Retries on rate-limit (429) and transient server (5xx) errors.
 * @param {Function} fn
 * @param {number} maxAttempts
 * @returns {Promise<*>}
 */
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retryable || attempt === maxAttempts) throw err;
      const delayMs = 1000 * Math.pow(2, attempt - 1);
      process.stderr.write(`      [재시도 ${attempt}/${maxAttempts - 1}] ${err.message} — ${delayMs / 1000}s 후 재시도\n`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

/**
 * Resize image to a smaller size for API efficiency and encode as base64.
 * @param {string} filePath
 * @returns {Promise<string>} base64 encoded JPEG
 */
async function encodeImageForVision(filePath) {
  const resized = await sharp(filePath)
    .resize({ width: 512, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return resized.toString('base64');
}

/**
 * Score a single photo using GPT-4o Vision.
 * Returns a score 1–10, or 5 as fallback if the model refuses or gives unexpected output.
 * @param {OpenAI} openai
 * @param {{filePath: string, base64: string}} item
 * @returns {Promise<{filePath: string, score: number}>}
 */
async function scoreOne(openai, item) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Rate this photo from 1 to 10 based on composition, brightness, clarity, and emotional appeal. Reply with a single integer only.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${item.base64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: 10,
    });

    const raw = response.choices[0].message.content.trim();
    const num = parseFloat(raw.match(/\d+(\.\d+)?/)?.[0] ?? '5');
    return { filePath: item.filePath, score: isNaN(num) ? 5 : Math.min(10, Math.max(1, num)) };
  } catch {
    // On any API error, assign neutral score and continue
    return { filePath: item.filePath, score: 5 };
  }
}

/**
 * Score a batch of photos using GPT-4o Vision (one call per photo).
 * @param {OpenAI} openai
 * @param {Array<{filePath: string, base64: string}>} batch
 * @returns {Promise<Array<{filePath: string, score: number}>>}
 */
async function scoreBatch(openai, batch) {
  return Promise.all(batch.map(item => withRetry(() => scoreOne(openai, item))));
}

/**
 * Select the top N best shots from a photos directory.
 * @param {string} photosDir - Path to directory containing photos
 * @param {number} targetCount - How many top shots to return (default 10)
 * @returns {Promise<{topShots: string[], estimatedCost: string}>}
 */
async function selectBestShots(photosDir, targetCount = 10) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const allFiles = (await fs.readdir(photosDir))
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .map(f => path.join(photosDir, f));

  if (allFiles.length === 0) {
    throw new Error(`No photos found in ${photosDir}`);
  }

  // Cap at MAX_PHOTOS_TO_ANALYZE to control API cost
  const filesToAnalyze = allFiles.slice(0, MAX_PHOTOS_TO_ANALYZE);
  const totalPhotos = filesToAnalyze.length;

  process.stdout.write(`      (${totalPhotos}장 분석 중)\n`);

  // Encode images (in parallel, batches of 5 to avoid memory spikes)
  const ENCODE_BATCH = 5;
  const encoded = [];
  for (let i = 0; i < filesToAnalyze.length; i += ENCODE_BATCH) {
    const chunk = filesToAnalyze.slice(i, i + ENCODE_BATCH);
    const results = await Promise.all(
      chunk.map(async fp => ({
        filePath: fp,
        base64: await encodeImageForVision(fp),
      }))
    );
    encoded.push(...results);
  }

  // Score in batches of 5 (Vision API handles multiple images per call)
  const SCORE_BATCH = 5;
  let allScored = [];
  for (let i = 0; i < encoded.length; i += SCORE_BATCH) {
    const batch = encoded.slice(i, i + SCORE_BATCH);
    const scored = await withRetry(() => scoreBatch(openai, batch));
    allScored.push(...scored);
  }

  // Sort descending by score and take top N (clamped to available photos)
  allScored.sort((a, b) => b.score - a.score);
  const topShots = allScored.slice(0, Math.min(targetCount, allScored.length)).map(s => s.filePath);

  // Rough cost estimate: gpt-4o low-detail image = ~$0.00425 per image
  const estimatedCost = `~$${(totalPhotos * 0.00425).toFixed(2)}`;

  return { topShots, estimatedCost };
}

module.exports = { selectBestShots };
