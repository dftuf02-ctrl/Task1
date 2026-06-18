# ── S3 bucket for report artifacts (real on free LocalStack) ──
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project}-report-artifacts"
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}
