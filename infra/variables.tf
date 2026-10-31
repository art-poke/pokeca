variable "project_name" {
  type    = string
  default = "pokeca"
}

variable "region" {
  type    = string
  default = "ap-northeast-2"
}

variable "db_name" {
  type    = string
  default = "pokeca"
}

variable "db_username" {
  type    = string
  default = "pokeca_admin"
}

# ECR 닭-달걀: 이미지 푸시 전에는 false로 apply(App Runner 생성 안 함),
# 푸시 후 true로 다시 apply.
variable "enable_app_runner" {
  type    = bool
  default = false
}
