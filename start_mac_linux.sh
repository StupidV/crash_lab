#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf 'Crash Lab Mobile: http://localhost:8765\n'
python3 serve.py 8765
