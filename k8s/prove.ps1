# Proves: 3 replicas, requests load-balance across them, and a rolling
# update happens with zero dropped requests.
#   pwsh -File k8s/prove.ps1
$ErrorActionPreference = "Stop"
$ns = "taskflow"

Write-Host "==> Scale to 3 replicas" -ForegroundColor Cyan
kubectl scale deployment/taskflow-api -n $ns --replicas=3 | Out-Null
kubectl rollout status deployment/taskflow-api -n $ns --timeout=120s
kubectl get pods -n $ns -l app=taskflow-api -o wide

Write-Host "`n==> LOAD-BALANCING: 90 requests through the ClusterIP Service" -ForegroundColor Cyan
# In-cluster so kube-proxy load-balances (a host port-forward would pin to one pod).
$loop = 'i=0; while [ $i -lt 90 ]; do curl -s -D - -o /dev/null http://taskflow-api/health | grep -i x-pod-name | cut -d" " -f2 | tr -d "\r"; i=$((i+1)); done'
$raw = kubectl run lbtest-$(Get-Random) --rm -i --restart=Never -n $ns --image=curlimages/curl:8.10.1 --command -- sh -c $loop
Write-Host "Requests served per pod:"
$raw -split "`n" | Where-Object { $_ -match 'taskflow-api' } | Group-Object | Sort-Object Count -Descending | ForEach-Object { "  {0,4} x  {1}" -f $_.Count, $_.Name }

Write-Host "`n==> ZERO-DOWNTIME: hammer the Service while a rolling update runs" -ForegroundColor Cyan
# Background in-cluster load: ~600 requests, prints one line per request: HTTP code.
$job = Start-Job {
  $loop = 'i=0; ok=0; fail=0; while [ $i -lt 600 ]; do c=$(curl -s -o /dev/null -w "%{http_code}" http://taskflow-api/health); if [ "$c" = "200" ]; then ok=$((ok+1)); else fail=$((fail+1)); fi; i=$((i+1)); done; echo "OK=$ok FAIL=$fail"'
  kubectl run zdt-load --rm -i --restart=Never -n taskflow --image=curlimages/curl:8.10.1 --command -- sh -c $loop
}
Start-Sleep -Seconds 3
Write-Host "Triggering rolling update (APP_VERSION bump)..."
kubectl set env deployment/taskflow-api -n $ns APP_VERSION=v2 | Out-Null
kubectl rollout status deployment/taskflow-api -n $ns --timeout=180s
$result = Receive-Job $job -Wait
Remove-Job $job
Write-Host "Load result during rollout: $result" -ForegroundColor Green
Write-Host "(FAIL=0 => zero downtime)" -ForegroundColor Green
