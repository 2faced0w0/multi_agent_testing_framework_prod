# start-local.ps1
# Runs SAFEST v2 backend + frontend locally (no Docker required)

$Root    = "D:\multi_agent_testing_framework_prod"
$Project = "$Root\project"
$Venv    = "$Root\safest\Scripts\activate"

Write-Host "Starting SAFEST v2 Local Development Environment..." -ForegroundColor Cyan

# 1. FastAPI Backend — activate venv, install deps, start uvicorn
Write-Host "Starting Backend API on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  cd '$Project\backend'
  & '$Venv'
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"@

# 2. React / Vite Frontend
Write-Host "Starting Frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  cd '$Project\frontend'
  npm install
  npm run dev
"@

Write-Host ""
Write-Host "Done! Two terminals have been opened." -ForegroundColor Green
Write-Host "  Backend  -> http://localhost:8000"   -ForegroundColor Cyan
Write-Host "  Frontend -> http://localhost:5173"   -ForegroundColor Cyan
