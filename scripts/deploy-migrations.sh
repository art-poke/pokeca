#!/usr/bin/env bash
# Package the release's SQL migrations and run them inside the RDS VPC.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
account="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$account" != "138681986450" ]]; then
  echo "Expected the art-poke production account." >&2
  exit 1
fi

stage="$(mktemp -d)"
trap 'rm -r -- "$stage"' EXIT
mkdir -p "$stage/code/sql"
cp "$root"/infra/lambda-migrate/{index.mjs,migrate.mjs,package.json,package-lock.json} "$stage/code/"
cp -R "$root/infra/db/." "$stage/code/sql/"
npm ci --omit=dev --prefix "$stage/code"
(cd "$stage/code" && zip -qr "$stage/migrate.zip" .)

bucket="pokeca-assets-$account"
key="lambda/github/migrate/${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}.zip"
aws s3 cp "$stage/migrate.zip" "s3://$bucket/$key" --no-progress
aws lambda update-function-code --function-name pokeca-migrate --s3-bucket "$bucket" --s3-key "$key" \
  --query CodeSha256 --output text
aws lambda wait function-updated --function-name pokeca-migrate
aws lambda invoke --function-name pokeca-migrate --invocation-type RequestResponse --cli-read-timeout 90 \
  "$stage/response.json" --output json > "$stage/invoke.json"

# Successful Lambda transport can still carry a function exception or a failed DB migration.
node --input-type=module - "$stage/invoke.json" "$stage/response.json" <<'JS'
import { readFileSync } from "node:fs";
const [invokeFile, responseFile] = process.argv.slice(2);
const invocation = JSON.parse(readFileSync(invokeFile, "utf8"));
const response = JSON.parse(readFileSync(responseFile, "utf8"));
if (invocation.StatusCode !== 200 || invocation.FunctionError || response.statusCode !== 200) {
  console.error("Production database migration failed:", response.body ?? response.errorMessage ?? invocation.FunctionError ?? response);
  process.exit(1);
}
const result = JSON.parse(response.body);
console.log("Applied migrations:", result.applied.length ? result.applied.join(", ") : "none");
JS
