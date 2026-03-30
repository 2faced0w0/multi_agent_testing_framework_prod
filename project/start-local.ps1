# Multi-Agent Testing Framework - Local Startup Script
# This script runs the framework locally without Docker

Write-Host "Starting Multi-Agent Testing Framework (Local Mode)" -ForegroundColor Green
Write-Host ""

# Check if Redis is running
Write-Host "Checking Redis connection..." -ForegroundColor Yellow
try {
    $redisTest = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    if ($redisTest.TcpTestSucceeded) {
        Write-Host "[OK] Redis is running on localhost:6379" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Redis is not running. Please start Redis or Docker Compose first." -ForegroundColor Red
        Write-Host "   Docker: docker compose up -d redis" -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "[WARN] Could not verify Redis connection" -ForegroundColor Yellow
}

Write-Host ""

# Set environment variables
$env:PORT = "3001"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:DATABASE_URL = "sqlite:///$PSScriptRoot/data/framework.db"
$env:TE_MODE = "simulate"  # Use 'playwright' for real browser tests
$env:LOG_LEVEL = "info"

Write-Host "Environment Configuration:" -ForegroundColor Cyan
Write-Host "   API Port: $env:PORT"
Write-Host "   Redis: ${env:REDIS_HOST}:${env:REDIS_PORT}"
Write-Host "   Database: $env:DATABASE_URL"
Write-Host "   Test Execution Mode: $env:TE_MODE"
Write-Host ""

# Check if TypeScript is compiled
if (-not (Test-Path "$PSScriptRoot\dist\api\server.js")) {
    Write-Host "Building TypeScript project..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Build completed" -ForegroundColor Green
    Write-Host ""
}

# Start API server in background
Write-Host "Starting API Server on http://localhost:$env:PORT..." -ForegroundColor Cyan
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

# Check if API started
try {
    $health = Invoke-WebRequest -Uri "http://localhost:$env:PORT/api/v1/system/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "[OK] API Server is healthy" -ForegroundColor Green
} catch {
    Write-Host "[WARN] API Server may still be starting..." -ForegroundColor Yellow
}

Write-Host ""

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
Write-Host "[OK] Agents started" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Framework is running!" -ForegroundColor Green
Write-Host ""
Write-Host "Access Points:" -ForegroundColor Cyan
Write-Host "   Dashboard: http://localhost:$env:PORT/"
Write-Host "   API: http://localhost:$env:PORT/api/v1/"
Write-Host "   Health: http://localhost:$env:PORT/api/v1/system/health"
Write-Host "   Metrics: http://localhost:$env:PORT/metrics"
Write-Host ""
Write-Host "Job IDs:" -ForegroundColor Cyan
Write-Host "   API Server: $($apiJob.Id)"
Write-Host "   Agents: $($agentsJob.Id)"
Write-Host ""
Write-Host "To stop:" -ForegroundColor Yellow
Write-Host "   Stop-Job -Id $($apiJob.Id),$($agentsJob.Id)"
Write-Host "   Remove-Job -Id $($apiJob.Id),$($agentsJob.Id)"
Write-Host ""
Write-Host "View logs:" -ForegroundColor Yellow
Write-Host "   Receive-Job -Id $($apiJob.Id) -Keep"
Write-Host "   Receive-Job -Id $($agentsJob.Id) -Keep"
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring (jobs will continue running)" -ForegroundColor Gray
Write-Host "Or run the stop commands above to fully stop the framework" -ForegroundColor Gray
Write-Host ""

# Monitor jobs
try {
    while ($true) {
        Start-Sleep -Seconds 5
        
        $apiState = Get-Job -Id $apiJob.Id
        $agentsState = Get-Job -Id $agentsJob.Id
        
        if ($apiState.State -eq "Failed" -or $apiState.State -eq "Stopped") {
            Write-Host "[ERROR] API Server stopped unexpectedly" -ForegroundColor Red
            Receive-Job -Id $apiJob.Id
            break
        }
        
        if ($agentsState.State -eq "Failed" -or $agentsState.State -eq "Stopped") {
            Write-Host "[ERROR] Agents stopped unexpectedly" -ForegroundColor Red
            Receive-Job -Id $agentsJob.Id
            break
        }
    }
} finally {
    Write-Host "`nStopping framework..." -ForegroundColor Yellow
    Stop-Job -Id $apiJob.Id,$agentsJob.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $apiJob.Id,$agentsJob.Id -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Framework stopped" -ForegroundColor Green
}
