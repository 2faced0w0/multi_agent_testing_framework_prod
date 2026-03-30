# Start MATF locally and leave jobs running in background
# Use this when you want to start and forget

Write-Host "Starting Multi-Agent Testing Framework (Daemon Mode)" -ForegroundColor Green
Write-Host ""

# Check Redis
Write-Host "Checking Redis..." -ForegroundColor Yellow
try {
    $redisTest = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    if ($redisTest.TcpTestSucceeded) {
        Write-Host "[OK] Redis is running" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Redis not running. Start with: docker compose up -d redis" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[WARN] Could not verify Redis" -ForegroundColor Yellow
}

# Environment
$env:PORT = "3001"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:DATABASE_URL = "sqlite:///$PSScriptRoot/data/framework.db"
$env:TE_MODE = "simulate"
$env:LOG_LEVEL = "info"

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Port: $env:PORT"
Write-Host "  Redis: ${env:REDIS_HOST}:${env:REDIS_PORT}"
Write-Host "  Mode: $env:TE_MODE"
Write-Host ""

# Build if needed
if (-not (Test-Path "$PSScriptRoot\dist\api\server.js")) {
    Write-Host "Building..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed" -ForegroundColor Red
        exit 1
    }
}

# Start API
Write-Host "Starting API Server..." -ForegroundColor Cyan
$apiJob = Start-Job -ScriptBlock {
    param($port, $redisHost, $redisPort, $dbUrl, $workDir)
    Set-Location $workDir
    $env:PORT = $port
    $env:REDIS_HOST = $redisHost
    $env:REDIS_PORT = $redisPort
    $env:DATABASE_URL = $dbUrl
    npm run start
} -ArgumentList $env:PORT, $env:REDIS_HOST, $env:REDIS_PORT, $env:DATABASE_URL, $PSScriptRoot

Start-Sleep -Seconds 3

# Verify API
try {
    $health = Invoke-WebRequest -Uri "http://localhost:$env:PORT/api/v1/system/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[OK] API is healthy (Job ID: $($apiJob.Id))" -ForegroundColor Green
} catch {
    Write-Host "[WARN] API may still be starting (Job ID: $($apiJob.Id))" -ForegroundColor Yellow
}

# Start Agents
Write-Host "Starting Agents..." -ForegroundColor Cyan
$agentsJob = Start-Job -ScriptBlock {
    param($redisHost, $redisPort, $dbUrl, $teMode, $workDir)
    Set-Location $workDir
    $env:REDIS_HOST = $redisHost
    $env:REDIS_PORT = $redisPort
    $env:DATABASE_URL = $dbUrl
    $env:TE_MODE = $teMode
    npm run start:agents
} -ArgumentList $env:REDIS_HOST, $env:REDIS_PORT, $env:DATABASE_URL, $env:TE_MODE, $PSScriptRoot

Start-Sleep -Seconds 2
Write-Host "[OK] Agents started (Job ID: $($agentsJob.Id))" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Framework Running!" -ForegroundColor Green
Write-Host ""
Write-Host "Access:" -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:$env:PORT/"
Write-Host "  API: http://localhost:$env:PORT/api/v1/"
Write-Host "  Health: http://localhost:$env:PORT/api/v1/system/health"
Write-Host ""
Write-Host "Jobs:" -ForegroundColor Cyan
Write-Host "  API: $($apiJob.Id)"
Write-Host "  Agents: $($agentsJob.Id)"
Write-Host ""
Write-Host "Manage:" -ForegroundColor Yellow
Write-Host "  View logs: Receive-Job -Id $($apiJob.Id) -Keep"
Write-Host "  Stop all: Stop-Job -Id $($apiJob.Id),$($agentsJob.Id); Remove-Job -Id $($apiJob.Id),$($agentsJob.Id)"
Write-Host "  Check status: Get-Job -Id $($apiJob.Id),$($agentsJob.Id)"
Write-Host "========================================" -ForegroundColor Green
