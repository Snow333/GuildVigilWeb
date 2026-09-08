# Creates (or refreshes) the "Guild Vigil" shortcut on the desktop.
#
# Run once:
#   powershell -ExecutionPolicy Bypass -File tools\make-shortcut.ps1
#
# The shortcut runs tools\play.ps1, which rebuilds from the working tree and
# then opens the single-file artifact. Re-run this script if you move the repo.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $repo 'tools\play.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'Guild Vigil.lnk'

if (-not (Test-Path $launcher)) { throw "launcher missing: $launcher" }

$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
$s.TargetPath = 'powershell.exe'
# -ExecutionPolicy Bypass so the shortcut works regardless of the machine's
# policy (this box blocks .ps1 by default, which is why pnpm.ps1 fails there).
$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
$s.WorkingDirectory = $repo
$s.Description = 'Build and play the latest Guild Vigil'
$s.WindowStyle = 1
# Use the browser's icon if we can find one, else PowerShell's.
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (Test-Path $edge) { $s.IconLocation = "$edge,0" }
$s.Save()

Write-Host "Created: $lnk" -ForegroundColor Green
Write-Host "  runs:  $launcher" -ForegroundColor DarkGray
Write-Host "  cwd:   $repo" -ForegroundColor DarkGray
