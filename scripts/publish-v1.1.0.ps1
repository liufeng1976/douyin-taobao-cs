param(
  [Parameter(Mandatory = $true)]
  [string]$Confirmation,
  [switch]$CreatePullRequest,
  [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = 'liufeng1976/douyin-taobao-cs'
$Branch = 'release/douyin-taobao-cs-v1.1.0'
$Tag = 'v1.1.0'
$ExpectedVersion = '1.1.0'
$ManifestPath = 'governance/public-source-release-candidate.v1.1.0.json'
$ReviewedConflictPaths = @(
  'README.md',
  'README_EN.md',
  'CONTRIBUTING.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/community_demo_feedback.yml',
  '.github/ISSUE_TEMPLATE/config.yml'
)

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CommandArgs)
  & git @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($CommandArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Npm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CommandArgs)
  & npm @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($CommandArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Get-GitText {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CommandArgs)
  $output = & git @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($CommandArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
  if ($null -eq $output) { return '' }
  return (($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

Write-Host '== BossAI douyin-taobao-cs v1.1.0 safe publisher ==' -ForegroundColor Cyan

if ($Confirmation -ne 'PUBLISH_BOSSAI_DOUYIN_TAOBAO_V1_1_0') {
  throw 'Confirmation mismatch. No Git commit or remote push was attempted.'
}

$inside = Get-GitText rev-parse --is-inside-work-tree
if ($inside -ne 'true') { throw 'Run this script from the v1.1.0 candidate Git worktree.' }

$rebaseMergePath = Get-GitText rev-parse --git-path rebase-merge
$rebaseApplyPath = Get-GitText rev-parse --git-path rebase-apply
if ((Test-Path $rebaseMergePath) -or (Test-Path $rebaseApplyPath)) {
  throw 'A rebase is already in progress. Resolve or abort it before publishing.'
}

$unmerged = & git diff --name-only --diff-filter=U
if ($unmerged) { throw "Unmerged files exist:`n$unmerged" }

$pkg = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
if ($pkg.version -ne $ExpectedVersion) {
  throw "package.json version must be $ExpectedVersion, found $($pkg.version)."
}
if ($pkg.license -ne 'LicenseRef-BossAI-Community-Source-1.0') {
  throw 'BossAI Community Source License identity changed unexpectedly.'
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$reviewedRemoteMain = [string]$manifest.reviewedRemoteMain
if (-not $reviewedRemoteMain -or $reviewedRemoteMain -notmatch '^[0-9a-f]{40}$') {
  throw 'Release candidate manifest does not contain a valid reviewedRemoteMain SHA.'
}

Write-Host 'Fetching latest main and tags...'
Invoke-Git fetch origin main --tags

$latestMain = Get-GitText rev-parse origin/main
$base = Get-GitText merge-base HEAD origin/main
Write-Host "Latest origin/main: $latestMain"
Write-Host "Candidate merge-base: $base"
if ($latestMain -ne $reviewedRemoteMain) {
  throw "origin/main moved after review. reviewed=$reviewedRemoteMain latest=$latestMain. Re-review remote changes before publishing. No Git write was attempted."
}

$remoteReleaseBranch = Get-GitText ls-remote --heads origin "refs/heads/$Branch"
if ($remoteReleaseBranch) {
  throw "Remote branch $Branch already exists. Refusing to overwrite it."
}

$remoteTag = Get-GitText ls-remote --tags origin "refs/tags/$Tag"
if ($remoteTag) {
  throw "Tag $Tag already exists remotely. Refusing to move or overwrite it."
}

$v100 = Get-GitText ls-remote --tags origin 'refs/tags/v1.0.0'
if (-not $v100) { throw 'Existing v1.0.0 release tag is missing; stop and investigate.' }
Write-Host "Existing v1.0.0 preserved: $v100"

Write-Host 'Running pre-commit candidate verification...'
Invoke-Npm ci
Invoke-Npm run demo
Invoke-Npm run check
Invoke-Npm run verify:release-candidate
Invoke-Git diff --check

if ($PreflightOnly) {
  Write-Host 'PREFLIGHT ONLY PASSED' -ForegroundColor Green
  Write-Host "Reviewed origin/main: $latestMain"
  Write-Host 'No branch, commit, tag, pull request or remote push was created.'
  exit 0
}

$currentBranch = Get-GitText branch --show-current
if ($currentBranch -ne $Branch) {
  $existingLocal = Get-GitText branch --list $Branch
  if ($existingLocal) { throw "Local branch $Branch already exists. Refusing to reuse it automatically." }
  Invoke-Git -CommandArgs @('switch', '-c', $Branch)
}

Write-Host 'Creating the candidate commit...'
Invoke-Git add -A
$staged = Get-GitText diff --cached --name-only
if (-not $staged) { throw 'No staged v1.1.0 changes found.' }

# Historical portfolio note must not be changed by this release batch.
$portfolioNoteChanged = & git diff --cached --name-only -- 'PROJECT_FROZEN_DO_NOT_USE.md'
if ($portfolioNoteChanged) {
  throw 'PROJECT_FROZEN_DO_NOT_USE.md is staged. This release must preserve it unchanged.'
}

Invoke-Git commit -m 'release: harden API-free domestic channel connector v1.1.0'

$backupRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("bossai-douyin-taobao-v1.1.0-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($path in $ReviewedConflictPaths) {
  if (Test-Path -LiteralPath $path) {
    $backupPath = Join-Path $backupRoot $path
    $backupParent = Split-Path -Parent $backupPath
    if ($backupParent) { New-Item -ItemType Directory -Path $backupParent -Force | Out-Null }
    Copy-Item -LiteralPath $path -Destination $backupPath -Force
  }
}

Write-Host 'Rebasing candidate onto the reviewed remote main...'
$rebaseResolved = $false
try {
  & git rebase origin/main
  if ($LASTEXITCODE -eq 0) {
    $rebaseResolved = $true
  } else {
    $conflicts = @(& git diff --name-only --diff-filter=U | Where-Object { $_ -and $_.Trim() })
    if ($conflicts.Count -eq 0) {
      throw 'Rebase failed without a resolvable file conflict.'
    }

    $unexpected = @($conflicts | Where-Object { $_ -notin $ReviewedConflictPaths })
    if ($unexpected.Count -gt 0) {
      throw "Rebase has unreviewed conflicts: $($unexpected -join ', ')."
    }

    Write-Host "Resolving reviewed documentation/funnel conflicts: $($conflicts -join ', ')" -ForegroundColor Yellow
    foreach ($path in $conflicts) {
      $backupPath = Join-Path $backupRoot $path
      if (-not (Test-Path -LiteralPath $backupPath)) {
        throw "Reviewed conflict backup missing for $path."
      }
      $targetParent = Split-Path -Parent $path
      if ($targetParent) { New-Item -ItemType Directory -Path $targetParent -Force | Out-Null }
      Copy-Item -LiteralPath $backupPath -Destination $path -Force
      Invoke-Git add -- $path
    }

    & git -c core.editor=true rebase --continue
    if ($LASTEXITCODE -ne 0) {
      throw 'Rebase could not continue after restoring reviewed candidate files.'
    }

    $rebaseMergeNow = Get-GitText rev-parse --git-path rebase-merge
    $rebaseApplyNow = Get-GitText rev-parse --git-path rebase-apply
    if ((Test-Path $rebaseMergeNow) -or (Test-Path $rebaseApplyNow)) {
      throw 'Rebase still has pending steps after reviewed conflict resolution.'
    }
    $rebaseResolved = $true
  }
} catch {
  Write-Host 'Rebase stopped safely. No remote branch was pushed.' -ForegroundColor Yellow
  Write-Host "Reviewed candidate backup: $backupRoot" -ForegroundColor Yellow
  throw
} finally {
  if ($rebaseResolved -and (Test-Path -LiteralPath $backupRoot)) {
    Remove-Item -LiteralPath $backupRoot -Recurse -Force
  }
}

Write-Host 'Running post-rebase verification...'
Invoke-Npm ci
Invoke-Npm run demo
Invoke-Npm run check
Invoke-Npm run verify:release-candidate
Invoke-Git diff --check

$aheadBehind = Get-GitText rev-list --left-right --count "origin/main...HEAD"
Write-Host "origin/main...HEAD: $aheadBehind"

Write-Host "Pushing new release branch $Branch (never force)..."
Invoke-Git push --set-upstream origin $Branch

$headSha = Get-GitText rev-parse HEAD
Write-Host "Release branch pushed at $headSha" -ForegroundColor Green

if ($CreatePullRequest) {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $gh) {
    Write-Warning 'GitHub CLI not found; branch is pushed, create the PR in GitHub UI.'
  } else {
    & gh auth status *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'GitHub CLI is not authenticated; branch is pushed, create the PR in GitHub UI.'
    } else {
      $body = @"
## v1.1.0 — API-free Connector Hardening

- API-free signed Douyin/Taobao synthetic demo
- canonical `bossai.customer-service-connector-envelope.v1`
- stable idempotency and minimal-data order facts
- mandatory human-review policy; automatic customer sends/mutations disabled
- BossAI OS bounded draft path with safe local fallback
- 20/20 adapter tests + 17/17 local E2E
- bilingual discovery docs and BossAI funnel
- preserves BossAI Community Source License 1.0 and existing v1.0.0 release

Real Douyin/Taobao production API access is not claimed or required for this source release.
"@
      & gh pr create --repo $Repo --base main --head $Branch --title 'release: douyin-taobao-cs v1.1.0 API-free connector hardening' --body $body
      if ($LASTEXITCODE -ne 0) { throw 'Release branch was pushed, but gh pr create failed.' }
      Write-Host 'Pull request created.' -ForegroundColor Green
    }
  }
}

Write-Host ''
Write-Host 'SAFE PUBLISH STEP COMPLETE' -ForegroundColor Green
Write-Host "Branch: $Branch"
Write-Host "Commit: $headSha"
Write-Host 'No force push was used. main and v1.0.0 were not modified directly.'
Write-Host 'After the PR is merged to main, the v1.1.0 source-release workflow will verify and create the new tag/release if the tag does not already exist.'
