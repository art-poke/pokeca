#!/usr/bin/env bash
# 서브 A 배포: OpenNext 빌드 → Lambda zip → assets S3 sync → terraform apply → CloudFront 무효화.
# 로컬은 artpoke 프로필, GitHub Actions는 OIDC 임시 자격 증명을 사용한다.
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  export AWS_PROFILE=artpoke
fi
ACC=$(aws sts get-caller-identity --query Account --output text)
[ "$ACC" = "138681986450" ] || { echo "❌ 계정이 artpoke(138681986450)가 아님: $ACC"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ 1. OpenNext 빌드"
npx open-next build

echo "▶ 2. Lambda zip (심볼릭 보존 — archive_file은 OpenNext 심볼릭 못 다룸)"
rm -f infra/app-server.zip infra/app-image.zip
# .cache(로컬 SNKRDUNK 이미지 등)는 번들에서 제외 — S3로 서빙하므로 Lambda에 넣을 필요 없다(콜드스타트·용량).
( cd .open-next/server-functions/default && zip -ryq "$ROOT/infra/app-server.zip" . -x '.cache/*' )
( cd .open-next/image-optimization-function && zip -ryq "$ROOT/infra/app-image.zip" . )

ASSETS="pokeca-assets-${ACC}"

echo "▶ 3. assets S3 sync"
aws s3 sync .open-next/assets "s3://${ASSETS}/" --exclude "_next/static/*" \
  --cache-control "public,max-age=0,s-maxage=31536000,must-revalidate" --no-progress
aws s3 sync .open-next/assets/_next/static "s3://${ASSETS}/_next/static" \
  --cache-control "public,max-age=31536000,immutable" --no-progress

echo "▶ 4. Lambda 배포"
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  DIST="${CLOUDFRONT_DISTRIBUTION_ID:?CloudFront 배포 ID 필요}"
  for name in app-image app-server; do
    function_name="pokeca-$name"
    key="lambda/github/$name.zip"
    aws s3 cp "infra/$name.zip" "s3://$ASSETS/$key" --no-progress
    aws lambda update-function-code --function-name "$function_name" \
      --s3-bucket "$ASSETS" --s3-key "$key" --query CodeSha256 --output text
    aws lambda wait function-updated --function-name "$function_name"
  done
else
  aws s3 cp infra/app-server.zip "s3://${PROJECT_NAME:-pokeca}-assets-${ACC}/lambda/app-server.zip" --no-progress
  terraform -chdir=infra apply -input=false -auto-approve
  DIST=$(terraform -chdir=infra output -raw cloudfront_distribution_id)
fi

echo "▶ 5. CloudFront 캐시 무효화"
INVALIDATION=$(aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" \
  --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DIST" --id "$INVALIDATION"

echo "✅ 배포 완료: https://artpokeca.com"
