# TaskFlow on Kubernetes (minikube)

Deploys the API + worker + Redis to a local minikube cluster, with config in a
ConfigMap, secrets in a Secret, health-checked pods, a zero-downtime rolling
update, and 3 load-balanced replicas.

## Contents

| File | Purpose |
|---|---|
| `namespace.yaml` | `taskflow` namespace |
| `configmap.yaml` | Non-secret runtime config (ports, Redis URL, rate limits, `APP_VERSION`) |
| `secret.example.yaml` | **Template only** — the real Secret is created at deploy time, never committed |
| `redis.yaml` | Redis Deployment + ClusterIP Service (queue + rate limiting) |
| `api.yaml` | API Deployment (3 replicas, rolling update, probes) + NodePort Service |
| `worker.yaml` | Background worker Deployment |
| `deploy.ps1` | One-command deploy |
| `prove.ps1` | Proves load-balancing + zero-downtime rollout |

## Prerequisites
- Docker Desktop, `minikube`, `kubectl`
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` available as env vars or in the repo-root `.env`

## Deploy
```powershell
pwsh -File k8s/deploy.ps1
```
This starts minikube, builds `taskflow-api:k8s`, loads it into the cluster,
applies the manifests, creates the Secret (Supabase creds from env/.env, JWT
secrets generated on the fly), and waits for all rollouts.

## The four requirements, and how each is met

**Deployment / Service / ConfigMap / Secret** — `api.yaml` (+ `worker.yaml`,
`redis.yaml`) define Deployments and Services; `configmap.yaml` holds non-secret
config injected via `envFrom.configMapRef`; the Secret is injected via
`envFrom.secretRef`. No plaintext secret lives in the repo — `deploy.ps1` creates
it imperatively and generates the JWT secrets.

**Health checks** — each API pod has:
- `readinessProbe: httpGet /health` — `/health` returns **503 when the DB is
  unreachable**, so an unhealthy pod is removed from the Service endpoints (no
  traffic) until it recovers.
- `livenessProbe: tcpSocket :3001` — process-alive only, deliberately decoupled
  from the DB so a transient Supabase blip never restarts a pod.

**Zero-downtime rolling update** — `strategy.rollingUpdate` with
`maxUnavailable: 0, maxSurge: 1`: a new pod is added and must pass readiness
*before* an old one is removed. Trigger it by bumping `APP_VERSION`:
```powershell
kubectl set env deployment/taskflow-api -n taskflow APP_VERSION=v2
kubectl rollout status deployment/taskflow-api -n taskflow
```

**Scale to 3 + load-balance** — `replicas: 3`; the `X-Pod-Name` response header
(pod name via the downward API) makes the spread visible:
```powershell
kubectl scale deployment/taskflow-api -n taskflow --replicas=3
pwsh -File k8s/prove.ps1
```
`prove.ps1` fires 90 requests at the ClusterIP Service from inside the cluster
(so kube-proxy load-balances) and tallies how many each pod served, then runs a
~600-request load loop *during* a rollout and reports `FAIL=0`.

## Access the API
```powershell
minikube service taskflow-api -n taskflow --url   # opens a tunnel, prints a URL
# or:
kubectl port-forward service/taskflow-api -n taskflow 8081:80
```

## Teardown
```powershell
kubectl delete namespace taskflow
minikube stop          # or: minikube delete  (removes the cluster entirely)
```
