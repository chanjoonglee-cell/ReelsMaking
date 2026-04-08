/**
 * Step 4: Video Generation
 * Uses ffmpeg (via child_process.spawn) to compose a ~30s Instagram Reels video:
 * - 1080×1920 (9:16 vertical)
 * - Landscape photos displayed at natural ratio on blurred background (polaroid style)
 * - Ken Burns pan/zoom effect per photo (6 cinematic patterns)
 * - Dissolve/fade transitions (1.0s)
 * - Film grain + color grading applied via ffmpegFilter
 * - BGM at 0.8 volume with 3s fade-out
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
const CROSSFADE_DURATION = 1.0;   // slightly longer for moodier feel
const BGM_VOLUME = 0.8;
const BGM_FADEOUT_SEC = 3;

// Xfade transitions — alternated for a dynamic "photo album" feel
const TRANSITIONS = ['dissolve', 'fade', 'dissolve', 'slideup', 'dissolve', 'fade'];

/**
 * Pre-process a photo:
 * - Landscape: blurred/darkened background + photo centered with cream polaroid border
 * - Portrait: resize/crop to fill 1080×1920
 * Saves result to tmpDir.
 */
async function preparePhoto(src, tmpDir, index) {
  const dest = path.join(tmpDir, `photo_${String(index).padStart(3, '0')}.jpg`);

  // Get oriented dimensions (respect EXIF rotation)
  const rawMeta = await sharp(src).metadata();
  const rotated = rawMeta.orientation >= 5 && rawMeta.orientation <= 8;
  const orientedW = rotated ? rawMeta.height : (rawMeta.width ?? OUTPUT_WIDTH);
  const orientedH = rotated ? rawMeta.width : (rawMeta.height ?? OUTPUT_HEIGHT);
  const isLandscape = orientedW > orientedH;

  if (isLandscape) {
    // ── LANDSCAPE LAYOUT ──────────────────────────────────────────────────────
    // Polaroid border sizes
    const BLR = 30;   // left + right border
    const BT  = 26;   // top border
    const BB  = 82;   // bottom border (polaroid has bigger bottom)

    // Scale photo to fill the horizontal span inside borders
    const photoW = OUTPUT_WIDTH - BLR * 2;
    const photoH = Math.round(photoW * orientedH / orientedW);

    // Full polaroid frame dimensions (same width as canvas, variable height)
    const frameH = Math.min(photoH + BT + BB, OUTPUT_HEIGHT);

    // 1. Scale the landscape photo (sharp auto-applies EXIF rotation)
    const photoBuffer = await sharp(src)
      .rotate()  // apply EXIF rotation
      .resize(photoW, photoH, { fit: 'fill' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // 2. Cream-white polaroid frame
    const polaroidBuf = await sharp({
      create: { width: OUTPUT_WIDTH, height: frameH, channels: 3, background: { r: 248, g: 244, b: 236 } },
    })
      .composite([{ input: photoBuffer, top: BT, left: BLR }])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 3. Blurred + darkened background (full canvas)
    const bgBuffer = await sharp(src)
      .rotate()
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'cover', position: 'centre' })
      .blur(32)
      .modulate({ brightness: 0.28, saturation: 0.5 })
      .jpeg({ quality: 75 })
      .toBuffer();

    // 4. Composite: polaroid centered on background
    const topOffset = Math.max(0, Math.round((OUTPUT_HEIGHT - frameH) / 2));
    await sharp(bgBuffer)
      .composite([{ input: polaroidBuf, top: topOffset, left: 0 }])
      .jpeg({ quality: 90 })
      .toFile(dest);
  } else {
    // ── PORTRAIT LAYOUT ───────────────────────────────────────────────────────
    // Full-bleed crop (sharp auto-applies EXIF rotation via .rotate())
    await sharp(src)
      .rotate()
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90 })
      .toFile(dest);
  }

  return dest;
}

/**
 * Build a cinematic Ken Burns zoom/pan filter for a single photo.
 * 6 patterns: 3 zoom-pan and 3 slow pan-only for variety.
 * @param {number} index
 * @param {number} slideDuration
 * @returns {string} zoompan filter string
 */
function kenBurnsFilter(index, slideDuration) {
  const frames = Math.round(slideDuration * FPS);
  const W = OUTPUT_WIDTH;
  const H = OUTPUT_HEIGHT;

  // Zoom patterns (start at 1.0 → target)
  const zTarget = 1.10;
  const zStep = ((zTarget - 1) / frames).toFixed(6);

  // Slow pan patterns (very slight zoom just to allow panning)
  const pTarget = 1.04;
  const pStep = ((pTarget - 1) / frames).toFixed(6);

  const patterns = [
    // 0: Zoom in + pan right
    `zoompan=z='min(zoom+${zStep},${zTarget})':x='iw/2-(iw/zoom/2)+0.015*(on/${frames})*(iw/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // 1: Zoom in + pan up
    `zoompan=z='min(zoom+${zStep},${zTarget})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)-0.015*(on/${frames})*(ih/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // 2: Zoom in + pan left+down
    `zoompan=z='min(zoom+${zStep},${zTarget})':x='iw/2-(iw/zoom/2)-0.015*(on/${frames})*(iw/2)':y='ih/2-(ih/zoom/2)+0.015*(on/${frames})*(ih/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // 3: Slow pan left (cinematic parallax)
    `zoompan=z='min(zoom+${pStep},${pTarget})':x='(iw-iw/zoom)*(1-on/${frames})':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // 4: Slow pan right
    `zoompan=z='min(zoom+${pStep},${pTarget})':x='(iw-iw/zoom)*(on/${frames})':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // 5: Zoom in centered (pure zoom, no pan — works well on faces)
    `zoompan=z='min(zoom+${zStep},${zTarget})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
  ];
  return patterns[index % patterns.length];
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
        reject(new Error(`ffmpeg exited with code ${code}. Last output: ${stderrBuf}`));
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
    // 1. Pre-process all photos
    const processedPhotos = await Promise.all(
      photos.map((p, i) => preparePhoto(p, tmpDir, i))
    );

    const photoCount = processedPhotos.length;
    const totalDuration = photoCount * slideDuration - (photoCount - 1) * CROSSFADE_DURATION;
    const hasBgm = bgmPath != null && fs.existsSync(bgmPath);

    // 2. Build filter_complex
    const filterParts = [];

    // Per-photo: Ken Burns + color + grain filter
    for (let i = 0; i < photoCount; i++) {
      filterParts.push(
        `[${i}:v]${kenBurnsFilter(i, slideDuration)},${ffmpegFilter},setsar=1[v${i}]`
      );
    }

    // Xfade chain with varied transitions — final label is [vfinal]
    if (photoCount === 1) {
      filterParts[0] = filterParts[0].replace(/\[v0\]$/, '[vfinal]');
    } else {
      let prevLabel = '[v0]';
      for (let i = 1; i < photoCount; i++) {
        const offset = (i * slideDuration - i * CROSSFADE_DURATION).toFixed(3);
        const transition = TRANSITIONS[i % TRANSITIONS.length];
        const outLabel = i === photoCount - 1 ? '[vfinal]' : `[x${i}]`;
        filterParts.push(
          `${prevLabel}[v${i}]xfade=transition=${transition}:duration=${CROSSFADE_DURATION}:offset=${offset}${outLabel}`
        );
        prevLabel = outLabel;
      }
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
      '-y',
      outputPath,
    );

    // 4. Run
    await runFfmpeg(args, totalDuration, onProgress);
  } finally {
    await fs.remove(tmpDir);
  }
}

module.exports = { generateVideo };
