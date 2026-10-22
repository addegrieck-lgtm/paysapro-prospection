#!/usr/bin/env bash
# Rend toutes les déclinaisons dans out/. Usage : bash scripts/render-all.sh [Composition...]
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f public/audio/musique-50s.wav ] && [ -f public/audio/musique-15s.wav ] || python3 scripts/musique.py

declare -A FICHIERS=(
  [Pub-16x9]=signe-et-seine-50s-16x9.mp4
  [Pub-9x16]=signe-et-seine-50s-9x16.mp4
  [Pub-15s-16x9]=signe-et-seine-15s-16x9.mp4
  [Pub-15s-9x16]=signe-et-seine-15s-9x16.mp4
  [Pub-16x9-SousTitres]=signe-et-seine-50s-16x9-sous-titres.mp4
)
COMPOS=("$@")
[ ${#COMPOS[@]} -eq 0 ] && COMPOS=(Pub-16x9 Pub-9x16 Pub-15s-16x9 Pub-15s-9x16 Pub-16x9-SousTitres)

for c in "${COMPOS[@]}"; do
  echo "▶ $c"
  npx remotion render src/index.ts "$c" "out/${FICHIERS[$c]}" --concurrency="${CONCURRENCY:-4}" --log=error
done
node scripts/srt.mjs
