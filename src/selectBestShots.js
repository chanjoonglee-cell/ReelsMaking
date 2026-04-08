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
const TOP_SHOTS_COUNT = 10;

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
 * Score a batch of photos using GPT-4o Vision in a single API call.
 * @param {OpenAI} openai
 * @param {Array<{filePath: string, base64: string}>} batch
 * @returns {Promise<Array<{filePath: string, score: number}>>}
 */
async function scoreBatch(openai, batch) {
  const content = [
    {
      type: 'text',
      text: `You are a photo scoring AI. Score each of the ${batch.length} photos below from 1–10 based on:
- Composition (rule of thirds, balance, framing)
- Brightness & exposure (well-lit, not over/underexposed)
- Emotional impact (warmth, authenticity, storytelling quality)
- Sharpness & clarity

Respond with ONLY a JSON array of numbers, one score per photo, in order.
Example for 3 photos: [7, 9, 5]`,
    },
  ];

  for (let i = 0; i < batch.length; i++) {
    content.push({
      type: 'text',
      text: `Photo ${i + 1}:`,
    });
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${batch[i].base64}`,
        detail: 'low',
      },
    });
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    max_tokens: 100,
  });

  const raw = response.choices[0].message.content.trim();
  const match = raw.match(/\[[\d,\s.]+\]/);
  if (!match) {
    throw new Error(`Unexpected Vision API response: ${raw}`);
  }
  const scores = JSON.parse(match[0]);

  return batch.map((item, i) => ({
    filePath: item.filePath,
    score: scores[i] ?? 5,
  }));
}

/**
 * Select the top N best shots from a photos directory.
 * @param {string} photosDir - Path to directory containing photos
 * @returns {Promise<{topShots: string[], estimatedCost: string}>}
 */
async function selectBestShots(photosDir) {
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
    const scored = await scoreBatch(openai, batch);
    allScored.push(...scored);
  }

  // Sort descending by score and take top N
  allScored.sort((a, b) => b.score - a.score);
  const topShots = allScored.slice(0, TOP_SHOTS_COUNT).map(s => s.filePath);

  // Rough cost estimate: gpt-4o low-detail image = ~$0.00425 per image
  const estimatedCost = `~$${(totalPhotos * 0.00425).toFixed(2)}`;

  return { topShots, estimatedCost };
}

module.exports = { selectBestShots };
