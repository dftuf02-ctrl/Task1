# Deploys TaskFlow to a local minikube cluster — end to end, no console clicks.
#   pwsh -File k8s/deploy.ps1
#
# Secrets: Supabase creds come from env vars or the repo-root .env; JWT signing
# secrets are generated here. Nothing secret is written to a committed file.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$root = Split-Path -Parent $here

Write-Host "==> Starting minikube (docker driver)" -ForegroundColor Cyan
& minikube status *> $null
if ($LASTEXITCODE -ne 0) { & minikube start --driver=docker }

Write-Host "==> Building app image taskflow-api:k8s" -ForegroundColor Cyan
docker build -t taskflow-api:k8s "$root\backend"

Write-Host "==> Loading image into minikube" -ForegroundColor Cyan
& minikube image load taskflow-api:k8s

Write-Host "==> Applying namespace + config" -ForegroundColor Cyan
kubectl apply -f "$here\namespace.yaml"
kubectl apply -f "$here\configmap.yaml"

Write-Host "==> Creating Secret (no plaintext in repo)" -ForegroundColor Cyan
$supaUrl = $env:SUPABASE_URL
$supaKey = $env:SUPABASE_ANON_KEY
$envFile = Join-Path $root ".env"
if ((-not $supaUrl -or -not $supaKey) -and (Test-Path $envFile)) {
  Get-Content $envFile | ForEach-Object {
    if (-not $supaUrl -and $_ -match '^\s*SUPABASE_URL\s*=\s*(.+?)\s*$') { $supaUrl = $Matches[1] }
    if (-not $supaKey -and $_ -match '^\s*SUPABASE_ANON_KEY\s*=\s*(.+?)\s*$') { $supaKey = $Matches[1] }
  }
}
if (-not $supaUrl -or -not $supaKey) { throw "Set SUPABASE_URL and SUPABASE_ANON_KEY (env or repo-root .env)" }

function New-Secret64 {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([BitConverter]::ToString($bytes)).Replace('-', '')
}
$jwtAccess  = New-Secret64
$jwtRefresh = New-Secret64

kubectl create secret generic taskflow-secrets -n taskflow `
  --from-literal=SUPABASE_URL=$supaUrl `
  --from-literal=SUPABASE_ANON_KEY=$supaKey `
  --from-literal=JWT_ACCESS_SECRET=$jwtAccess `
  --from-literal=JWT_REFRESH_SECRET=$jwtRefresh `
  --dry-run=client -o yaml | kubectl apply -f -

Write-Host "==> Applying redis + api + worker" -ForegroundColor Cyan
kubectl apply -f "$here\redis.yaml"
kubectl apply -f "$here\api.yaml"
kubectl apply -f "$here\worker.yaml"

Write-Host "==> Waiting for rollouts" -ForegroundColor Cyan
kubectl rollout status deployment/redis -n taskflow --timeout=120s
kubectl rollout status deployment/taskflow-api -n taskflow --timeout=180s
kubectl rollout status deployment/taskflow-worker -n taskflow --timeout=120s

Write-Host "`n==> Done. Pods:" -ForegroundColor Green
kubectl get pods -n taskflow -o wide
Write-Host "`nService URL:" -ForegroundColor Green
& minikube service taskflow-api -n taskflow --url
