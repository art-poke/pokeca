# 퍼블릭 서브넷 + IGW + NAT 인스턴스(fck-nat).
# VPC Lambda(사설 서브넷)가 카카오·구글 토큰 교환을 위해 인터넷으로 나가는 경로.
# NAT Gateway(월 ~4만) 대신 NAT 인스턴스(t4g.nano ~월3천). 저트래픽이라 단일 인스턴스 수용.

# 퍼블릭 서브넷 2개 (NAT는 [0]에 둔다). 10.0.101/102.0/24.
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 101)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.project_name}-public-${count.index}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# fck-nat 최신 arm64 AMI(most_recent). ⚠️ 2026-11 최신은 1.4.0-20260701(CVE-2026-98432 영향) —
# egress 전용 인스턴스라 노출 낮음(결정로그 ADR-A4 참조), 패치 AMI 공개 시 교체.
data "aws_ami" "fck_nat" {
  most_recent = true
  owners      = ["568608671756"]
  filter {
    name   = "name"
    values = ["fck-nat-al2023-hvm-*-arm64-ebs"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_security_group" "nat" {
  name        = "${var.project_name}-nat-sg"
  description = "NAT instance - forward from private subnets"
  vpc_id      = aws_vpc.main.id
  ingress {
    description = "all from VPC (private subnets egress)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.project_name}-nat-sg" }
}

resource "aws_instance" "nat" {
  ami                         = data.aws_ami.fck_nat.id
  instance_type               = "t4g.nano"
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.nat.id]
  associate_public_ip_address = true
  source_dest_check           = false # NAT는 자기 목적지 아닌 패킷을 포워딩하므로 꺼야 함
  tags                        = { Name = "${var.project_name}-nat" }
}

resource "aws_eip" "nat" {
  instance = aws_instance.nat.id
  domain   = "vpc"
  tags     = { Name = "${var.project_name}-nat-eip" }
}

# 사설 서브넷의 인터넷 경로를 NAT 인스턴스로.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = aws_instance.nat.primary_network_interface_id
  }
  tags = { Name = "${var.project_name}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
