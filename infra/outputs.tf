output "apprunner_url" {
  value       = var.enable_app_runner ? "https://${aws_apprunner_service.main[0].service_url}" : "(enable_app_runner=false)"
  description = "App Runner 공개 URL"
}

output "apprunner_service_arn" {
  value       = var.enable_app_runner ? aws_apprunner_service.main[0].arn : ""
  description = "App Runner 서비스 ARN(상태 폴링용)"
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
