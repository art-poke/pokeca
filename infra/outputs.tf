output "healthcheck_url" {
  value       = aws_lambda_function_url.healthcheck.function_url
  description = "헬스체크 Lambda 공개 URL (/에 접속 → DB OK)"
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "s3_uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}
