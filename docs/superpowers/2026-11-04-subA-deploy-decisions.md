# 인프라 결정 로그 — 서브 A 배포 (ADR)

> 왜/어떻게 이 선택을 했는지 추적용. 대화에서 확정된 결정을 근거와 함께 남긴다.
> 최종 갱신: 2026-11-04. 연관: `specs/2026-11-04-aws-phase2-subA-deploy-design.md`, `2026-11-02-aws-phase2-journey.md`.

각 결정 형식: **결정 / 대안 / 왜 / 되돌리는 법**.

---

## ADR-A1. 컴퓨트: 서버리스(OpenNext + Lambda + CloudFront) 채택

- **결정**: Next.js 앱을 **OpenNext로 서버리스**(Lambda server fn + CloudFront + S3 assets)로 배포.
- **대안**:
  - B. 컨테이너 — ECS Fargate / **App Runner** + Next 공식 `standalone` 빌드(OpenNext 불필요, 상시 가동).
- **왜**:
  - art-poke는 **저트래픽 팬 아카이브** → 유휴 시 요금 0(scale-to-zero)이 매력. 컨테이너는 상시 월 ~$15~40 고정.
  - 인수인계 Phase 2 설계에서 이미 서버리스로 잠정 결정됨(일관성).
  - 트레이드오프 인지: 서버리스는 **콜드스타트 + OpenNext 복잡도 + VPC Lambda라 NAT 필요**. 컨테이너(App Runner)는 더 단순(공식 경로, NAT 불필요)하지만 유휴 비용.
  - 사용자가 두 길의 비용/복잡도 트레이드오프를 듣고 **A(서버리스) 선택**.
- **맥락 메모**: 회사(Green Ribbon/lifecatch) 인프라는 ECS Fargate 기반 → B가 더 익숙했을 수 있으나, 유휴비용 0을 우선해 A로 감.
- **되돌리는 법**: OpenNext 산출물 대신 Next `standalone`을 App Runner/ECS로. CloudFront·NAT·OpenNext 관련 .tf 제거. RDS/S3/VPC는 공용이라 유지. 전환 비용 중간.

## ADR-A2. 배포 도구: OpenNext CLI + Terraform (SST 아님)

- **결정**: `open-next build` 산출물을 **기존 Terraform(infra/)**이 Lambda/S3/CloudFront로 배선.
- **대안**: SST v3(OpenNext 내장, `sst deploy` 간편).
- **왜**:
  - 현재 모든 인프라가 **Terraform 상태** 하나로 관리됨. SST는 CloudFormation 기반 별도 IaC라 **상태 이원화**(두 체계 공존·드리프트 위험).
  - 세밀 제어(NAT 인스턴스, 기존 VPC/RDS/S3 재사용) 필요 → Terraform이 적합.
  - 사용자는 OpenNext 자체가 생소 → 도구 선택은 위임받음("오픈넥스트가 모임"). 추천대로 진행.
- **되돌리는 법**: SST 도입 시 app 리소스를 SST로 이관, Terraform에선 app 관련만 제거(VPC/RDS/S3는 data 참조). 비용 중간.

## ADR-A3. 도메인: cloudfront.net 기본 도메인 먼저, 커스텀은 나중

- **결정**: 1차 배포는 CloudFront 기본 `*.cloudfront.net`으로 라이브. 커스텀 도메인은 **도메인 등록 후** 별도 단계.
- **대안**: 처음부터 커스텀 도메인(ACM us-east-1 + DNS) 세팅.
- **왜**:
  - 사용자는 **보유 도메인이 없음**("도메인 하나 해야겠는데"). 도메인 취득이 배포를 막으면 안 됨.
  - cloudfront.net 기본 인증서로 **즉시 라이브** 가능 → 커스텀 도메인은 나중에 **재작업 없이** CloudFront alias + ACM만 추가.
  - OAuth 리다이렉트 URI는 1차에 cloudfront.net 주소로 등록, 커스텀 도메인 단계에서 추가 등록.
- **후속 액션(열림)**: 도메인 이름 미정. 후보 예: `artpoke.io/.com/.gg/.kr`. 등록은 Route 53(연 ~$12~15) 권장 → 사용 가능 여부/가격 확인 후 진행.
- **되돌리는 법**: 커스텀 도메인은 추가만 하면 됨(기본 도메인은 유지 가능). 되돌릴 일 없음.

## ADR-A4. NAT: NAT 인스턴스(t4g.nano), NAT Gateway 아님

- **결정**: 아웃바운드 인터넷(카카오·구글 토큰 교환)을 **NAT 인스턴스 t4g.nano**로.
- **대안**: NAT Gateway(관리형, 고가용).
- **왜**: NAT Gateway 월 ~4만원 vs NAT 인스턴스 월 ~3천원. 저트래픽이라 단일 인스턴스로 충분. 비용 우선(인수인계 확정 결정).
- **리스크**: 단일 인스턴스 SPOF. 저트래픽 허용. 압박/가용성 필요 시 이중화 또는 Gateway 전환.
- **되돌리는 법**: `aws_nat_gateway`로 교체, 라우트 타깃만 변경. 저비용.

## ADR-A5. 작품 이미지 서빙: 1차 presigned GET 유지, CloudFront+OAC는 플랜에서 판단

- **결정**: 작품/아바타 이미지는 당장 **presigned GET 유지**. CloudFront+OAC 이미지 CDN은 서브 A 플랜에서 범위/우선순위 판단(서브 D 이월 항목).
- **왜**: 앱 CloudFront부터 세우는 게 1차 목표. 이미지 CDN은 presigned로도 동작하므로 라이브를 막지 않음. 과도한 동시 변경 지양.
- **되돌리는 법**: 후속에서 uploads 버킷 OAC 비헤이비어 추가.

---

## 상속된 확정 결정 (Phase 2 공통, 재논의 안 함 — 근거는 journey 문서)
- 리전 도쿄, 상태버킷만 서울. 프로파일 **artpoke**(138681986450). 회사 gr-readonly 금지.
- 인증 Auth.js(카카오·구글·어드민 Credentials), 유저 **RDS**(Cognito 안 씀).
- 인가 앱 레이어 if문. 스토리지 S3(+서브 A에서 CloudFront OAC). 커넥션 Lambda 동시성 상한.
- 전환 빅뱅 컷오버(서브 E) 후 Vercel·Supabase 해지.
