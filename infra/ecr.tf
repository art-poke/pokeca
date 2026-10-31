resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-app"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # Phase 1 destroy 편의. 운영 전환 시 false로.
  image_scanning_configuration {
    scan_on_push = true
  }
}
