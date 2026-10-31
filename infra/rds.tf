resource "random_password" "db" {
  length  = 24
  special = false # URL/JSON 취급 편의상 특수문자 제외
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"

  # 프리티어 조건: 신규 계정·단일 AZ·gp2·20GB.
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  storage_type        = "gp2"
  multi_az            = false
  publicly_accessible = false

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  skip_final_snapshot = true # Phase 1 골대라 스냅샷 생략(비용·속도). 운영 전환 시 false로.
  deletion_protection = false
  apply_immediately   = true # Phase 1: 변경 즉시 반영(유지보수 창 대기 안 함).

  # auto_minor_version_upgrade(기본 true)가 마이너를 올리면 다음 plan에 허위 드리프트가
  # 생긴다. Phase 1은 메이저만 고정하고 마이너 변화는 무시.
  lifecycle {
    ignore_changes = [engine_version]
  }

  tags = { Name = "${var.project_name}-db" }
}
