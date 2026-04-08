/**
 * Step 4: Video Generation
 * Uses ffmpeg (via child_process.spawn) to compose a ~30s Instagram Reels video:
 * - 1080×1920 (9:16 vertical)
 * - Ken Burns pan/zoom effect per photo
 * - Crossfade transitions (0.8s)
 * - BGM at 0.8 volume with 3s fade-out
 * - Subtitle overlay (diary text snippets, bottom center)
 * - H.264 MP4 output
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const os = require('os');

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FPS = 30;
const CROSSFADE_DURATION = 0.8;
const BGM_VOLUME = 0.8;
const BGM_FADEOUT_SEC = 3;

/**
 * Pre-process a photo: resize/crop to 1080×1920 and save to a temp dir.
 * @param {string} src
 * @param {string} tmpDir
 * @param {number} index
 * @returns {Promise<string>} path to processed image
 */
async function preparePhoto(src, tmpDir, index) {
  const dest = path.join(tmpDir, `photo_${String(index).padStart(3, '0')}.jpg`);
  await sharp(src)
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality: 90 })
    .toFile(dest);
  return dest;
}

/**
 * Build a Ken Burns zoom/pan filter for a single photo.
 * Alternates between three pan directions to add visual variety.
 * @param {number} index
 * @param {number} slideDuration
 * @returns {string} zoompan filter string
 */
function kenBurnsFilter(index, slideDuration) {
  const frames = Math.round(slideDuration * FPS);
  const zoomTarget = 1.08; // 8% zoom
  const zoomStep = (zoomTarget - 1) / frames;

  const patterns = [
    // Zoom in, pan slightly right
    `zoompan=z='min(zoom+${zoomStep.toFixed(6)},${zoomTarget})':x='iw/2-(iw/zoom/2)+${0.02}*(on/${frames})*(iw/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS}`,
    // Zoom in, pan slightly up
    `zoompan=z='min(zoom+${zoomStep.toFixed(6)},${zoomTarget})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-${0.02}*(on/${frames})*(ih/2)':d=${frames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS}`,
    // Zoom in, pan slightly left+down
    `zoompan=z='min(zoom+${zoomStep.toFixed(6)},${zoomTarget})':x='iw/2-(iw/zoom/2)-${0.02}*(on/${frames})*(iw/2)':y='ih/2-(ih/zoom/2)+${0.02}*(on/${frames})*(ih/2)':d=${frames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS}`,
  ];
  return patterns[index % patterns.length];
}

/**
 * Wrap long subtitle text to prevent overflow.
 * Returns ffmpeg-compatible multi-line text (literal \n, not actual newline).
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function wrapText(text, maxChars = 55) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  // ffmpeg drawtext expects literal backslash-n for line breaks
  return lines.join('\\n');
}

/**
 * Check if ffmpeg supports the drawtext filter (requires libfreetype).
 * @returns {Promise<boolean>}
 */
