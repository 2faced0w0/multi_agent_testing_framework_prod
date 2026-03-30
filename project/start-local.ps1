# start-local.ps1
# Script to run SAFEST v2 locally without docker for local testing

Write-Host "Starting SAFEST v2 Local Development Environment..." -ForegroundColor Cyan

# 1. Start FastApi Backend
Write-Host "Starting Backend API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd backend; ../safest/Scripts/activate; pip install -r requirements.txt; uvicorn main:app --reload --port 8000;`""

# 2. Start React Frontend
Write-Host "Starting Frontend App..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd frontend; npm install; npm run dev;`""

Write-Host "Local testing environment initiated! Check the pop-up terminals." -ForegroundColor Green
