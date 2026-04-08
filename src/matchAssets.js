/**
 * Step 3: Asset Matching
 * Maps a mood to a BGM file path and ffmpeg filter parameters.
 */

const path = require('path');

/**
 * Mood → asset configuration table.
 * slideDuration: seconds each photo is displayed (before crossfade overlap).
 * ffmpegFilter: vf filter string applied to each photo.
 */
const MOOD_ASSETS = {
  warm: {
    bgmFile: 'warm.mp3',
    slideDuration: 3,
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
    // Cool blue-green tones
    ffmpegFilter:
      'colorbalance=rs=-0.05:gs=0.05:bs=0.1,' +
      'curves=b=\'0/0 0.5/0.6 1/1\'',
    description: 'cool blue-green tones',
  },
  energetic: {
    bgmFile: 'energetic.mp3',
    slideDuration: 2,
    // High contrast, saturated
    ffmpegFilter:
      'eq=contrast=1.3:saturation=1.5:brightness=0.05',
    description: 'high contrast, saturated',
  },
  melancholic: {
    bgmFile: 'melancholic.mp3',
    slideDuration: 4,
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
 * @returns {{ bgmPath: string, slideDuration: number, ffmpegFilter: string, description: string }}
 */
function matchAssets(mood, assetsDir) {
  const config = MOOD_ASSETS[mood];
  if (!config) {
    throw new Error(`Unknown mood: "${mood}". Must be one of: ${Object.keys(MOOD_ASSETS).join(', ')}`);
  }

  return {
    bgmPath: path.join(assetsDir, 'bgm', config.bgmFile),
    slideDuration: config.slideDuration,
    ffmpegFilter: config.ffmpegFilter,
    description: config.description,
  };
}

module.exports = { matchAssets };
