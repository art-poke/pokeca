# 헬스체크 Lambda 배포 패키지(zip). lambda-healthcheck/ 디렉터리 통째로 압축.
# (pg 모듈 포함 — 먼저 그 디렉터리에서 `npm install` 필요)
data "archive_file" "healthcheck" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-healthcheck"
  output_path = "${path.module}/lambda-healthcheck.zip"
}

resource "aws_lambda_function" "healthcheck" {
  function_name    = "${var.project_name}-healthcheck"
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.healthcheck.output_path
  source_code_hash = data.archive_file.healthcheck.output_base64sha256
  timeout          = 15
  memory_size      = 256

  # RDS(사설 서브넷)에 닿으려면 Lambda도 같은 VPC에 ENI를 둔다.
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  # VPC Lambda는 인터넷/AWS API에 못 나가므로(NAT 없음) 시크릿을 런타임에 못 당긴다.
  # Phase 1: DB 자격증명을 배포 시 환경변수로 주입(값은 암호화된 TF state/Lambda env에만).
  # Phase 2: VPC 엔드포인트 추가 후 Secrets Manager 런타임 조회로 승격 권장.
  environment {
    variables = {
      DB_HOST = aws_db_instance.main.address
      DB_PORT = tostring(aws_db_instance.main.port)
      DB_USER = aws_db_instance.main.username
      DB_PASS = random_password.db.result
      DB_NAME = aws_db_instance.main.db_name
    }
  }
}

# 마이그레이션 Lambda: sql/*.sql을 RDS에 적용(invoke 전용, Function URL 없음).
# RDS가 사설망이라 VPC 안에서 실행. sql/은 빌드 시 ../db 에서 복사.
data "archive_file" "migrate" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-migrate"
  output_path = "${path.module}/lambda-migrate.zip"
}

resource "aws_lambda_function" "migrate" {
  function_name    = "${var.project_name}-migrate"
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.migrate.output_path
  source_code_hash = data.archive_file.migrate.output_base64sha256
  timeout          = 60
  memory_size      = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST = aws_db_instance.main.address
      DB_PORT = tostring(aws_db_instance.main.port)
      DB_USER = aws_db_instance.main.username
      DB_PASS = random_password.db.result
      DB_NAME = aws_db_instance.main.db_name
    }
  }
}

# 공개 HTTPS 입구(무료). ALB 불필요 — Lambda 서비스가 입구·분배 내장.
resource "aws_lambda_function_url" "healthcheck" {
  function_name      = aws_lambda_function.healthcheck.function_name
  authorization_type = "NONE"
}

# authorization_type=NONE(공개)이라도 Terraform에선 공개 호출 권한을 명시해야 함
# (콘솔은 자동 추가, Terraform은 수동). 없으면 Function URL이 403 Forbidden.
resource "aws_lambda_permission" "healthcheck_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.healthcheck.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
