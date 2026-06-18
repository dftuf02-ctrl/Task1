# ── Compute (the part that actually runs) ─────────────────────
# Builds the app image from ../backend and runs api + worker + redis as
# real containers on a Terraform-managed docker network. Secrets are
# injected from the same Terraform values written to Secrets Manager;
# because they derive from sensitive vars / random_password, Terraform
# redacts them from plan output. No secret literal lives in any file.

resource "docker_network" "main" {
  name = "${var.project}-net"
}

# App image — built OUT OF BAND (by CI or `docker build`) and referenced
# here, not built inside Terraform. Building images inside the docker
# provider is both unreliable on some hosts and not how real pipelines
# work: CI builds + scans + pushes the image, Terraform deploys it. The
# data source just looks up the existing local image by tag.
data "docker_image" "api" {
  name = var.api_image
}

resource "docker_image" "redis" {
  name = "redis:7-alpine"
  # Shared base image — never delete it on destroy (other stacks may use it).
  keep_locally = true
}

# ── Redis (queue + rate limiting) ─────────────────────────────
resource "docker_container" "redis" {
  name    = "${var.project}-redis"
  image   = docker_image.redis.image_id
  restart = "unless-stopped"

  networks_advanced {
    name    = docker_network.main.name
    aliases = ["redis"]
  }

  healthcheck {
    test     = ["CMD", "redis-cli", "ping"]
    interval = "10s"
    timeout  = "3s"
    retries  = 3
  }
}

# ── API server ────────────────────────────────────────────────
resource "docker_container" "api" {
  name    = "${var.project}-api"
  image   = data.docker_image.api.id
  restart = "unless-stopped"

  env = [
    "PORT=3001",
    "NODE_ENV=${var.node_env}",
    "SUPABASE_URL=${var.supabase_url}",
    "SUPABASE_ANON_KEY=${var.supabase_anon_key}",
    "CORS_ORIGIN=${var.cors_origin}",
    "REDIS_URL=redis://redis:6379",
    "JWT_ACCESS_SECRET=${random_password.jwt_access.result}",
    "JWT_REFRESH_SECRET=${random_password.jwt_refresh.result}",
    "RATE_LIMIT_WINDOW_MS=900000",
    "RATE_LIMIT_MAX=100",
    "AUTH_RATE_LIMIT_MAX=10",
    "LOG_LEVEL=info",
  ]

  ports {
    internal = 3001
    external = var.api_port
  }

  networks_advanced {
    name    = docker_network.main.name
    aliases = ["api"]
  }

  healthcheck {
    test         = ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
    interval     = "30s"
    timeout      = "5s"
    retries      = 3
    start_period = "10s"
  }

  depends_on = [docker_container.redis, aws_secretsmanager_secret_version.app]
}

# ── Background worker ─────────────────────────────────────────
resource "docker_container" "worker" {
  name    = "${var.project}-worker"
  image   = data.docker_image.api.id
  command = ["node", "worker.js"]
  restart = "unless-stopped"

  env = [
    "NODE_ENV=${var.node_env}",
    "SUPABASE_URL=${var.supabase_url}",
    "SUPABASE_ANON_KEY=${var.supabase_anon_key}",
    "REDIS_URL=redis://redis:6379",
    "JWT_ACCESS_SECRET=${random_password.jwt_access.result}",
    "JWT_REFRESH_SECRET=${random_password.jwt_refresh.result}",
    "REPORT_WORKER_CONCURRENCY=2",
    "REPORT_PROCESSING_DELAY_MS=3000",
    "WORKER_METRICS_PORT=9101",
    "LOG_LEVEL=info",
  ]

  networks_advanced {
    name    = docker_network.main.name
    aliases = ["worker"]
  }

  depends_on = [docker_container.redis, aws_secretsmanager_secret_version.app]
}
