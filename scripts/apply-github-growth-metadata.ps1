param(
  [Parameter(Mandatory = $true)]
  [string]$Confirmation
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = 'liufeng1976/douyin-taobao-cs'
$ExpectedConfirmation = 'APPLY_BOSSAI_DOUYIN_TAOBAO_GITHUB_GROWTH_METADATA'
$Description = 'API-free Douyin/Taobao/Tmall/Qianniu customer-service connector: signed webhooks, normalization, idempotency, human review, BossAI intake.'
$Homepage = 'https://bossaios.com'
$Topics = @(
  'bossai',
  'douyin',
  'taobao',
  'tmall',
  'qianniu',
  'customer-service',
  'webhook',
  'ecommerce',
  'ai-agent',
  'human-in-the-loop',
  'connector',
  'china-ecommerce'
)

if ($Confirmation -ne $ExpectedConfirmation) {
  throw 'Confirmation mismatch. Repository metadata was not changed.'
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'GitHub CLI (gh) is required.'
}

& gh auth status
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub CLI is not authenticated.'
}

Write-Host 'Current repository metadata:' -ForegroundColor Cyan
& gh repo view $Repo --json description,homepageUrl,repositoryTopics,stargazerCount,forkCount,latestRelease
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read current GitHub repository metadata.'
}

$arguments = @(
  'repo', 'edit', $Repo,
  '--description', $Description,
  '--homepage', $Homepage
)
foreach ($topic in $Topics) {
  $arguments += @('--add-topic', $topic)
}

Write-Host 'Applying About description, homepage and discovery topics...' -ForegroundColor Cyan
& gh @arguments
if ($LASTEXITCODE -ne 0) {
  throw 'GitHub repository metadata update failed.'
}

Write-Host 'Updated repository metadata:' -ForegroundColor Green
& gh repo view $Repo --json description,homepageUrl,repositoryTopics,stargazerCount,forkCount,latestRelease
if ($LASTEXITCODE -ne 0) {
  throw 'Metadata write completed, but post-write verification failed.'
}

Write-Host 'GITHUB GROWTH METADATA APPLIED' -ForegroundColor Green
Write-Host 'No repository visibility, branch, tag, release, issue, or source-code setting was changed by this script.'
