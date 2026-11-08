# 커스텀 도메인: artpokeca.com → CloudFront.
# ⚠️ 도메인 "등록" 자체는 Terraform이 못 한다(유료·연단위). Route53 콘솔/CLI로 먼저 등록하면
#    퍼블릭 호스팅존이 자동 생성된다. 이 파일은 등록 이후 단계:
#    ACM 인증서(us-east-1) + DNS 검증 + CloudFront alias(A/AAAA) 레코드.
#    → 등록 전에 apply하면 data.aws_route53_zone가 못 찾아 실패한다. 등록 먼저.

variable "domain_name" {
  type    = string
  default = "artpokeca.com"
}

# 도메인 등록 시 Route53가 자동 생성한 퍼블릭 호스팅존.
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# CloudFront용 인증서는 반드시 us-east-1.
resource "aws_acm_certificate" "app" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

# ACM DNS 검증 레코드(호스팅존에 CNAME 자동 추가).
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "app" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# apex(artpokeca.com) → CloudFront. IPv4/IPv6 둘 다.
resource "aws_route53_record" "apex_a" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

output "app_url" {
  value = "https://${var.domain_name}"
}
