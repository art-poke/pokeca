variable "project_name" {
  type    = string
  default = "pokeca"
}

# App Runner가 서울(ap-northeast-2)에 없어서 도쿄(ap-northeast-1) 사용.
# RDS/ECR/S3/Cognito 전부 도쿄로 통일(App Runner VPC Connector는 같은 리전만 됨).
variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "db_name" {
  type    = string
  default = "pokeca"
}

variable "db_username" {
  type    = string
  default = "pokeca_admin"
}
