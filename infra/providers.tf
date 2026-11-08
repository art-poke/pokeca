provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}

# CloudFront용 ACM 인증서는 반드시 us-east-1(버지니아)에 발급해야 한다(CloudFront 요건).
# 리소스는 도쿄지만 이 alias 프로바이더로 인증서만 us-east-1에 만든다.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
