terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# ── AWS provider, pointed at LocalStack ───────────────────────
# Dummy credentials + skip_* flags mean we never touch a real AWS
# account and don't need the awslocal/tflocal wrappers — the standard
# hashicorp/aws provider talks straight to LocalStack on :4566.
provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    secretsmanager = var.localstack_endpoint
    s3             = var.localstack_endpoint
    ec2            = var.localstack_endpoint
    iam            = var.localstack_endpoint
    sts            = var.localstack_endpoint
    sqs            = var.localstack_endpoint
  }
}

# ── Docker provider ───────────────────────────────────────────
# The part of the stack that actually runs: builds the app image and
# runs api + worker + redis as real containers on a managed network.
provider "docker" {
  host = var.docker_host
}

provider "random" {}
