"use server";

import { getArtworkDetail, recentArtworks } from "@/lib/artworks";
import { getEngagement } from "@/lib/engagements";
import { currentMember } from "@/lib/members";
import type { Artwork, ArtworkDetail } from "./types";

// ---------------------------------------------------------------------------
// 읽기(쿼리용) 서버액션 — 같은 Next 안에서 lib/*를 직접 호출(네트워크 홉 없음).
// 실패 시 throw → react-query가 로딩/에러 상태로 처리.
// ---------------------------------------------------------------------------

export const fetchRecentArtworks = async (limit = 8): Promise<Artwork[]> =>
  recentArtworks(limit);

// 상세 + 현재 유저의 추천 여부를 합쳐서 내려준다.
export const fetchArtworkDetail = async (
  id: string,
): Promise<ArtworkDetail | null> => {
  const detail = await getArtworkDetail(id);
  if (!detail) return null;
  const member = await currentMember();
  const isRecommended = member
    ? (await getEngagement(member.userId, id)) === "recommend"
    : false;
  return { ...detail, isRecommended };
};

// 쓰기(추천 토글)는 기존 route handler(/api/artworks/[id]/recommend)를 클라에서 호출한다
// (memberRoute의 인증·에러 규격 재사용). → domains/artwork/hooks.ts
