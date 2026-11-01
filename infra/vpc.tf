data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "${var.project_name}-vpc" }
}

# 사설 서브넷 2개(RDS 서브넷그룹은 서로 다른 AZ 2개 이상 필요).
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 1)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = { Name = "${var.project_name}-private-${count.index}" }
}

# Lambda(VPC 연결)가 붙는 보안그룹(egress만).
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Lambda VPC egress"
  vpc_id      = aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project_name}-lambda-sg" }
}

# RDS 보안그룹: 이제 Lambda SG에서 오는 5432만 허용(ingress만 in-place 교체).
# description은 원래 값 유지 — AWS SG description은 수정 불가라 바꾸면 SG 전체가
# 교체되고, RDS에 ENI가 붙어 있어 교체가 실패/사이클을 유발한다. 문구는 코멘트 수준.
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Postgres from App Runner only"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }
  tags = { Name = "${var.project_name}-rds-sg" }
}
