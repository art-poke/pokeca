# OpenNext 앱: server/image Lambda + 정적 assets S3 버킷.
# 빌드 산출물(.open-next/)은 `open-next build`로 생성(gitignore). Terraform이 zip→Lambda, assets→S3(cloudfront.tf에서 sync).

locals {
  # lib/db가 읽는 connectionString. random_password.db는 special=false라 URL 인코딩 불필요.
  # RDS는 SSL 필수(no pg_hba entry ... no encryption) → sslmode=no-verify(암호화하되 CA 미검증, VPC 내부).
  database_url = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}?sslmode=no-verify"
  app_env = {
    DATABASE_URL       = local.database_url
    AUTH_SECRET        = random_password.auth_secret.result
    AUTH_TRUST_HOST    = "true"
    AUTH_KAKAO_ID      = var.auth_kakao_id
    AUTH_KAKAO_SECRET  = var.auth_kakao_secret
    AUTH_GOOGLE_ID     = var.auth_google_id
    AUTH_GOOGLE_SECRET = var.auth_google_secret
    S3_BUCKET_UPLOADS  = aws_s3_bucket.uploads.bucket
    S3_BUCKET_EVIDENCE = aws_s3_bucket.evidence.bucket
    # AWS_REGION은 Lambda 예약 env라 주입 금지(런타임 자동 제공, storage-client가 읽음).
  }
}

resource "random_password" "auth_secret" {
  length  = 48
  special = false
}

# 정적 assets 버킷(비공개, CloudFront OAC로만 접근).
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 앱 Lambda 전용 역할: VPC + logs + S3(uploads/evidence). migrate/healthcheck 역할과 분리(최소권한).
resource "aws_iam_role" "app" {
  name               = "${var.project_name}-app"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "app_vpc" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "app_s3" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*", "${aws_s3_bucket.evidence.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.uploads.arn, aws_s3_bucket.evidence.arn]
  }
}

resource "aws_iam_role_policy" "app_s3" {
  name   = "${var.project_name}-app-s3"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_s3.json
}

# 산출물 zip은 deploy.sh가 `zip -ry`로 생성(archive_file은 OpenNext 심볼릭 링크를 못 다룸).
# app-server.zip / app-image.zip은 gitignore. plan/apply 전 반드시 존재해야 함.

resource "aws_lambda_function" "app_server" {
  function_name = "${var.project_name}-app-server"
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  role          = aws_iam_role.app.arn
  # 직접 zip 업로드는 70MB 한도(RequestEntityTooLarge). 번들이 커서 S3 경유로 올린다.
  # deploy.sh가 app-server.zip을 이 버킷/키로 업로드한 뒤 apply 한다.
  s3_bucket        = aws_s3_bucket.assets.id
  s3_key           = "lambda/app-server.zip"
  source_code_hash = filebase64sha256("${path.module}/app-server.zip")
  memory_size      = 1024
  timeout          = 30

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  environment {
    variables = local.app_env
  }
}

resource "aws_lambda_function" "app_image" {
  function_name    = "${var.project_name}-app-image"
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  role             = aws_iam_role.app.arn
  filename         = "${path.module}/app-image.zip"
  source_code_hash = filebase64sha256("${path.module}/app-image.zip")
  memory_size      = 1536
  timeout          = 30

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }
  environment {
    variables = local.app_env
  }
}

