Write-Host "Starting DocVerse AI Backend on http://localhost:8081..." -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\ai_integration"

if (Test-Path "$PSScriptRoot\venv\Scripts\python.exe") {
    & "$PSScriptRoot\venv\Scripts\python.exe" gemini_web2api.py
} elseif (Test-Path "$PSScriptRoot\ai_integration\venv\Scripts\python.exe") {
    & "$PSScriptRoot\ai_integration\venv\Scripts\python.exe" gemini_web2api.py
} else {
    python gemini_web2api.py
}
