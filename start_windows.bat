@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Crash Lab Mobile: http://localhost:8765
start "" "http://localhost:8765"
where py >nul 2>&1
if %errorlevel%==0 (
  py serve.py 8765
) else (
  python serve.py 8765
)
pause
