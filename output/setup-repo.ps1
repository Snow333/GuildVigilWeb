# ============================================================
# Guild Vigil - repo install & verification
# Installs dependencies, runs the full check suite (typecheck +
# boundary lint + tests), optionally initializes git.
#
# Run from any PowerShell window (no admin needed):
#   powershell -ExecutionPolicy Bypass -File "C:\GuildVigilWeb\output\setup-repo.ps1"
# ============================================================

$ErrorActionPreference = 'Continue'

# Pick up PATH changes from the earlier toolchain install
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')

Set-Location 'C:\GuildVigilWeb'
Write-Host ""
Write-Host "=== Guild Vigil repo setup (C:\GuildVigilWeb) ===" -ForegroundColor Cyan
Write-Host ""

# --- Preflight ---
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  Write-Host "pnpm not found on PATH. Open a NEW terminal (PATH refresh) or re-run setup-dev-env.ps1." -ForegroundColor Red
  Read-Host "Press Enter to close"; exit 1
}
Write-Host ("node " + (node -v) + "  |  pnpm v" + (pnpm -v)) -ForegroundColor Green

# --- 1/2: Install dependencies ---
Write-Host ""
Write-Host "[1/2] pnpm install..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "pnpm install FAILED (exit $LASTEXITCODE). Stopping here." -ForegroundColor Red
  Read-Host "Press Enter to close"; exit 1
}

# --- 2/2: Full verification (typecheck + boundary lint + 14 tests) ---
Write-Host ""
Write-Host "[2/2] pnpm check (typecheck + lint + tests)..." -ForegroundColor Yellow
pnpm check
if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "ALL CHECKS GREEN - the repo is verified on this machine." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "pnpm check FAILED (exit $LASTEXITCODE) - copy the output above back to Claude." -ForegroundColor Red
  Read-Host "Press Enter to close"; exit 1
}

# --- Optional: git init + first commit ---
Write-Host ""
if (Test-Path '.git') {
  Write-Host "Git repo already initialized - skipping." -ForegroundColor Green
} else {
  $ans = Read-Host "Initialize git and make the first commit? (y/n)"
  if ($ans -eq 'y') {
    git init -b main
    git add -A
    $hasIdentity = (git config user.name) -and (git config user.email)
    if ($hasIdentity) {
      git commit -m "Milestone 1.0: scaffold, sim core (Rng/events/SaveStore), content converter + registries"
      Write-Host "Initial commit created." -ForegroundColor Green
    } else {
      Write-Host "git user.name/email not configured - staged but not committed. Run:" -ForegroundColor Yellow
      Write-Host '  git config --global user.name "Steven Snow"; git config --global user.email "steven.snow@gmail.com"'
      Write-Host '  git commit -m "Milestone 1.0: scaffold, sim core, content converter"'
    }
  }
}

Write-Host ""
Write-Host "Done. Try it:  pnpm dev   (then open the printed localhost URL)" -ForegroundColor Cyan
Read-Host "Press Enter to close"
