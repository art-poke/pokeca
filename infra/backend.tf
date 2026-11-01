# ⚠️ 적용 전 할 일 (Task 10):
#   1) 상태 버킷을 1회 수동 생성 (닭-달걀: Terraform이 자기 백엔드 버킷을 못 만든다)
#        aws s3api create-bucket --bucket pokeca-tfstate-<suffix> \
#          --region ap-northeast-2 \
#          --create-bucket-configuration LocationConstraint=ap-northeast-2
#        aws s3api put-bucket-versioning --bucket pokeca-tfstate-<suffix> \
#          --versioning-configuration Status=Enabled
#   2) 아래 <suffix>를 본인 고유값(예: 계정ID 뒤 6자리)으로 바꾸고 `terraform init`
terraform {
  backend "s3" {
    bucket       = "pokeca-tfstate-138681986450"
    key          = "phase1/terraform.tfstate"
    region       = "ap-northeast-2"
    encrypt      = true
    use_lockfile = true # Terraform 1.10+ S3 네이티브 잠금(DynamoDB 불필요)
  }
}
