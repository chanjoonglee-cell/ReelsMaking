# Reels Generator — CLAUDE.md

## Project Overview

AI-powered CLI tool that converts user photos + English diary entries into a ~30-second Instagram Reels video. Part of 언어의숲 (Eoneoeuisup), a personalized English learning app.

## Prerequisites

- Node.js 18+
- ffmpeg installed locally (`brew install ffmpeg` or `apt install ffmpeg`)
- OpenAI API key with GPT-4o access
- 4 royalty-free BGM files placed in `assets/bgm/`: `warm.mp3`, `calm.mp3`, `energetic.mp3`, `melancholic.mp3`

## Setup

```bash
npm install
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

## Running

```bash
# Prepare input data:
# - Place 20+ photos in input/photos/
# - Create input/diaries.json (7+ diary entries, see format below)

node src/index.js
# Output: output/reels_YYYYMMDD_HHMMSS.mp4
```

## Input Format — diaries.json

```json
[
  {
    "date": "2025-03-01",
    "text": "Today I went to the Han River with my friends. It was so peaceful.",
    "photoFile": "20250301_001.jpg"
  }
]
```

## Pipeline

1. **selectBestShots.js** — GPT-4o Vision scores each photo; top 10 selected
2. **analyzeMood.js** — GPT-4o reads all diary text → outputs `warm | calm | energetic | melancholic`
3. **matchAssets.js** — maps mood to BGM file + ffmpeg filter parameters
4. **generateVideo.js** — ffmpeg slideshow with Ken Burns effect, crossfade, subtitles, BGM

## Video Spec

| Property | Value |
|----------|-------|
| Resolution | 1080×1920 (9:16 vertical) |
| FPS | 30 |
| Duration | 25–35s |
| Transition | Crossfade 0.8s |
| Output | H.264 MP4 |

## Mood → Asset Mapping

| Mood | BGM | Filter | Slide Duration |
|------|-----|--------|----------------|
| warm | warm.mp3 | Warm yellow, soft vignette | 3s |
| calm | calm.mp3 | Cool blue-green tones | 3s |
| energetic | energetic.mp3 | High contrast, saturated | 2s |
| melancholic | melancholic.mp3 | Desaturated, heavy vignette | 4s |

## Cost Notes

- OpenAI Vision API: max 30 photos analyzed to control cost (~$0.12 for 24 photos)
- Video generation uses local CPU: expect 1–3 minutes
