/**
 * Step 4: Video Generation
 * Uses ffmpeg to compose a ~30s Instagram Reels-format video:
 * - 1080×1920 (9:16 vertical)
 * - Ken Burns pan/zoom effect per photo
 * - Crossfade transitions (0.8s)
 * - BGM at 0.8 volume with 3s fade-out
 * - Subtitle overlay (diary text snippets, bottom center)
 * - H.264 MP4 output
 */

const ffmpeg = require('fluent-ffmpeg');
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
 * Alternates between zoom-in-center, zoom-in-top-left, zoom-in-bottom-right.
 * @param {number} index
 * @param {number} slideDuration
 * @returns {string} zoompan filter string
 */
function kenBurnsFilter(index, slideDuration) {
  const frames = Math.round(slideDuration * FPS);
  const zoomTarget = 1.08; // 8% zoom
  const zoomStep = (zoomTarget - 1) / frames;

  // Alternate pan directions
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
  return lines.join('\n');
}

/**
 * Generate the reels video.
 *
 * @param {object} opts
 * @param {string[]} opts.photos       - Ordered list of photo file paths (top 10)
 * @param {object[]} opts.diaries      - Diary entries array
 * @param {string}   opts.bgmPath      - Path to BGM mp3 file
 * @param {number}   opts.slideDuration - Seconds per slide
 * @param {string}   opts.ffmpegFilter  - Color/style filter string
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
    // Each slide contributes (slideDuration) seconds; crossfade overlaps adjacent clips
    const totalDuration = photoCount * slideDuration - (photoCount - 1) * CROSSFADE_DURATION;

    // 2. Build ffmpeg filter_complex for slideshow with crossfades
    //    Each photo: [i] → scale → kenburns → color filter → labeled [vN]
    //    Then xfade chain: [v0][v1] xfade → [x01], [x01][v2] xfade → [x012] ...
    const filterParts = [];
    const inputLabels = [];

    for (let i = 0; i < photoCount; i++) {
      const kb = kenBurnsFilter(i, slideDuration);
      // Apply Ken Burns then color/mood filter
      filterParts.push(
        `[${i}:v]${kb},${ffmpegFilter},setsar=1[v${i}]`
      );
      inputLabels.push(`[v${i}]`);
    }

    // Build xfade chain
    let prevLabel = '[v0]';
    for (let i = 1; i < photoCount; i++) {
      const offset = (i * slideDuration - i * CROSSFADE_DURATION).toFixed(3);
      const outLabel = i === photoCount - 1 ? '[vout]' : `[x${i}]`;
      filterParts.push(
        `${prevLabel}[v${i}]xfade=transition=fade:duration=${CROSSFADE_DURATION}:offset=${offset}${outLabel}`
      );
      prevLabel = outLabel.replace(/^\[/, '[');
      // Fix: outLabel already has brackets
      prevLabel = outLabel;
    }

    // If only 1 photo (edge case), rename label
    if (photoCount === 1) {
      filterParts[0] = filterParts[0].replace('[v0]', '[vout]');
    }

    // 3. Subtitle: pick one diary sentence per photo (cycle through diaries)
    //    We'll add subtitles via drawtext filter chained after [vout]
    const drawTexts = processedPhotos.map((_, i) => {
      const diary = diaries[i % diaries.length];
      const snippet = wrapText(diary.text.split('.')[0] + '.', 55)
        // Escape special chars for ffmpeg drawtext
        .replace(/'/g, "\u2019")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');

      const startTime = (i * (slideDuration - CROSSFADE_DURATION)).toFixed(3);
      const endTime = ((i + 1) * (slideDuration - CROSSFADE_DURATION) + CROSSFADE_DURATION).toFixed(3);

      return (
        `drawtext=text='${snippet}':` +
        `fontsize=38:fontcolor=white:` +
        `x=(w-text_w)/2:y=h-text_h-120:` +
        `box=1:boxcolor=black@0.45:boxborderw=12:` +
        `enable='between(t,${startTime},${endTime})'`
      );
    });

    const subtitleFilter = drawTexts.join(',');
    filterParts.push(`[vout]${subtitleFilter}[vfinal]`);

    // 4. BGM audio filter: volume + fade-out
    const audioFilter = `volume=${BGM_VOLUME},afade=t=out:st=${(totalDuration - BGM_FADEOUT_SEC).toFixed(3)}:d=${BGM_FADEOUT_SEC}`;

    const filterComplex = filterParts.join(';');

    // 5. Build and run ffmpeg command
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg();

      // Add photo inputs
      for (const photo of processedPhotos) {
        cmd = cmd.input(photo).inputOptions(['-loop 1']);
      }

      // Add BGM input
      const hasBgm = bgmPath && require('fs').existsSync(bgmPath);
      if (hasBgm) {
        cmd = cmd.input(bgmPath);
      }

      cmd
        .complexFilter(filterComplex)
        .outputOptions([
          '-map [vfinal]',
          hasBgm ? `-map ${photoCount}:a` : '',
          hasBgm ? `-af ${audioFilter}` : '',
          `-t ${totalDuration.toFixed(3)}`,
          '-c:v libx264',
          '-preset medium',
          '-crf 23',
          hasBgm ? '-c:a aac' : '',
          hasBgm ? '-b:a 192k' : '',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
          `-r ${FPS}`,
        ].filter(Boolean))
        .output(outputPath)
        .on('progress', info => {
          if (onProgress && info.percent != null) {
            onProgress(Math.min(100, Math.round(info.percent)));
          }
        })
        .on('end', resolve)
        .on('error', (err, stdout, stderr) => {
          reject(new Error(`ffmpeg error: ${err.message}\n${stderr}`));
        })
        .run();
    });
  } finally {
    await fs.remove(tmpDir);
  }
}

module.exports = { generateVideo };
