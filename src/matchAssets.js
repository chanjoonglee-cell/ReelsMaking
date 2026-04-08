/**
 * Step 3: Asset Matching
 * Maps a mood to a BGM file path and ffmpeg filter parameters.
 */

const path = require('path');

/**
 * Mood → asset configuration table.
 *
 * slideDuration: seconds each photo is displayed (before crossfade overlap).
 * targetPhotoCount: number of best shots to select so total video ≈ 25–35s.
 *   Formula: total = n * slideDuration - (n-1) * 0.8 (crossfade)
 *   warm/calm  (3s): n=14 → 14*3 - 13*0.8 = 31.6s
 *   energetic  (2s): n=20 → 20*2 - 19*0.8 = 24.8s
 *   melancholic(4s): n=10 → 10*4 -  9*0.8 = 32.8s
 * ffmpegFilter: vf filter string applied to each photo.
 */
const MOOD_ASSETS = {
  warm: {
    bgmFile: 'warm.mp3',
    slideDuration: 3,
    targetPhotoCount: 14,
    // Warm yellow tones, soft vignette
    ffmpegFilter:
      'colorbalance=rs=0.1:gs=0.05:bs=-0.05,' +
      'curves=r=\'0/0 0.5/0.6 1/1\':g=\'0/0 0.5/0.55 1/1\',' +
      'vignette=PI/6',
    description: 'warm yellow tones, soft vignette',
  },
  calm: {
    bgmFile: 'calm.mp3',
    slideDuration: 3,
    targetPhotoCount: 14,
    // Cool blue-green tones
    ffmpegFilter:
      'colorbalance=rs=-0.05:gs=0.05:bs=0.1,' +
      'curves=b=\'0/0 0.5/0.6 1/1\'',
    description: 'cool blue-green tones',
  },
  energetic: {
    bgmFile: 'energetic.mp3',
    slideDuration: 2,
    targetPhotoCount: 20,
    // High contrast, saturated
    ffmpegFilter:
      'eq=contrast=1.3:saturation=1.5:brightness=0.05',
    description: 'high contrast, saturated',
  },
  melancholic: {
    bgmFile: 'melancholic.mp3',
    slideDuration: 4,
    targetPhotoCount: 10,
    // Desaturated, heavy vignette
    ffmpegFilter:
      'eq=saturation=0.4:contrast=0.9,' +
      'vignette=PI/4',
    description: 'desaturated, heavy vignette',
  },
};

/**
 * Match a mood to its BGM and ffmpeg filter configuration.
 * @param {string} mood - One of: warm | calm | energetic | melancholic
 * @param {string} assetsDir - Path to the assets directory
 * @returns {{ bgmPath: string, slideDuration: number, targetPhotoCount: number, ffmpegFilter: string, description: string }}
 */
function matchAssets(mood, assetsDir) {
  const config = MOOD_ASSETS[mood];
  if (!config) {
    throw new Error(`Unknown mood: "${mood}". Must be one of: ${Object.keys(MOOD_ASSETS).join(', ')}`);
  }

  return {
    bgmPath: path.join(assetsDir, 'bgm', config.bgmFile),
    slideDuration: config.slideDuration,
    targetPhotoCount: config.targetPhotoCount,
    ffmpegFilter: config.ffmpegFilter,
    description: config.description,
  };
}

module.exports = { matchAssets };
