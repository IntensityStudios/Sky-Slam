#!/usr/bin/env bash
# Sky Slam local server. Double-click or run: ./start.sh
cd "$(dirname "$0")" || exit 1

PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
fi

port_busy() {
  "$PY" -c 'import socket, sys
s = socket.socket()
s.settimeout(0.2)
try:
    s.connect(("127.0.0.1", int(sys.argv[1])))
    raise SystemExit(0)
except Exception:
    raise SystemExit(1)' "$1"
}

PORT=8477
if [ -n "$PY" ]; then
  tries=0
  while port_busy "$PORT"; do
    PORT=$((PORT + 1))
    tries=$((tries + 1))
    if [ "$tries" -gt 20 ]; then
      break
    fi
  done
fi

URL="http://127.0.0.1:${PORT}/"
echo ""
echo "  SKY SLAM"
echo "  Opening  ${URL}"
echo "  Leave this window open while you play."
echo "  Close it when you are done."
echo ""

(
  ready=0
  for _ in $(seq 1 160); do
    if [ -n "$PY" ] && port_busy "$PORT"; then
      ready=1
      break
    fi
    sleep 0.25
  done
  if [ "$ready" -eq 1 ]; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$URL" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then
      open "$URL" || true
    else
      echo "  Open ${URL} in your browser."
    fi
  else
    echo "  Open ${URL} in your browser."
  fi
) &

run_server() {
  echo "  Trying: $*"
  if "$@"; then
    return 0
  fi
  echo "  That option exited. Trying the next..."
  echo ""
  return 1
}

if [ -n "$PY" ] && run_server "$PY" -m http.server "$PORT" --bind 127.0.0.1; then
  exit 0
fi
if command -v npx >/dev/null 2>&1 && run_server npx --yes serve -l "$PORT"; then
  exit 0
fi
if [ -n "$PY" ] && run_server "$PY" serve.py "$PORT"; then
  exit 0
fi

echo ""
echo "  Sky Slam could not start a local server."
echo ""
echo "  Install Python, then run ./start.sh again."
echo "  https://www.python.org/downloads/"
echo ""
echo "  Node.js also works: https://nodejs.org/"
echo ""
exit 1
