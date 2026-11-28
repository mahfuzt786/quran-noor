#!/bin/sh
# Rebuilds og-image.png (the picture shown when a Noor link is shared) from tools/og-image.html with headless Chrome.
cd "$(dirname "$0")/.." || exit 1
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 \
  --virtual-time-budget=6000 --screenshot="$(pwd)/og-image.png" "file:///$(pwd -W 2>/dev/null || pwd)/tools/og-image.html"
