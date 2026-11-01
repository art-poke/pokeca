// 카드별 즐겨찾기 상태는 서버렌더 initial prop으로 오므로 현재 전역 쿼리는 없다.
// (마이페이지 즐겨찾기 "목록"을 react-query로 옮길 때 여기에 mine() 키 추가)
export const favoriteKeys = {
  all: ["favorites"] as const,
};
