# Quick Local Start - Run API and Agents in foreground
# Use start-local.ps1 for background mode with monitoring

Write-Host "🚀 MATF Local Quick Start" -ForegroundColor Green
Write-Host ""

# Environment
$env:PORT = "3001"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:DATABASE_URL = "sqlite:///$PSScriptRoot/data/framework.db"
$env:TE_MODE = "simulate"

Write-Host "Select what to run:" -ForegroundColor Cyan
Write-Host "1. API Server only"
Write-Host "2. Agents only"
Write-Host "3. Both (split terminal manually)"
Write-Host ""
$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "🌐 Starting API Server on http://localhost:3001..." -ForegroundColor Green
        npm run start
    }
    "2" {
        Write-Host "🤖 Starting Agents..." -ForegroundColor Green
        npm run start:agents
    }
    "3" {
        Write-Host "⚠️  You need to run in separate terminals:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Terminal 1:" -ForegroundColor Cyan
        Write-Host '  $env:PORT="3001"; $env:REDIS_HOST="localhost"; npm run start'
        Write-Host ""
        Write-Host "Terminal 2:" -ForegroundColor Cyan
        Write-Host '  $env:REDIS_HOST="localhost"; $env:TE_MODE="simulate"; npm run start:agents'
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}
