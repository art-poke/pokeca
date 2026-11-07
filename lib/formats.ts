// 지원 규격. 서버와 브라우저가 함께 쓴다(server-only 아님).
// 확장 대응: 새 규격은 (1) 여기 FORMATS/FORMAT_INFO 한 줄 (2) spec_profiles 행 추가면 된다.
// DB의 code CHECK는 제거돼 있어 규격 추가에 스키마 변경이 필요 없다. UI는 FORMATS를 순회해 자동 반영된다.
export const FORMATS = ["9pocket", "9pocket_tl", "psa", "brg", "etc"] as const;
export type Format = (typeof FORMATS)[number];

// 인쇄 안내 치수 (eng E8). 확인된 규격만 적는다. 없으면 치수를 표시하지 않는다.
// 9포켓: 3×3 바인더 가운데 칸에 실제 카드, 둘레 8칸에 도안 조각을 넣는다. 포켓 크기가 두 종류:
//   슬리브용 68×92 mm, 탑로더 바인더용 82×105 mm.
// PSA·BRG: 슬랩 위에 덧씌우는 같은 알루미늄 보관 케이스(바깥 86×142 mm) 안에 슬랩 앞쪽으로 넣는 한 장.
export const FORMAT_INFO: Record<Format, { label: string; printSize: string | null }> = {
  "9pocket": { label: "9포켓 슬리브", printSize: "9포켓 슬리브용 조각 8장, 각 68×92 mm" },
  "9pocket_tl": { label: "9포켓 탑로더", printSize: "9포켓 탑로더 바인더용 조각 8장, 각 82×105 mm" },
  psa: { label: "PSA", printSize: "PSA 보관 케이스 안쪽 80×135 mm" },
  brg: { label: "BRG", printSize: "BRG 보관 케이스 안쪽 80×135 mm" },
  etc: { label: "기타", printSize: null },
};

// 규격별 올릴 수 있는 원본 조각 수. 9포켓(슬리브·탑로더)은 바인더 둘레 8칸이라 최대 8장,
// 슬랩류(PSA·BRG)는 1장, 기타는 여러 장 허용. 여러 장이면 ZIP으로 묶어 내려준다.
export const FORMAT_PIECES: Record<Format, number> = {
  "9pocket": 8,
  "9pocket_tl": 8,
  psa: 1,
  brg: 1,
  etc: 9,
};

export function isFormat(value: unknown): value is Format {
  return typeof value === "string" && (FORMATS as readonly string[]).includes(value);
}
