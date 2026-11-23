# 검수에서 생성으로 넘기는 기록

`review.json`의 `outputs`에는 요청된 규격마다 하나의 항목을 넣는다. 파일 경로는 검수 JSON 기준이다. 출력 한 장의 기록을 줄여 쓴 예시는 다음과 같다.

```json
{
  "outputs": [{
    "format": "sleeve",
    "output": "sleeve.png",
    "overall": {
      "status": "pass",
      "observed": "도시의 두 도로가 같은 높이에서 교차하며 여덟 칸의 창문 간격과 차선 방향도 이어진다. 슬리브 크기와 재단선을 확인했다."
    },
    "spatial_checks": [{
      "constraint": "street-depth",
      "region": "5번 교차로에서 6번 칸 도로 끝까지",
      "observed": "안쪽에서 줄어들던 같은 차로의 폭이 6번 칸 안에서 다시 넓어진다. 바닥의 소실 방향과 맞지 않는다.",
      "status": "repair",
      "action": "두 차선을 원본에서 관측한 도로 축으로 함께 연장해 6번 칸 도로를 다시 그린다."
    }],
    "checks": [{
      "anchor": "left-road",
      "expected": "도로 양변이 같은 간격으로 왼쪽 아래로 이어진다.",
      "observed": "왼쪽 중앙 경계 직후 바깥 차선만 위로 꺾여 차도 폭이 좁아진다.",
      "status": "repair",
      "action": "안쪽 차선을 고정하고 바깥 차선을 카드 안 마지막 직선의 기울기로 다시 그린다."
    }],
    "disposition": "draft"
  }]
}
```

- 전체 검수에는 `analysis.json`의 모든 경계 ID를 한 번씩 넣는다. `observed`에 규격과 변에서 위치를 다시 찾을 수 있는 관찰을 쓰고 복잡한 교차는 출력 px 또는 확대 이미지 경로를 붙인다. `overall`에는 전체 장면과 인쇄 상태를 기록한다.
- 전체 검수의 `spatial_checks`에는 원본의 각 `spatial_constraints[].id`를 `constraint`로 한 번씩 넣는다. `region`은 확인한 칸이나 슬랩의 가시 영역, `observed`는 원본과 실제 출력의 비교다. 수치가 있는 경우 같은 좌표계로 환산한다. 소실점이 가려진 장면도 보이는 선과 겹침은 비교할 수 있다. 해당 비교 자체가 불가능하면 `unverified`로 남긴다.
- 특정 부위만 요청한 경우에는 해당 ID만 기록하고 `disposition`은 `partial`로 둔다. `overall`은 생략한다. 검사 명령 끝에 `--anchors left-1 left-lower bottom-1`처럼 이번에 확인한 ID를 지정한다. 부분 판정은 해당 부위의 수정과 재확인에 사용한다.
- `pass`는 출력에서 확인, `repair`는 관찰된 불일치, `unverified`는 판독에 필요한 증거가 부족한 경우다. 통과하지 못한 항목에는 다음 회차에서 그리거나 정렬하거나 다시 확인할 구체적 `action`을 쓴다. 인쇄 시 창으로 가려지는 구간은 노출된 부분과 가림 위치를 근거로 판단한다.
- 전체 장면·경계·공간 판정이 모두 통과하면 `final`로 기록한다. 이전 양식의 기록은 기본 명령으로 열 수 있고, 최종 재승인 시에는 원본 공간 근거와 규격별 공간 판정을 보완한다. `sha256`에 이번 인쇄 PNG의 SHA-256을 넣는다. PSA·BRG에는 `preview`와 `preview_sha256`도 적는다. `shasum -a 256 경로`로 구한다. 수정 회차에서는 새 파일을 보고 다시 판정한다.
- [기록 검사 도구](../card-extended-art/scripts/check-review.py)는 `python3 .agents/skills/card-extended-art/scripts/check-review.py 9pocket job/analysis.json job/result/review.json`처럼 실행한다. 기본 모드는 시안을 포함해 기록 누락을 찾는다. 최종 인계 시 `--require-final`을 추가하면 실제 파일과 검수 기록이 일치하고 모든 요청 규격이 통과해야 성공한다. [기존 뮤츠 시안의 경계 판정](../card-extended-art/references/rocket-mewtwo-review.json)도 참고한다.
