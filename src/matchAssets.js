/**
 * Step 3: Asset Matching
 * Maps a mood to a BGM file path and ffmpeg filter parameters.
 *
 * All filters include:
 *   - colorbalance: mood-specific toning (warm/cool/neutral)
 *   - eq: brightness/contrast/saturation tuned for film look
 *   - vignette: depth and focus
 *   - noise: film grain (temporal, changes per frame)
 */

const path = require('path');

/**
 * Mood → asset configuration table.
 *
 * slideDuration: seconds each photo is displayed (before crossfade overlap).
 * targetPhotoCount: number of best shots to select so total video ≈ 25–35s.
 *   crossfade is now 1.0s:
 *   warm/calm  (3.5s): n=12 → 12*3.5 - 11*1.0 = 31.0s
 *   energetic  (2.5s): n=16 → 16*2.5 - 15*1.0 = 25.0s
 *   melancholic(4.5s): n=9  →  9*4.5 -  8*1.0 = 32.5s
 */
const MOOD_ASSETS = {
  warm: {
    bgmFile: 'warm.mp3',
    slideDuration: 3.5,
    targetPhotoCount: 12,
    // Kodak film: warm highlights, lifted shadows, reduced saturation, grain
    ffmpegFilter:
      'colorbalance=rs=0.18:gs=0.04:bs=-0.18:rm=0.08:gm=0.01:bm=-0.10:rh=0.04:gh=0:bh=-0.12,' +
      'eq=brightness=0.03:contrast=1.06:saturation=0.78:gamma=1.08,' +
      'vignette=PI/3.0:eval=init,' +
      'noise=alls=12:allf=t',
    description: 'Kodak film — warm, faded, grainy',
  },
  calm: {
    bgmFile: 'calm.mp3',
    slideDuration: 3.5,
    targetPhotoCount: 12,
    // Fuji film: slight blue-green tint, airy, soft grain
    ffmpegFilter:
      'colorbalance=rs=-0.06:gs=0.04:bs=0.10:rm=-0.04:gm=0.02:bm=0.07,' +
      'eq=brightness=0.02:contrast=1.03:saturation=0.80:gamma=1.06,' +
      'vignette=PI/3.8:eval=init,' +
      'noise=alls=9:allf=t',
    description: 'Fuji film — cool, airy, soft grain',
  },
  energetic: {
    bgmFile: 'energetic.mp3',
    slideDuration: 2.5,
    targetPhotoCount: 16,
    // Vivid film: punchy contrast, warm tones, sharp grain
    ffmpegFilter:
      'colorbalance=rs=0.10:gs=0:bs=-0.08,' +
      'eq=brightness=0.04:contrast=1.18:saturation=1.08,' +
      'vignette=PI/4.5:eval=init,' +
      'noise=alls=8:allf=t',
    description: 'Vivid film — punchy, warm, sharp grain',
  },
  melancholic: {
    bgmFile: 'melancholic.mp3',
    slideDuration: 4.5,
    targetPhotoCount: 9,
    // Faded old photo: desaturated, cool shadows, heavy vignette, strong grain
    ffmpegFilter:
      'colorbalance=rs=-0.04:gs=-0.02:bs=0.06:rm=-0.02:gm=-0.01:bm=0.04,' +
      'eq=brightness=-0.02:contrast=0.90:saturation=0.38:gamma=0.94,' +
      'vignette=PI/2.2:eval=init,' +
      'noise=alls=16:allf=t',
    description: 'Faded old photo — desaturated, heavy vignette, grainy',
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
