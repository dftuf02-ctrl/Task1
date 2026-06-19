terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.30" }
    random     = { source = "hashicorp/random", version = "~> 3.0" }
    null       = { source = "hashicorp/null", version = "~> 3.0" }
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig
  config_context = var.kube_context
}

# ── Namespace (Pod Security Standard: restricted) ─────────────
resource "kubernetes_namespace" "cap" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/part-of"             = "taskflow-capstone"
      "pod-security.kubernetes.io/enforce"    = "restricted"
      "pod-security.kubernetes.io/warn"       = "restricted"
    }
  }
}

# ── Non-secret config ─────────────────────────────────────────
resource "kubernetes_config_map" "config" {
  metadata {
    name      = "taskflow-config"
    namespace = kubernetes_namespace.cap.metadata[0].name
  }
  data = {
    NODE_ENV             = "production"
    PORT                 = "3001"
    CORS_ORIGIN          = "http://localhost"
    REDIS_URL            = "redis://redis:6379"
    RATE_LIMIT_WINDOW_MS = "900000"
    RATE_LIMIT_MAX       = "100"
    AUTH_RATE_LIMIT_MAX  = "10"
    LOG_LEVEL            = "info"
    WORKER_METRICS_PORT  = "9101"
    PASSWORD_HASH        = "native"
  }
}

# ── Secrets (generated JWT; Supabase from sensitive vars) ─────
resource "random_password" "jwt_access" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

# Dedicated HMAC key for the tamper-evident audit hash-chain.
resource "random_password" "audit_hmac" {
  length  = 64
  special = false
}

resource "kubernetes_secret" "app" {
  metadata {
    name      = "taskflow-secrets"
    namespace = kubernetes_namespace.cap.metadata[0].name
  }
  type = "Opaque"
  data = {
    SUPABASE_URL              = var.supabase_url
    SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
    JWT_ACCESS_SECRET         = random_password.jwt_access.result
    JWT_REFRESH_SECRET        = random_password.jwt_refresh.result
    AUDIT_HMAC_KEY            = random_password.audit_hmac.result
  }
}

# ── Workload manifests (RBAC, redis, services, ingress, netpol) ─
# Terraform owns namespace/config/secret above; the workload YAML is rolled
# out here so the security manifests stay readable as plain k8s objects.
resource "null_resource" "workloads" {
  depends_on = [
    kubernetes_config_map.config,
    kubernetes_secret.app,
  ]
  triggers = {
    files = sha1(join("", [for f in fileset("${path.module}/../k8s", "*.yaml") :
      filesha1("${path.module}/../k8s/${f}") if f != "00-namespace.yaml" && f != "20-config.yaml"]))
  }
  provisioner "local-exec" {
    command = "kubectl --context ${var.kube_context} apply -f ${path.module}/../k8s/10-rbac.yaml -f ${path.module}/../k8s/30-redis.yaml -f ${path.module}/../k8s/40-tasks-service.yaml -f ${path.module}/../k8s/50-reports-service.yaml -f ${path.module}/../k8s/60-ingress.yaml -f ${path.module}/../k8s/70-networkpolicies.yaml"
  }
}
