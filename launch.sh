#!/usr/bin/env bash
# SkyWatch launcher for macOS / Linux
# Opens the app in Chrome/Chromium/Edge in chromeless "app" mode.

set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
URL="file://${HERE}/index.html"

case "$(uname -s)" in
  Darwin)
    if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
      exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
        --app="$URL" --user-data-dir="$HOME/Library/Application Support/SkyWatch/profile" \
        --window-size=420,820
    elif [ -x "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" ]; then
      exec "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
        --app="$URL" --user-data-dir="$HOME/Library/Application Support/SkyWatch/profile" \
        --window-size=420,820
    else
      open "$URL"
    fi
    ;;
  Linux)
    for B in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do
      if command -v "$B" >/dev/null 2>&1; then
        exec "$B" --app="$URL" --user-data-dir="$HOME/.config/SkyWatch/profile" --window-size=420,820
      fi
    done
    xdg-open "$URL"
    ;;
  *)
    echo "Unknown OS — open $URL manually."
    ;;
esac
