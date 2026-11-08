// 모놀리식: 데이터 모양은 lib/*가 이미 클라 친화적으로 빚어준다(별도 transform 불필요).
// 도메인은 그 타입을 재사용하고, 추가로 필요한 뷰 전용 필드만 확장한다.
import type { ArtworkDetail as LibArtworkDetail, RecentArtwork } from "@/lib/artworks";

export type Artwork = RecentArtwork;

// "최근 도안 더 보기" 무한스크롤 한 페이지.
export type ArtworkFeedPage = { artworks: Artwork[]; hasMore: boolean };

// 상세: lib 상세 + 현재 유저의 추천 여부(서버액션이 합쳐서 내려준다).
export type ArtworkDetail = LibArtworkDetail & { isRecommended: boolean };

// /api/artworks/[id]/recommend 응답(토글 후 상태).
export type RecommendResult = { recommended: boolean };
