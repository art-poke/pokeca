const pages: Record<string, string> = {
  "/": "home",
  "/search": "search_results",
  "/ranking": "ranking",
  "/requests": "request_list",
  "/games": "game_hub",
  "/card-fragments": "game_hub",
  "/play": "game_play",
  "/artworks": "artwork_list",
  "/artist/login": "social_login",
  "/artist": "artist_studio",
  "/artist/new": "artwork_upload",
  "/stories": "story_list",
  "/community": "community_board",
  "/community/new": "post_editor",
  "/community/reviews": "review_list",
  "/me": "my_account",
  "/privacy": "privacy",
  "/terms": "terms",
};
const details: Record<string, string> = {
  cards: "card_detail",
  artworks: "artwork_detail",
  artists: "artist_profile",
  stories: "story_detail",
  community: "post_detail",
  "card-fragments": "game_play",
};
export function pageId(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 3 && parts[0] === "artworks" && parts[2] === "edit")
    return "artwork_edit";
  return (
    pages[path] ??
    (parts.length >= 2 && Object.hasOwn(details, parts[0])
      ? details[parts[0]]
      : undefined) ??
    null
  );
}
export const pageNames = new Set([
  ...Object.values(pages),
  ...Object.values(details),
  "artwork_edit",
]);
export const actions = new Set([
  "start_login",
  "download_artwork",
  "select_game",
  "select_ranked_item",
  "change_ranking_period",
  "submit_search",
  "select_card",
  "favorite_card",
  "request_artwork",
  "like_story",
  "submit_comment",
  "recommend_artwork",
  "write_review",
  "publish_artwork",
  "write_post",
  "open_source",
  "choose_provider",
  "edit_profile",
  "direct_route",
]);
export const placements = new Set([
  "header",
  "footer",
  "content",
  "sidebar",
  "direct",
]);
export const browserEvents = new Set([
  "login_prompt_viewed",
  "page_view",
  "cta_clicked",
  "cta_impression",
  "story_read",
  "game_started",
  "game_finished",
]);
export const searchEmailPattern = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
export const searchPhonePattern = /(?:\+82[ -]?|0)\d{1,2}[ -]?\d{3,4}[ -]?\d{4}/g;

export function cleanQuery(query: string) {
  return query
    .replace(searchEmailPattern, "[이메일]")
    .replace(searchPhonePattern, "[전화번호]")
    .slice(0, 100);
}

const labels: Record<string, string> = {
  home: "홈",
  search_results: "검색 결과",
  card_detail: "카드 상세",
  ranking: "랭킹",
  request_list: "요청방",
  game_hub: "게임 목록",
  game_play: "게임 플레이",
  artwork_list: "작품 목록",
  artwork_detail: "작품 상세",
  artwork_edit: "작품 편집",
  artist_profile: "작가 프로필",
  artist_studio: "작가 스튜디오",
  artwork_upload: "작품 등록",
  story_list: "카드 이야기",
  story_detail: "이야기 상세",
  community_board: "커뮤니티",
  post_detail: "게시글 상세",
  post_editor: "글쓰기",
  review_list: "후기",
  my_account: "마이페이지",
  social_login: "소셜 로그인",
  direct_route: "직접 진입",
  unknown: "출처 미상",
  start_login: "로그인",
  choose_provider: "로그인 방식 선택",
  select_game: "게임 선택",
  submit_search: "검색",
  select_card: "카드 선택",
  select_ranked_item: "랭킹 항목 선택",
  download_artwork: "도안 받기",
  request_artwork: "도안 요청",
  favorite_card: "즐겨찾기",
  like_story: "이야기 좋아요",
  submit_comment: "댓글 작성",
  write_review: "후기 작성",
  recommend_artwork: "도안 추천",
  publish_artwork: "도안 등록",
  open_source: "원본 열기",
  header: "헤더",
  footer: "푸터",
  content: "본문",
  direct: "직접",
  source_click: "원본 글 열기",
  download: "다운로드 발급",
  search: "카드 검색",
  request_created: "도안 요청 완료",
  request: "규격 요청",
  game_started: "게임 시작",
  game_finished: "게임 종료",
  game_score_saved: "점수 저장",
  post_published: "게시글 등록",
  comment_created: "댓글 등록",
  review_created: "후기 등록",
  artwork_published: "도안 등록",
  artwork_recommended: "도안 추천",
  favorite_added: "즐겨찾기 추가",
  story_read: "이야기 읽기",
  story_liked: "이야기 좋아요",
  cta_clicked: "버튼 클릭",
  cta_impression: "버튼 노출",
  login_prompt_viewed: "로그인 안내 노출",
  login_succeeded: "소셜 로그인 성공",
  oauth_started: "소셜 로그인 시작",
  signup_completed: "신규 회원 가입",
  page_view: "페이지 조회",
  privacy: "개인정보처리방침",
  terms: "이용약관",
  edit_profile: "프로필 편집",
  write_post: "게시글 쓰기",
  sidebar: "사이드바",
  kakao: "카카오",
  google: "구글",
  monsterball: "몬스터볼",
  name: "이름 맞히기",
  odd: "다른 카드 찾기",
  change_ranking_period: "랭킹 기간 변경",
};
export const analyticsLabel = (key: string) =>
  Object.hasOwn(labels, key) ? labels[key] : key;
