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

# App Runner VPC Connector가 붙는 보안그룹(egress만).
resource "aws_security_group" "apprunner" {
  name        = "${var.project_name}-apprunner-sg"
  description = "App Runner VPC connector egress"
  vpc_id      = aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project_name}-apprunner-sg" }
}

# RDS 보안그룹: App Runner SG에서 오는 5432만 허용.
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Postgres from App Runner only"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner.id]
  }
  tags = { Name = "${var.project_name}-rds-sg" }
}
