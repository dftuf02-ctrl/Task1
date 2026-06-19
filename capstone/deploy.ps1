# Capstone deploy: 2 services behind NGINX Ingress, async via Redis Streams,
# deployed to minikube VIA TERRAFORM, hardened + audited.
#   pwsh -File capstone/deploy.ps1
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$root = Split-Path -Parent $here
Set-Alias minikube "C:\Program Files\Kubernetes\Minikube\minikube.exe" -ErrorAction SilentlyContinue

Write-Host "==> minikube up (calico CNI enforces NetworkPolicies)" -ForegroundColor Cyan
& minikube status *> $null
if ($LASTEXITCODE -ne 0) { & minikube start --driver=docker --cpus=2 --memory=3000 --cni=calico }
& minikube addons enable ingress | Out-Null

Write-Host "==> build + load capstone image" -ForegroundColor Cyan
docker build -t taskflow-api:cap "$root\backend"
& minikube image load taskflow-api:cap

Write-Host "==> Supabase creds -> TF_VAR (from repo-root .env; nothing hardcoded)" -ForegroundColor Cyan
# Pods run NODE_ENV=production, which requires the service-role key - the
# backend refuses to start on the anon key (src/config/env.js). Wire the
# service-role key through, or the services CrashLoopBackOff at startup.
Get-Content "$root\.env" | ForEach-Object {
  if ($_ -match '^\s*SUPABASE_URL\s*=\s*(.+?)\s*$')               { $env:TF_VAR_supabase_url = $Matches[1] }
  if ($_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+?)\s*$')  { $env:TF_VAR_supabase_service_role_key = $Matches[1] }
}
if (-not $env:TF_VAR_supabase_url -or -not $env:TF_VAR_supabase_service_role_key) {
  throw "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in repo-root .env - NODE_ENV=production requires the service-role key"
}

Write-Host "==> terraform apply (namespace + config + secret + workloads)" -ForegroundColor Cyan
$tf = (Get-Command terraform -ErrorAction SilentlyContinue).Source
if (-not $tf) { $tf = "C:\Users\mihir\AppData\Local\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe" }
& $tf -chdir="$here\terraform" init -input=false
& $tf -chdir="$here\terraform" apply -auto-approve -input=false

Write-Host "==> wait for rollouts" -ForegroundColor Cyan
kubectl rollout status deployment/redis -n taskflow-cap --timeout=120s
kubectl rollout status deployment/tasks-service -n taskflow-cap --timeout=180s
kubectl rollout status deployment/reports-service -n taskflow-cap --timeout=180s

Write-Host "`n==> Pods:" -ForegroundColor Green
kubectl get pods -n taskflow-cap -o wide
Write-Host "`n==> Gateway:" -ForegroundColor Green
kubectl get ingress -n taskflow-cap
Write-Host "Access via: minikube tunnel  (then curl the ingress host)" -ForegroundColor Green