function checkDrawtextSupport() {
  return new Promise(resolve => {
    const proc = spawn('ffmpeg', ['-filters'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    proc.stdout.on('data', chunk => { out += chunk.toString(); });
    proc.on('close', () => resolve(out.includes('drawtext')));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Run ffmpeg with the given arguments, reporting progress via onProgress.
 * @param {string[]} args
 * @param {number} totalDuration - Total video duration in seconds (for % calc)
 * @param {Function} [onProgress] - Called with 0-100
 * @returns {Promise<void>}
 */
function runFfmpeg(args, totalDuration, onProgress) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderrBuf = '';
    proc.stderr.on('data', chunk => {
      stderrBuf += chunk.toString();

      // Parse progress from lines like: time=00:00:15.50
      const lines = stderrBuf.split('\r');
      for (const line of lines) {
        const m = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (m && onProgress) {
          const currentSec =
            parseInt(m[1], 10) * 3600 +
            parseInt(m[2], 10) * 60 +
            parseInt(m[3], 10) +
            parseInt(m[4], 10) / 100;
          onProgress(Math.min(99, Math.round((currentSec / totalDuration) * 100)));
        }
      }
      // Keep only last line in buffer (avoid unbounded growth)
      stderrBuf = lines[lines.length - 1];
    });

    proc.on('close', code => {
      if (code === 0) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}.\nLast output:\n${stderrBuf}`));
      }
    });

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error('ffmpeg not found. Install it first:\n  brew install ffmpeg   (macOS)\n  apt install ffmpeg    (Ubuntu/Debian)'));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Generate the reels video.
 *
 * @param {object} opts
 * @param {string[]} opts.photos        - Ordered list of photo file paths
 * @param {object[]} opts.diaries       - Diary entries array
 * @param {string|null} opts.bgmPath    - Path to BGM mp3 file (null = no audio)
 * @param {number}   opts.slideDuration - Seconds per slide
 * @param {string}   opts.ffmpegFilter  - Color/style vf filter string
 * @param {string}   opts.outputPath    - Destination .mp4 path
 * @param {Function} [opts.onProgress]  - Called with progress % (0–100)
 * @returns {Promise<void>}
 */
async function generateVideo({ photos, diaries, bgmPath, slideDuration, ffmpegFilter, outputPath, onProgress }) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reels-'));

  try {
    // 1. Pre-process all photos to target resolution
    const processedPhotos = await Promise.all(
      photos.map((p, i) => preparePhoto(p, tmpDir, i))
    );

    const photoCount = processedPhotos.length;
    const totalDuration = photoCount * slideDuration - (photoCount - 1) * CROSSFADE_DURATION;
    const hasBgm = bgmPath != null && fs.existsSync(bgmPath);

    // 2. Build filter_complex
    const filterParts = [];

    // Per-photo: Ken Burns + color filter
    for (let i = 0; i < photoCount; i++) {
      filterParts.push(
        `[${i}:v]${kenBurnsFilter(i, slideDuration)},${ffmpegFilter},setsar=1[v${i}]`
      );
    }

    // Xfade chain
    if (photoCount === 1) {
      filterParts[0] = filterParts[0].replace(/\[v0\]$/, '[vout]');
    } else {
      let prevLabel = '[v0]';
      for (let i = 1; i < photoCount; i++) {
        const offset = (i * slideDuration - i * CROSSFADE_DURATION).toFixed(3);
        const outLabel = i === photoCount - 1 ? '[vout]' : `[x${i}]`;
        filterParts.push(
          `${prevLabel}[v${i}]xfade=transition=fade:duration=${CROSSFADE_DURATION}:offset=${offset}${outLabel}`
        );
        prevLabel = outLabel;
      }
    }

    // Subtitle drawtext filters (requires libfreetype — skip if not supported)
    const supportsDrawtext = await checkDrawtextSupport();
    if (supportsDrawtext) {
      const drawTexts = processedPhotos.map((_, i) => {
        const diary = diaries[i % diaries.length];
        const snippet = wrapText(diary.text.split('.')[0] + '.', 55)
          .replace(/'/g, '\u2019')   // straight apostrophe → curly (breaks drawtext quoting)
          .replace(/:/g, '\\:')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]');

        const startTime = (i * (slideDuration - CROSSFADE_DURATION)).toFixed(3);
        const endTime   = ((i + 1) * (slideDuration - CROSSFADE_DURATION) + CROSSFADE_DURATION).toFixed(3);

        return (
          `drawtext=text='${snippet}':` +
          `font=Sans:fontsize=38:fontcolor=white:` +
          `x=(w-text_w)/2:y=h-text_h-120:` +
          `box=1:boxcolor=black@0.45:boxborderw=12:` +
          `enable='between(t,${startTime},${endTime})'`
        );
      });
      filterParts.push(`[vout]${drawTexts.join(',')}[vfinal]`);
    } else {
      // drawtext not available — output video without subtitles
      filterParts.push(`[vout]copy[vfinal]`);
    }

    // BGM: volume + fade-out + trim to exact duration
    if (hasBgm) {
      const fadeStart = Math.max(0, totalDuration - BGM_FADEOUT_SEC).toFixed(3);
      filterParts.push(
        `[${photoCount}:a]volume=${BGM_VOLUME},` +
        `afade=t=out:st=${fadeStart}:d=${BGM_FADEOUT_SEC},` +
        `atrim=end=${totalDuration.toFixed(3)}[aout]`
      );
    }

    // 3. Assemble ffmpeg args
    const args = [];

    for (const photo of processedPhotos) {
      args.push('-loop', '1', '-i', photo);
    }
    if (hasBgm) {
      args.push('-i', bgmPath);
    }

    args.push('-filter_complex', filterParts.join(';'));

    args.push('-map', '[vfinal]');
    if (hasBgm) args.push('-map', '[aout]');

    args.push(
      '-t', totalDuration.toFixed(3),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
    );
    if (hasBgm) args.push('-c:a', 'aac', '-b:a', '192k');
    args.push(
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-y',         // overwrite output without prompt
      outputPath,
    );

    // 4. Run
    await runFfmpeg(args, totalDuration, onProgress);
  } finally {
    await fs.remove(tmpDir);
  }
}

module.exports = { generateVideo };
