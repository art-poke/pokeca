resource "aws_secretsmanager_secret" "db" {
  name = "${var.project_name}/db"
}

# 컨테이너에 통째로 주입할 JSON. server.js가 파싱한다.
resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = aws_db_instance.main.username
    password = random_password.db.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = aws_db_instance.main.db_name
  })
}
