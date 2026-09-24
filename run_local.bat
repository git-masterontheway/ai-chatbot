@echo off
title DocVerse AI - Local Server
cd /d "%~dp0"
echo ========================================================
echo   Starting DocVerse AI Local Server on http://localhost:8081
echo ========================================================
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe ai_integration\gemini_web2api.py
) else if exist "..\venv\Scripts\python.exe" (
    ..\venv\Scripts\python.exe ai_integration\gemini_web2api.py
) else (
    python ai_integration\gemini_web2api.py
)
pause
