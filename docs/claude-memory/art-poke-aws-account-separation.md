---
name: art-poke-aws-account-separation
description: art-poke AWS 작업 시 회사 계정과 개인 계정을 철저히 분리하는 안전 규칙 (필수 준수)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d360bfb1-232d-43e7-ac17-59614d64a82e
---

art-poke(개인 사이드프로젝트) AWS 작업은 **회사 계정(green-ribbon)과 철저히 분리**해야 한다. 사용자가 명시적으로 강하게 요구한 안전 제약.

**로컬 프로파일 상황:**
- `gr-readonly` = **회사(green-ribbon) 계정** → art-poke 세션에서 **절대 호출 금지**
- `default` = 자격증명 모호/무효였음 → **쓰지 말 것**(실수로 아무거나 걸리는 함정)
- `artpoke` = art-poke 개인 계정 전용 프로파일(사용자가 `aws configure --profile artpoke`로 생성)

**지킬 규칙:**
1. 모든 AWS CLI/MCP(call_aws) 호출에 `--profile artpoke` 명시. 빠뜨리지 말 것.
2. 프로파일 없는(=default) 명령 금지. `gr-readonly` 호출 금지.
3. 쓰기/생성 작업 전마다 `aws sts get-caller-identity --profile artpoke`로 계정 ID 검증 → 개인 계정 ID 아니면 즉시 중단.
4. Terraform은 `AWS_PROFILE=artpoke` 환경변수로 실행.
5. 비밀키(Access Key Secret)는 채팅/커밋에 절대 노출 금지.

**Why:** 회사 계정에 개인 사이드프로젝트 리소스를 만들거나 반대로 섞이면 비용·보안·거버넌스 사고. 되돌리기 어려움.
**How to apply:** art-poke AWS 관련 어떤 명령이든 실행 전 프로파일=artpoke + 계정 ID 개인 것인지 확인하고 진행.

**개인 계정 ID = `138681986450`** (유저 `leeyunjae`, ARN `arn:aws:iam::138681986450:user/leeyunjae`). art-poke 작업은 반드시 이 계정. `aws sts get-caller-identity --profile artpoke`가 이 ID 아니면(= 회사 계정이면) 즉시 중단. 회사 `gr-readonly`는 다른 계정이며 호출 금지.

관련: [[art-poke-aws-migration]]
