# API Gateway HTTP API → Lambda (OpenNext server/image).
# Function URL 대신 API Gateway를 쓰는 이유:
#  - artpoke 신규계정은 public(auth=NONE) Function URL을 403 차단.
#  - OAC+Function URL(IAM)은 POST body 미서명으로 POST(서버액션/API) 403.
#  API Gateway HTTP API는 두 제약이 없고, payload v2 이벤트가 OpenNext(Function URL과 동일 포맷) 호환.
#  CloudFront가 앞단. (직접 접근 차단은 후속: CloudFront 커스텀헤더 + proxy 검증.)

# server
resource "aws_apigatewayv2_api" "server" {
  name          = "${var.project_name}-server"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "server" {
  api_id                 = aws_apigatewayv2_api.server.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.app_server.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_route" "server" {
  api_id    = aws_apigatewayv2_api.server.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.server.id}"
}

resource "aws_apigatewayv2_stage" "server" {
  api_id      = aws_apigatewayv2_api.server.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_server" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app_server.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.server.execution_arn}/*/*"
}

# image
resource "aws_apigatewayv2_api" "image" {
  name          = "${var.project_name}-image"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "image" {
  api_id                 = aws_apigatewayv2_api.image.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.app_image.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_route" "image" {
  api_id    = aws_apigatewayv2_api.image.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.image.id}"
}

resource "aws_apigatewayv2_stage" "image" {
  api_id      = aws_apigatewayv2_api.image.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_image" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.app_image.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.image.execution_arn}/*/*"
}
