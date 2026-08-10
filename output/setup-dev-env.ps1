# ============================================================
# Guild Vigil - Dev Environment Setup (Phases 1-3 toolchain)
# Installs: Node.js LTS (>=22), pnpm (corepack), VS Code + extensions
#
# Run from any PowerShell window:
#   powershell -ExecutionPolicy Bypass -File "C:\GuildVigilWeb\output\setup-dev-env.ps1"
# (or right-click this file -> "Run with PowerShell")
# Approve the UAC prompt when it appears.
# ============================================================

$ErrorActionPreference = 'Continue'

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path','User')
}

function Get-NodeMajor {
  try {
    $v = (& node -v) 2>$null
    if ($v -match 'v(\d+)') { return [int]$Matches[1] }
  } catch {}
  return 0
}

Write-Host ""
Write-Host "=== Guild Vigil dev environment setup ===" -ForegroundColor Cyan
Write-Host ""

# --- Self-elevate (Node machine install + corepack shims need admin) ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Requesting administrator rights (UAC prompt incoming)..." -ForegroundColor Yellow
  Start-Process powershell.exe -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File","`"$PSCommandPath`"" -Verb RunAs
  exit
}

# --- 1/3: Node.js LTS ---
$major = Get-NodeMajor
if ($major -ge 22) {
  Write-Host "[1/3] Node.js already sufficient: $(node -v)" -ForegroundColor Green
} else {
  if ($major -gt 0) {
    Write-Host "[1/3] Node $(node -v) found - below v22, upgrading to current LTS..." -ForegroundColor Yellow
  } else {
    Write-Host "[1/3] Node.js not found - installing current LTS..." -ForegroundColor Yellow
  }
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  Refresh-Path
  $major = Get-NodeMajor
  if ($major -ge 22) {
    Write-Host "      Node installed: $(node -v)" -ForegroundColor Green
  } else {
    Write-Host "      Node not visible on PATH yet - open a NEW terminal and re-run this script." -ForegroundColor Red
  }
}

# --- 2/3: pnpm via corepack (npm fallback) ---
Write-Host "[2/3] Enabling pnpm..." -ForegroundColor Yellow
if (Get-Command corepack -ErrorAction SilentlyContinue) {
  corepack enable 2>$null
  corepack prepare pnpm@latest --activate 2>$null
} else {
  # Newer Node releases are dropping corepack from the default install
  Write-Host "      corepack not present - installing pnpm via npm instead." -ForegroundColor Yellow
  npm install -g pnpm | Out-Null
}
Refresh-Path
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmCmd) {
  Write-Host "      pnpm ready: v$(pnpm -v)" -ForegroundColor Green
} else {
  Write-Host "      pnpm not on PATH in this session - it will be available in a new terminal." -ForegroundColor Yellow
}

# --- 3/3: VS Code + extensions ---
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
if (-not $codeCmd) {
  Write-Host "[3/3] VS Code not found - installing..." -ForegroundColor Yellow
  winget install --id Microsoft.VisualStudioCode -e --accept-package-agreements --accept-source-agreements
  Refresh-Path
  $codeCmd = Get-Command code -ErrorAction SilentlyContinue
}
if ($codeCmd) {
  Write-Host "[3/3] Installing VS Code extensions..." -ForegroundColor Yellow
  $exts = @(
    'dbaeumer.vscode-eslint',      # ESLint (surfaces the sim boundary rule live)
    'esbenp.prettier-vscode',      # Prettier
    'vitest.explorer',             # Vitest test explorer
    'ms-playwright.playwright'     # Playwright
  )
  foreach ($e in $exts) {
    & code --install-extension $e --force *> $null
    Write-Host "      + $e" -ForegroundColor Green
  }
} else {
  Write-Host "[3/3] VS Code CLI not on PATH - after opening a new terminal, run:" -ForegroundColor Yellow
  Write-Host "      code --install-extension dbaeumer.vscode-eslint esbenp.prettier-vscode vitest.explorer ms-playwright.playwright"
}

# --- Summary ---
Write-Host ""
Write-Host "=== Verification summary ===" -ForegroundColor Cyan
try { Write-Host ("  node : " + (node -v)) } catch { Write-Host "  node : NOT ON PATH (open a new terminal)" -ForegroundColor Red }
try { Write-Host ("  npm  : " + (npm -v)) } catch { Write-Host "  npm  : not on PATH yet" }
try { Write-Host ("  pnpm : " + (pnpm -v)) } catch { Write-Host "  pnpm : not on PATH yet (new terminal)" }
try { Write-Host ("  git  : " + (git --version)) } catch { Write-Host "  git  : NOT FOUND" -ForegroundColor Red }
Write-Host ""
Write-Host "Done. Open a NEW terminal so PATH changes take effect." -ForegroundColor Cyan
Write-Host "(Rust / VS Build Tools / Android Studio wait until Phase 4 - do not install now.)"
Write-Host ""
Read-Host "Press Enter to close"
