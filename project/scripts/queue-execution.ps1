param(
    [string]$ApiBase = "http://localhost:3005",
    [string]$TestCaseId = "tc-queued-ui",
    [string]$Environment = "dev",
    [string]$Browser = "chromium",
    [string]$Device = "desktop",
    [int]$PollSeconds = 3,
    [int]$MaxPolls = 60
)

Write-Host "Queuing execution for testCaseId=$TestCaseId env=$Environment browser=$Browser device=$Device"

# Build JSON body safely
$bodyObj = [PSCustomObject]@{
    testCaseId  = $TestCaseId
    environment = $Environment
    browser     = $Browser
    device      = $Device
}
$bodyJson = $bodyObj | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/v1/tests/executions" -ContentType 'application/json' -Body $bodyJson
    Write-Host "Enqueue response: $($(ConvertTo-Json $resp -Compress))"
} catch {
    Write-Error "Failed to enqueue execution: $($_.Exception.Message)"
    exit 1
}

if (-not $resp -or -not $resp.id) {
    Write-Error "Unexpected response: $($resp | ConvertTo-Json -Compress)"
    exit 1
}

$execId = $resp.id
Write-Host "Enqueued execution id: $execId (status=$($resp.status))"

# Poll execution details via GUI API until terminal state
$final = $null
for ($i = 0; $i -lt $MaxPolls; $i++) {
    Start-Sleep -Seconds $PollSeconds
    try {
        $details = Invoke-RestMethod -Method Get -Uri "$ApiBase/api/v1/gui/executions/$execId"
        $status = $details.execution.status
        Write-Host "[$i] status: $status"
        if ($status -in @('passed','failed','canceled')) { $final = $details; break }
    } catch {
        # ignore transient errors
    }
}

if (-not $final) {
    Write-Error "Timeout waiting for execution $execId"
    exit 2
}

# Expect at least one report
$report = $final.reports | Select-Object -First 1
if (-not $report) {
    Write-Error "No report found for execution $execId"
    exit 3
}

$reportId = $report.id
$reportPath = $report.report_path
Write-Host "Report id: $reportId"
Write-Host "Report path: $reportPath"

# Try to load static viewer URL when possible, else fallback to download endpoint
$normalized = $reportPath -replace '\\','/'
$staticUrl = $null
if ($normalized -match 'test_execution_reports/') {
    if ($normalized -match '/index\.html$') {
        $parts = $normalized.Split('/')
        $idx = [Array]::IndexOf($parts, 'test_execution_reports')
        if ($idx -ge 0 -and ($idx + 1) -lt $parts.Length) {
            $folder = $parts[$idx+1]
            $staticUrl = "$ApiBase/reports-static/$([Uri]::EscapeDataString($folder))/index.html"
        }
    } else {
        $after = $normalized.Substring($normalized.IndexOf('test_execution_reports/') + 22)
        $encoded = ($after.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
        $staticUrl = "$ApiBase/reports-static/$encoded"
    }
}

if ($staticUrl) {
    Write-Host "Static report URL: $staticUrl"
    try {
        $page = Invoke-WebRequest -UseBasicParsing -Uri $staticUrl
        Write-Host "Static content length: $($page.Content.Length)"
    } catch {
        Write-Warning "Failed to fetch static report URL: $($_.Exception.Message)"
    }
} else {
    $dl = "$ApiBase/api/v1/gui/reports/$([Uri]::EscapeDataString($reportId))/download"
    Write-Host "Download URL: $dl"
    try {
        $page = Invoke-WebRequest -UseBasicParsing -Uri $dl
        Write-Host "Download content length: $($page.Content.Length)"
    } catch {
        Write-Warning "Failed to download report: $($_.Exception.Message)"
    }
}

# Print a compact JSON summary for verification
$summary = [PSCustomObject]@{
    executionId = $execId
    status      = $final.execution.status
    reportId    = $reportId
    reportPath  = $reportPath
    staticUrl   = $staticUrl
}
$summary | ConvertTo-Json -Compress | Write-Output
