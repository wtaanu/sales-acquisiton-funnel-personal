$ErrorActionPreference = "Stop"

$workdir = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $workdir "output"
$stdoutLog = Join-Path $outputDir "scheduler.stdout.log"
$stderrLog = Join-Path $outputDir "scheduler.stderr.log"
$launcherLog = Join-Path $outputDir "scheduler.launcher.log"
$npmCmd = (Get-Command npm.cmd).Source

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$existing = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*src-node\\index.js*" }

if ($existing) {
  "$(Get-Date -Format s) Scheduler already running. Skipping launch." | Add-Content -Path $launcherLog
  exit 0
}

$process = Start-Process `
  -FilePath $npmCmd `
  -ArgumentList "start" `
  -WorkingDirectory $workdir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

"$(Get-Date -Format s) Started scheduler process $($process.Id)." | Add-Content -Path $launcherLog
