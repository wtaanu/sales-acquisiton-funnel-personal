$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "launch-sales-scheduler.ps1"
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $scriptPath
