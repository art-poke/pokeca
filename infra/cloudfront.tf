# CloudFront: OpenNext 앱 입구. 기본 도메인(*.cloudfront.net).
# 오리진: server Lambda(기본/SSR/API), image Lambda(/_next/image), S3 assets(정적). 전부 OAC(비공개).

locals {
  server_host = replace(replace(aws_lambda_function_url.app_server.function_url, "https://", ""), "/", "")
  image_host  = replace(replace(aws_lambda_function_url.app_image.function_url, "https://", ""), "/", "")
}

# viewer-request: OpenNext 서버가 host로 쓰도록 x-forwarded-host 주입(없으면 Auth.js 콜백/세션 깨짐).
resource "aws_cloudfront_function" "xfh" {
  name    = "${var.project_name}-xfh"
  runtime = "cloudfront-js-2.0"
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      request.headers["x-forwarded-host"] = { value: request.headers.host.value };
      return request;
    }
  JS
}

resource "aws_cloudfront_origin_access_control" "lambda" {
  name                              = "${var.project_name}-oac-lambda"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.project_name}-oac-s3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 관리형 정책.
data "aws_cloudfront_cache_policy" "disabled" { name = "Managed-CachingDisabled" }
data "aws_cloudfront_cache_policy" "optimized" { name = "Managed-CachingOptimized" }
data "aws_cloudfront_origin_request_policy" "all_except_host" { name = "Managed-AllViewerExceptHostHeader" }

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = "${var.project_name} app"
  price_class     = "PriceClass_200" # 북미/유럽/아시아(한국 포함). 전세계(All)보다 저렴.
  http_version    = "http2and3"
  is_ipv6_enabled = true

  origin {
    origin_id                = "server"
    domain_name              = local.server_host
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda.id
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  origin {
    origin_id                = "image"
    domain_name              = local.image_host
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda.id
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  origin {
    origin_id                = "assets"
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # 기본: SSR/API → server Lambda. x-forwarded-host 주입, 쿠키/헤더 전달(Host 제외), 캐시 안 함.
  default_cache_behavior {
    target_origin_id         = "server"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.xfh.arn
    }
  }

  # /_next/image* → image Lambda
  ordered_cache_behavior {
    path_pattern             = "/_next/image*"
    target_origin_id         = "image"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.xfh.arn
    }
  }

  # /_next/data/* → server (SSR 데이터). /_next/* 보다 먼저.
  ordered_cache_behavior {
    path_pattern             = "/_next/data/*"
    target_origin_id         = "server"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.xfh.arn
    }
  }

  # 정적 → S3 assets (장기 캐시).
  dynamic "ordered_cache_behavior" {
    for_each = ["/_next/*", "/specs/*", "/favicon.ico", "*.svg", "/BUILD_ID"]
    content {
      path_pattern           = ordered_cache_behavior.value
      target_origin_id       = "assets"
      viewer_protocol_policy  = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# S3 assets: 이 배포 OAC만 읽기.
data "aws_iam_policy_document" "assets" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.app.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = data.aws_iam_policy_document.assets.json
}

# 이 배포가 Function URL을 sigv4로 호출하도록 허용.
resource "aws_lambda_permission" "cf_server" {
  statement_id           = "AllowCloudFront"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app_server.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.app.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cf_image" {
  statement_id           = "AllowCloudFront"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app_image.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.app.arn
  function_url_auth_type = "AWS_IAM"
}

# OAC+Lambda Function URL은 InvokeFunctionUrl 외에 lambda:InvokeFunction 권한도 필요하다(AWS 문서).
# 이게 없으면 CloudFront sigv4 요청이 403 Forbidden.
resource "aws_lambda_permission" "cf_server_invoke" {
  statement_id  = "AllowCloudFrontInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app_server.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.app.arn
}

resource "aws_lambda_permission" "cf_image_invoke" {
  statement_id  = "AllowCloudFrontInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app_image.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.app.arn
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.app.domain_name
}
