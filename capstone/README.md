# Capstone — TaskFlow multi-service system

A small multi-service system assembled from everything in the prior projects,
with **security and audit logging treated as hard requirements** (defence
context).

## Architecture
```
                      ┌──────────────── NGINX Ingress (API gateway) ────────────────┐
   client ──▶ :80 ───▶│  /api/v1/auth, /api/v1/tasks → tasks-service                 │
                      │  /api/v1/reports             → reports-service               │
                      └───────┬───────────────────────────────────┬─────────────────┘
                              │  publish task.created/updated/deleted   │
                       Redis Stream "taskflow:events"  ──(XREADGROUP)──▶ reports-service consumer
   Cross-cutting: Prometheus /metrics on both services · append-only AUDIT log ·
   default-deny NetworkPolicies · non-root/read-only/drop-caps pods · per-service ServiceAccounts
```
Both services run from **one image** (`taskflow-api:cap`) with a `SERVICE_ROLE`
selector (`tasks` | `reports`) — one build to scan, two independently-deployed,
independently-scaled services with **distinct identities and network policy**.

## Requirement → implementation

| Capstone requirement | How it's met | Where |
|---|---|---|
| **2–3 services** | tasks-service + reports-service (role-split one image) | `k8s/40,50`, `backend/src/routes/index.js` |
| **API gateway** | NGINX Ingress routes by path | `k8s/60-ingress.yaml` |
| **Async messaging** | Redis Streams: tasks publishes, reports consumes (consumer group, at-least-once) | `backend/src/events/*` |
| **Full CI/CD** | test → secret-scan → build → **Trivy gate** → SBOM → deploy | `.github/workflows/capstone-ci-cd.yml` |
| **Terraform → Kubernetes** | TF owns namespace/config/secret + rolls out workloads | `capstone/terraform/` |
| **Monitoring** | both services expose Prometheus `/metrics`; reuse Grafana RED dashboard | `backend/src/config/metrics.js` |
| **Secrets management** | k8s Secret from TF (Supabase from vars, JWT generated); never in code/image | `terraform/main.tf`, `.dockerignore` |
| **Container scanning** | Trivy fs + image scan, **fail on HIGH/CRITICAL**; Gitleaks secret scan; SBOM artifact | CI workflow |
| **Least privilege** | per-service ServiceAccounts (no RBAC, token not mounted); non-root, read-only rootfs, drop ALL caps, seccomp; PSS `restricted`; default-deny NetworkPolicies | `k8s/00,10,40,50,70` |
| **Audit logging (hard req)** | tamper-evident audit events (HMAC-SHA256 hash chain) on every authn / authz-deny / data mutation / event-consume; verify with `npm run verify:audit` | `backend/src/utils/audit.js`, `backend/scripts/verify-audit.js` |

## Audit logging (defence hard requirement)
A dedicated audit logger (separate from app logs) emits one-line JSON records:
`{ category:"AUDIT", action, result, actor{id,role}, resource{type,id}, ip,
method, path, requestId, timestamp }`. Coverage:
- `auth.login` SUCCESS/FAILURE, `auth.signup`
- `authz.deny` — every cross-user access attempt (the IDOR-protection points)
- `task.create` / `task.update` / `task.delete`
- `event.consume` — every async event the reports-service processes

**Tamper-evident:** records are linked in an HMAC-SHA256 hash chain — each
carries `seq`, `prevHash`, and `hash = HMAC(key, prevHash + canonical(record))`,
and the key is never written to the log. Editing, deleting, inserting, or
reordering any record breaks the chain and is caught by the verifier:

```
kubectl logs -n taskflow-cap -l app=tasks-service | node backend/scripts/verify-audit.js
# OK — N audit record(s) across M chain(s) verified intact.   (exit 0)
# TAMPER DETECTED — ...                                        (exit 1)
```

Each process emits its own chain (`chainId`); the verifier checks each
independently. Hash-chaining detects mutation/reordering within a chain — to
also detect tail-truncation, anchor the latest `hash` in an external append-only
store. The `requestId` correlates an audit record to the full request trace.

## Security pass summary
- **Supply chain:** Trivy (deps + image) gates the build; Gitleaks blocks
  committed secrets; CycloneDX SBOM kept as an artifact.
- **Runtime:** non-root (uid 1000), `readOnlyRootFilesystem`, `drop: [ALL]`,
  `allowPrivilegeEscalation: false`, seccomp `RuntimeDefault`; namespace under
  PSS `restricted`.
- **Identity:** each service has its own ServiceAccount with **no** API
  permissions and `automountServiceAccountToken: false`.
- **Network:** default-deny ingress+egress; only ingress→services, services→
  redis, and services→DNS/HTTPS(Supabase) allowed. (Enforced with
  `--cni=calico`.)
- **Secrets:** never in source or image; injected from a TF-managed k8s Secret.

## Deploy
```powershell
pwsh -File capstone/deploy.ps1
```
Starts minikube (calico CNI + ingress addon), builds & loads the image,
`terraform apply` provisions namespace/config/secret + rolls out the workloads,
and waits for the rollouts.

## Verify
```powershell
kubectl get pods -n taskflow-cap -o wide                      # 2 tasks + 2 reports + redis
kubectl get ingress,networkpolicy,serviceaccount -n taskflow-cap
# audit trail:
kubectl logs -n taskflow-cap -l app=tasks-service | Select-String '"category":"AUDIT"'
# async path (reports consumed events):
kubectl logs -n taskflow-cap -l app=reports-service | Select-String 'consumed event'
```

## Notes
- NetworkPolicies require a policy-aware CNI; `deploy.ps1` starts minikube with
  `--cni=calico`. On the default CNI the policies are declared but not enforced.
- Trivy/Gitleaks run in CI (GitHub Actions); they can also be run locally with
  the Trivy CLI against `taskflow-api:cap`.
