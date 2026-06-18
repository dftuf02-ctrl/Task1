output "vpc_id" {
  description = "ID of the provisioned VPC."
  value       = aws_vpc.main.id
}

output "app_security_group_id" {
  value       = aws_security_group.app.id
  description = "App-tier security group id."
}

output "redis_security_group_id" {
  value       = aws_security_group.redis.id
  description = "Redis-tier security group id."
}

output "secret_arn" {
  description = "ARN of the app secret in Secrets Manager."
  value       = aws_secretsmanager_secret.app.arn
}

output "artifacts_bucket" {
  description = "S3 bucket for report artifacts."
  value       = aws_s3_bucket.artifacts.bucket
}

output "api_url" {
  description = "Local URL the API is served on."
  value       = "http://localhost:${var.api_port}"
}

output "api_health_url" {
  value       = "http://localhost:${var.api_port}/health"
  description = "API health endpoint."
}

output "docker_network" {
  description = "Name of the docker network the containers run on."
  value       = docker_network.main.name
}
