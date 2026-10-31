resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  # Phase 1은 빈 풀. Phase 2에서 로그인 흐름 연결.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_uppercase = true
    require_symbols   = false
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name            = "${var.project_name}-web"
  user_pool_id    = aws_cognito_user_pool.main.id
  generate_secret = false # 브라우저/SSR 공개 클라이언트
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]
}
