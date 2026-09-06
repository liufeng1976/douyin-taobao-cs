param(
  [Parameter(Mandatory = $true)]
  [string]$Confirmation,
  [string]$At = '09:15',
  [string]$TaskName = 'BossAI-douyin-taobao-cs-GitHub-Traffic',
  [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
$expected = 'INSTALL_BOSSAI_GITHUB_TRAFFIC_MONITOR'
if ($Confirmation -ne $expected) {
  throw "Confirmation mismatch. Expected: $expected"
}

if ($At -notmatch '^(?:[01]\d|2[0-3]):[0-5]\d$') {
  throw '-At must use 24-hour HH:mm format.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'run-github-traffic-snapshot.ps1'
$isDevSpaceWorktree = $repoRoot -match '[\\/]\.devspace[\\/]worktrees[\\/]'
if ($isDevSpaceWorktree -and -not $PreflightOnly) {
  throw 'Refusing to install a scheduled task from a disposable DevSpace worktree. Merge the change first, then run this installer from the stable checkout (for example D:\BossAI-Projects\douyin-taobao-cs).'
}
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Snapshot runner not found: $runner"
}

$null = Get-Command schtasks.exe -ErrorAction Stop
$gh = Get-Command gh -ErrorAction Stop
$null = Get-Command node -ErrorAction Stop

& $gh.Source auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub CLI authentication is not available for the current Windows user.'
}

$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runner`""

if ($PreflightOnly) {
  Write-Host 'GITHUB TRAFFIC MONITOR PREFLIGHT PASSED'
  Write-Host "Task: $TaskName"
  Write-Host "Schedule: daily at $At (Windows local time)"
  Write-Host "Repository: $repoRoot"
  if ($isDevSpaceWorktree) {
    Write-Host 'Install guard: this is a DevSpace worktree; formal installation must run from the stable checkout after merge.'
  }
  Write-Host 'No scheduled task was created.'
  exit 0
}

& schtasks.exe /Create /F /SC DAILY /ST $At /TN $TaskName /TR $action
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create scheduled task '$TaskName'."
}

Write-Host 'GITHUB TRAFFIC MONITOR INSTALLED'
Write-Host "Task: $TaskName"
Write-Host "Schedule: daily at $At (Windows local time)"
Write-Host "Repository: $repoRoot"
Write-Host 'Output: .bossai-local/github-traffic/'
Write-Host 'This task is read-only toward GitHub and does not publish, message customers, or mutate marketplace data.'
Write-Host ''
Write-Host 'To remove it:'
Write-Host "  schtasks.exe /Delete /F /TN `"$TaskName`""
