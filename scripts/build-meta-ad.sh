#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEMO="$ROOT/public/demo/meta-ad"
ASSETS="$DEMO/assets"

echo "→ Recording visuals…"
node "$ROOT/scripts/record-meta-ad.mjs"
RAW="$(ls "$DEMO"/raw/*.webm | head -1)"

echo "→ Mixing audio…"
ffmpeg -y \
  -i "$ASSETS/voiceover.mp3" \
  -i "$ASSETS/music.wav" \
  -filter_complex "[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.2,apad=pad_dur=1.0[vo];[1:a]volume=0.22,afade=t=in:st=0:d=0.35,afade=t=out:st=22.5:d=1.2[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.96[a]" \
  -map "[a]" -ar 44100 -ac 2 -b:a 192k "$ASSETS/mix.mp3"

OUT="${1:-$DEMO/frizeo-meta-ad-9x16.mp4}"
echo "→ Exporting $OUT …"
ffmpeg -y -i "$RAW" -i "$ASSETS/mix.mp3" \
  -vf "fps=30,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k \
  -shortest -movflags +faststart "$OUT"

echo "Done: $OUT"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT"
