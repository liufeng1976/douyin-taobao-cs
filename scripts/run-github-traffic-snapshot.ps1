param(
  [string]$OutputDirectory = '.bossai-local/github-traffic'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$gh = Get-Command gh -ErrorAction Stop
$node = Get-Command node -ErrorAction Stop

& $gh.Source auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub CLI authentication is not available for the current Windows user.'
}

& $node.Source 'scripts/github-traffic-report.js' '--save-dir' $OutputDirectory
if ($LASTEXITCODE -ne 0) {
  throw "GitHub traffic snapshot failed with exit code $LASTEXITCODE"
}
