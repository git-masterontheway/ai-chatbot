@echo off
title DocVerse AI - Backend Server (gemini-web2api)
cd /d "%~dp0ai_integration"
echo Starting DocVerse AI Backend on http://localhost:8081 ...
if exist "..\venv\Scripts\python.exe" (
    "..\venv\Scripts\python.exe" gemini_web2api.py
) else if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" gemini_web2api.py
) else (
    python gemini_web2api.py
)
pause
