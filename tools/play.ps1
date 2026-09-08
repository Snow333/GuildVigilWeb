# Guild Vigil — desktop launcher
#
# Rebuilds the single-file artifact from the current working tree, then opens it
# in the default browser. `vite-plugin-singlefile` inlines the JS and CSS, so
# dist/index.html is fully self-contained — no dev server, no localhost, and it
# keeps working offline once built.
#
# Saves are localStorage, keyed per origin. Opening the same file:// path every
# time means one stable save home; see NOTE below before you move the repo.
#
# Created for Steven 2026-09-02. Regenerate the shortcut with:
#   powershell -ExecutionPolicy Bypass -File tools\make-shortcut.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$artifact = Join-Path $repo 'dist\index.html'
$pnpm = 'C:\Program Files\nodejs\pnpm.CMD'

Write-Host ''
Write-Host '  GUILD VIGIL' -ForegroundColor Yellow
Write-Host '  ===========' -ForegroundColor DarkGray
Write-Host ''

# --- Build -------------------------------------------------------------------
# A stale artifact is worse than a slow launch: you would be playtesting code
# you already changed. Always rebuild, but never leave the player with nothing
# if the build breaks mid-refactor.
Write-Host '  Building latest...' -NoNewline

if (-not (Test-Path $pnpm)) {
  Write-Host ' FAILED' -ForegroundColor Red
  Write-Host "  pnpm not found at $pnpm" -ForegroundColor Red
  Write-Host '  Install it with:  npm i -g pnpm@10.28.0' -ForegroundColor DarkGray
  Read-Host '  Press Enter to close'
  exit 1
}

$log = Join-Path $env:TEMP 'guildvigil-build.log'
& $pnpm build *>&1 | Out-File -FilePath $log -Encoding utf8
$buildOk = ($LASTEXITCODE -eq 0)

if ($buildOk) {
  Write-Host ' done' -ForegroundColor Green
  $size = [math]::Round((Get-Item $artifact).Length / 1KB, 1)
  Write-Host "  Bundle: $size kB" -ForegroundColor DarkGray
} else {
  Write-Host ' FAILED' -ForegroundColor Red
  Write-Host ''
  Write-Host '  The build did not succeed. Last 15 lines:' -ForegroundColor Yellow
  Get-Content $log -Tail 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
  Write-Host ''
  Write-Host "  Full log: $log" -ForegroundColor DarkGray

  if (Test-Path $artifact) {
    $age = (Get-Date) - (Get-Item $artifact).LastWriteTime
    $mins = [math]::Round($age.TotalMinutes)
    Write-Host ''
    Write-Host "  ! An OLDER build exists (from $mins min ago)." -ForegroundColor Yellow
    Write-Host '    It does NOT include your latest changes.' -ForegroundColor Yellow
    $ans = Read-Host '    Open it anyway? (y/N)'
    if ($ans -ne 'y') { exit 1 }
  } else {
    Write-Host ''
    Write-Host '  No previous build to fall back on.' -ForegroundColor Red
    Read-Host '  Press Enter to close'
    exit 1
  }
}

# --- Launch ------------------------------------------------------------------
Write-Host ''
Write-Host '  Opening...' -ForegroundColor DarkGray
Start-Process $artifact

# NOTE ON SAVES
# Saves live in browser localStorage under the file:// origin, via SaveStore
# (`gv_settings` plus the campaign slots). Two consequences worth knowing:
#   1. Moving or renaming C:\GuildVigilWeb changes the path and the browser will
#      treat it as a different origin -> the old saves stop appearing.
#   2. Opening the artifact in a DIFFERENT browser is a different store too.
# Nothing is lost in either case, it is just not visible; point the shortcut at
# the original path and browser to see it again.

Start-Sleep -Milliseconds 900
