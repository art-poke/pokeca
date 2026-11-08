import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { accounts, artists, artworkFiles, artworks, cards, users } from "@/lib/db/schema";
import { ArtworkError, attachFile, setStatus, toPublic, type PublicArtwork, type Status } from "@/lib/artworks";
import { expectedConfirm, normalizeConfirm } from "@/lib/admin";
import { NICKNAME_MAX } from "@/lib/profile";
import { promoteAvatar, removeAvatar, StorageInputError } from "@/lib/storage";
import { UUID } from "@/lib/uuid";

// 프로필(=작가). 로그인한 누구나 곧 작가다 — 신청·승인 없음(2026-11 유저=작가 통합).
// 로그인은 카카오·구글뿐. 첫 상호작용 때 프로필이 자동 생성되고(display_name 기본값),
// 발행(도안 업로드)·공개는 handle(작가 주소)을 마이페이지에서 설정하면 열린다.

export type ProfileLink = { label: string; url: string };
export type ProfileActivity = { place: string; handle: string };

export type Artist = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  handle: string | null; // 발행 전 null
  email: string | null;
  provider: SocialProvider;
  intro: string | null;
  linkUrl: string | null;
  links: ProfileLink[];
  activities: ProfileActivity[];
  createdAt: string;
};

const artistColumns = {
  userId: artists.userId,
  displayName: artists.displayName,
  avatarPath: artists.avatarPath,
  handle: artists.handle,
  email: artists.email,
  provider: artists.provider,
  intro: artists.intro,
  linkUrl: artists.linkUrl,
  links: artists.links,
  activities: artists.activities,
  createdAt: artists.createdAt,
};

type DrizzleArtistRow = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  handle: string | null;
  email: string | null;
  provider: string;
  intro: string | null;
  linkUrl: string | null;
  links: ProfileLink[];
  activities: ProfileActivity[];
  createdAt: Date;
};

function fromDrizzle(r: DrizzleArtistRow): Artist {
  return {
    userId: r.userId,
    displayName: r.displayName,
    avatarPath: r.avatarPath,
    handle: r.handle,
    email: r.email,
    provider: r.provider as SocialProvider,
    intro: r.intro,
    linkUrl: r.linkUrl,
    links: Array.isArray(r.links) ? r.links : [],
    activities: Array.isArray(r.activities) ? r.activities : [],
    createdAt: r.createdAt.toISOString(),
  };
}

export class ArtistError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// 로그인 ---------------------------------------------------------------------

export const SOCIAL_PROVIDERS = ["kakao", "google"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

// 소셜 로그인한 사용자.
export type SocialUser = { id: string; email: string | null; provider: SocialProvider; name: string | null };

export async function currentSocialUser(): Promise<SocialUser | null> {
  // auth()는 JWT 검증에 불안정값(crypto/Date)을 써서 프리렌더 시 "unstable value" 오류 → 리로드 루프.
  // 동적 렌더를 강제한다.
  await connection();
  const session = await auth();
  const user = session?.user;
  const provider = (session as { provider?: string } | null)?.provider as SocialProvider | undefined;
  // 어드민의 이메일(credentials) 계정 등 소셜 로그인이 아닌 계정은 작가 영역에서 로그인하지 않은 것으로 본다.
  if (!user?.id || !provider || !SOCIAL_PROVIDERS.includes(provider)) return null;
  return { id: user.id, email: user.email ?? null, provider, name: user.name ?? null };
}

async function artistByUserId(userId: string): Promise<Artist | null> {
  const rows = await db.select(artistColumns).from(artists).where(eq(artists.userId, userId)).limit(1);
  return rows[0] ? fromDrizzle(rows[0]) : null;
}

// 로그인한 유저의 프로필을 보장(없으면 소셜 이름으로 생성). 첫 상호작용 때 자동 생성.
export async function ensureProfile(user: SocialUser): Promise<Artist> {
  const existing = await artistByUserId(user.id);
  if (existing) return existing;
  const displayName = (user.name?.trim() || `수집가-${user.id.slice(0, 4)}`).slice(0, NICKNAME_MAX);
  try {
    const rows = await db
      .insert(artists)
      .values({ userId: user.id, displayName, email: user.email, provider: user.provider })
      .returning(artistColumns);
    return fromDrizzle(rows[0]);
  } catch (e) {
    // 동시 첫 요청 경합: 이미 생겼으면 그 행을 돌려준다.
    if (isUniqueViolation(e)) {
      const row = await artistByUserId(user.id);
      if (row) return row;
    }
    throw e;
  }
}

// 로그인했으면 프로필을 돌려준다(없으면 생성). 비로그인·비소셜이면 null.
export async function currentArtist(): Promise<Artist | null> {
  const user = await currentSocialUser();
  return user ? ensureProfile(user) : null;
}

// 로그인만 필요한 화면·server action의 첫 줄.
export async function requireProfile(): Promise<Artist> {
  const user = await currentSocialUser();
  if (!user) redirect("/artist/login");
  return ensureProfile(user);
}

// 발행 자격: handle 보유. 없으면 마이페이지에서 주소 이름을 1회 설정하도록 유도.
export async function requirePublisher(): Promise<Artist> {
  const profile = await requireProfile();
  if (!profile.handle) redirect("/me?setup=handle");
  return profile;
}

// 개발 미리보기용: 프로필 아무나 1명(로컬에서 로그인 없이 마이페이지 UI 확인).
export async function anyMember(): Promise<Artist | null> {
  const rows = await db.select(artistColumns).from(artists).orderBy(asc(artists.createdAt)).limit(1);
  return rows[0] ? fromDrizzle(rows[0]) : null;
}

// 프로필 수정 ------------------------------------------------------------------

export const HANDLE = /^[a-z0-9_]{2,30}$/;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 입력 링크/활동처를 안전하게 정리(최대 8개, 빈 값·형식 불량 제거).
function cleanLinks(raw: unknown): ProfileLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ label: String(l?.label ?? "").trim().slice(0, 20), url: String(l?.url ?? "").trim().slice(0, 300) }))
    .filter((l) => /^https?:\/\//.test(l.url))
    .slice(0, 8);
}
function cleanActivities(raw: unknown): ProfileActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => ({ place: String(a?.place ?? "").trim().slice(0, 30), handle: String(a?.handle ?? "").trim().slice(0, 40) }))
    .filter((a) => a.place || a.handle)
    .slice(0, 8);
}

// 프로필 수정: 표시명·이미지 + 이메일·소개·링크·활동처. undefined인 필드는 건드리지 않는다.
export async function updateProfile(
  userId: string,
  input: {
    displayName: string;
    avatarUploadId?: string | null;
    email?: string | null;
    intro?: string | null;
    links?: unknown;
    activities?: unknown;
  },
): Promise<void> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new ArtistError("nickname_required");
  if (displayName.length > NICKNAME_MAX) throw new ArtistError("nickname_too_long");

  const patch: {
    displayName: string;
    avatarPath?: string;
    email?: string | null;
    intro?: string | null;
    links?: ProfileLink[];
    activities?: ProfileActivity[];
  } = { displayName };

  if (input.email !== undefined) {
    const email = (input.email ?? "").trim();
    if (email && !EMAIL_RE.test(email)) throw new ArtistError("invalid_email");
    patch.email = email || null;
  }
  if (input.intro !== undefined) {
    patch.intro = (input.intro ?? "").trim().slice(0, 500) || null;
  }
  if (input.links !== undefined) patch.links = cleanLinks(input.links);
  if (input.activities !== undefined) patch.activities = cleanActivities(input.activities);

  let oldPath: string | null = null;
  if (input.avatarUploadId) {
    const prev = await db
      .select({ avatarPath: artists.avatarPath })
      .from(artists)
      .where(eq(artists.userId, userId))
      .limit(1);
    oldPath = prev[0]?.avatarPath ?? null;
    try {
      patch.avatarPath = await promoteAvatar(input.avatarUploadId, userId);
    } catch (e) {
      if (e instanceof StorageInputError) throw new ArtistError(e.message);
      throw e;
    }
  }

  await db.update(artists).set(patch).where(eq(artists.userId, userId));
  if (oldPath && patch.avatarPath && oldPath !== patch.avatarPath) {
    await removeAvatar(oldPath).catch(() => {});
  }
}

// 발행용 주소 이름(handle) 설정. 발행 전 1회(또는 변경). 겹치면 handle_taken.
export async function setHandle(userId: string, rawHandle: string): Promise<void> {
  const handle = rawHandle.trim().toLowerCase();
  if (!HANDLE.test(handle)) throw new ArtistError("invalid_handle");
  try {
    await db.update(artists).set({ handle }).where(eq(artists.userId, userId));
  } catch (e) {
    if (isUniqueViolation(e)) throw new ArtistError("handle_taken");
    throw e;
  }
}

// 공개 작가 페이지 -----------------------------------------------------------------

export type ArtistHit = { userId: string; handle: string; displayName: string };

// 작가 이름/핸들 검색(커뮤니티 후기에서 작가 고르기). 발행자(handle 보유)만.
export async function searchArtists(q: string, limit = 8): Promise<ArtistHit[]> {
  const query = q.trim();
  if (!query) return [];
  const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select({ userId: artists.userId, handle: artists.handle, displayName: artists.displayName })
    .from(artists)
    .where(and(isNotNull(artists.handle), or(ilike(artists.displayName, like), ilike(artists.handle, like))))
    .orderBy(asc(artists.displayName))
    .limit(limit);
  return rows.flatMap((r) => (r.handle ? [{ userId: r.userId, handle: r.handle, displayName: r.displayName }] : []));
}

// 발행자의 user_id를 핸들로 찾는다(후기 작성 등). 없거나 미발행이면 null.
export async function publishedArtistId(handle: string): Promise<string | null> {
  if (!HANDLE.test(handle)) return null;
  const rows = await db
    .select({ userId: artists.userId })
    .from(artists)
    .where(eq(artists.handle, handle))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export type PortfolioArtwork = PublicArtwork & { card: { label: string; path: string; name: string } };

// 발행자(handle 보유)만 공개한다. 작품은 공개(active) 상태만, 최신 순.
export async function getPortfolio(handle: string): Promise<{ artist: Artist; artworks: PortfolioArtwork[] } | null> {
  if (!HANDLE.test(handle)) return null;
  const found = await db
    .select(artistColumns)
    .from(artists)
    .where(eq(artists.handle, handle))
    .limit(1);
  if (!found[0]) return null;
  const artist = fromDrizzle(found[0]);

  const rows = await db
    .select({
      id: artworks.id,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      source_url: artworks.sourceUrl,
      source_visibility: artworks.sourceVisibility,
      link_status: artworks.linkStatus,
      print_size_verified: artworks.printSizeVerified,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(and(eq(artworks.artistId, artist.userId), eq(artworks.status, "active")))
    .orderBy(desc(artworks.createdAt));
  return {
    artist,
    artworks: rows.map((r) => ({
      ...toPublic({
        id: r.id,
        title: r.title,
        artist_name: r.artist_name,
        format: r.format as PublicArtwork["format"],
        source_url: r.source_url,
        source_visibility: r.source_visibility as "public" | "members_only" | null,
        link_status: r.link_status,
        print_size_verified: r.print_size_verified,
        artists: { handle: artist.handle },
      }),
      card: {
        label: `${r.setCode} ${r.collectorNumber}`,
        path: `/cards/${encodeURIComponent(r.setCode)}/${r.collectorNumber.replace("/", "-")}`,
        name: r.nameKo,
      },
    })),
  };
}

// 작가 본인 작품 -------------------------------------------------------------------

export type MyArtwork = {
  id: string;
  title: string;
  format: string;
  status: Status;
  createdAt: string;
  card: { label: string; path: string; name: string };
};

// 철회한 작품은 빼고, 숨김(어드민이 내린 것)은 보여 준다.
export async function listMyArtworks(artistId: string): Promise<MyArtwork[]> {
  const rows = await db
    .select({
      id: artworks.id,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      status: artworks.status,
      createdAt: artworks.createdAt,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(and(eq(artworks.artistId, artistId), ne(artworks.status, "withdrawn")))
    .orderBy(desc(artworks.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title?.trim() || `${r.artist_name}님의 도안`,
    format: r.format,
    status: r.status as Status,
    createdAt: r.createdAt.toISOString(),
    card: {
      label: `${r.setCode} ${r.collectorNumber}`,
      path: `/cards/${encodeURIComponent(r.setCode)}/${r.collectorNumber.replace("/", "-")}`,
      name: r.nameKo,
    },
  }));
}

// 이력(consent_events.actor)에 남기는 작가 표시. handle이 없을 수 있어 user_id로 떨어뜨린다.
export function artistActor(artist: Artist): string {
  return `artist:${artist.handle ?? artist.userId}`;
}

// 작가가 자기 작품을 내린다 = 철회(파일 삭제, 되돌릴 수 없음). 카드 번호를 확인한다.
// 숨김·복구는 어드민 몫이다(어드민이 숨긴 작품을 작가가 되살리지 못하게).
export async function withdrawMyArtwork(artist: Artist, artworkId: string, confirm: string): Promise<void> {
  if (!UUID.test(artworkId)) throw new ArtworkError("not_found");
  const rows = await db
    .select({ artistId: artworks.artistId })
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);
  const found = rows[0] ?? null;
  if (!found || found.artistId !== artist.userId) throw new ArtworkError("not_found");
  const expected = await expectedConfirm(artworkId);
  if (!expected || normalizeConfirm(confirm) !== normalizeConfirm(expected)) throw new ArtworkError("confirm_mismatch");
  await setStatus(artworkId, "withdrawn", { reason: "작가 본인 요청", actor: artistActor(artist) });
}

// 본인 도안 공개/비공개 토글. active=공개, hidden=비공개(본인만). withdrawn(내림)은 복구 불가라 제외.
export async function setMyArtworkVisibility(artist: Artist, artworkId: string, visible: boolean): Promise<void> {
  if (!UUID.test(artworkId)) throw new ArtworkError("not_found");
  const rows = await db
    .select({ artistId: artworks.artistId, status: artworks.status })
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);
  const found = rows[0] ?? null;
  if (!found || found.artistId !== artist.userId) throw new ArtworkError("not_found");
  if (found.status === "withdrawn") throw new ArtworkError("not_found");
  await setStatus(artworkId, visible ? "active" : "hidden", {
    reason: visible ? "작가 본인 공개" : "작가 본인 비공개",
    actor: artistActor(artist),
  });
}

// 수정 폼 프리필용. 본인 소유 + 내리지 않은 도안만(공개·비공개 둘 다).
export type MyArtworkEdit = {
  id: string;
  title: string;
  artistName: string;
  format: string;
  sourceUrl: string | null;
  sourceVisibility: "public" | "members_only" | null;
  status: Exclude<Status, "withdrawn">;
  pieceCount: number;
  card: { label: string; name: string };
};

async function ownedArtwork(artist: Artist, artworkId: string) {
  if (!UUID.test(artworkId)) throw new ArtworkError("not_found");
  const rows = await db
    .select({ artistId: artworks.artistId, status: artworks.status })
    .from(artworks)
    .where(eq(artworks.id, artworkId))
    .limit(1);
  const found = rows[0] ?? null;
  if (!found || found.artistId !== artist.userId || found.status === "withdrawn") {
    throw new ArtworkError("not_found");
  }
  return found;
}

export async function getMyArtwork(artist: Artist, artworkId: string): Promise<MyArtworkEdit | null> {
  if (!UUID.test(artworkId)) return null;
  const rows = await db
    .select({
      id: artworks.id,
      artistId: artworks.artistId,
      title: artworks.title,
      artist_name: artworks.artistName,
      format: artworks.format,
      source_url: artworks.sourceUrl,
      source_visibility: artworks.sourceVisibility,
      status: artworks.status,
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
      nameKo: cards.nameKo,
    })
    .from(artworks)
    .innerJoin(cards, eq(artworks.cardId, cards.id))
    .where(eq(artworks.id, artworkId))
    .limit(1);
  const d = rows[0] ?? null;
  if (!d || d.artistId !== artist.userId || d.status === "withdrawn") return null;
  const fileRows = await db
    .select({ kind: artworkFiles.kind })
    .from(artworkFiles)
    .where(eq(artworkFiles.artworkId, artworkId));
  return {
    id: d.id,
    title: d.title?.trim() ?? "",
    artistName: d.artist_name,
    format: d.format,
    sourceUrl: d.source_url,
    sourceVisibility: d.source_visibility as "public" | "members_only" | null,
    status: d.status as Exclude<Status, "withdrawn">,
    pieceCount: fileRows.filter((f) => f.kind === "original").length,
    card: { label: `${d.setCode} ${d.collectorNumber}`, name: d.nameKo },
  };
}

// 본인 도안 세부정보 수정(제목·작가표시명·출처 링크/공개범위).
export async function updateMyArtwork(
  artist: Artist,
  artworkId: string,
  fields: { title: string; artistName: string; sourceUrl: string | null; sourceVisibility: "public" | "members_only" | null },
): Promise<void> {
  await ownedArtwork(artist, artworkId);
  const artistName = fields.artistName.trim();
  if (!artistName) throw new ArtworkError("artist_required");
  const sourceUrl = fields.sourceUrl?.trim() || null;
  if (sourceUrl && !/^https?:\/\//.test(sourceUrl)) throw new ArtworkError("invalid_source_url");
  const sourceVisibility = sourceUrl ? fields.sourceVisibility : null;
  if (!!sourceUrl !== !!sourceVisibility) throw new ArtworkError("source_visibility_required");
  await db
    .update(artworks)
    .set({ title: fields.title.trim() || null, artistName, sourceUrl, sourceVisibility })
    .where(eq(artworks.id, artworkId));
}

// 본인 도안 이미지 교체(단일 조각만). 원본 교체 → 미리보기 재생성 → 옛 파일 purge는 attachFile이 처리.
export async function replaceMyArtworkImage(artist: Artist, artworkId: string, uploadId: string): Promise<void> {
  await ownedArtwork(artist, artworkId);
  const fileRows = await db
    .select({ kind: artworkFiles.kind })
    .from(artworkFiles)
    .where(eq(artworkFiles.artworkId, artworkId));
  if (fileRows.filter((f) => f.kind === "original").length > 1) {
    throw new ArtworkError("multi_piece_no_replace"); // 9포켓 등 여러 조각은 이미지 교체 미지원
  }
  await attachFile(artworkId, "original", uploadId);
}

// 하위호환 alias (members.ts 흡수). 옛 회원 개념 = 프로필과 동일.
export type Member = Artist;
export const MemberError = ArtistError;
export const currentMember = currentArtist;
export const requireMember = requireProfile;

export const WITHDRAWN_DISPLAY_NAME = "탈퇴한 작가";

// 회원 탈퇴(소프트). PII 익명화 + deletedAt 마킹 + OAuth(accounts) 언링크 + 작품 내림.
// handle=null이면 공개 "작가 페이지"만 빠질 뿐, 작품 레코드는 그대로라 랭킹·카드상세·검색카운트에
// 계속 노출된다. 그래서 작품을 withdrawn으로 내려(모든 공개 조회가 status='active'만 봄) 함께 제외한다.
// 탈퇴는 OAuth 언링크로 비가역(재로그인=새 계정)이라, 복구 불가 상태인 withdrawn과 의미가 맞는다.
// 세션 쿠키 삭제는 클라가 next-auth signOut으로 한다.
export async function withdrawMyAccount(artist: Artist): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(artists)
      .set({
        deletedAt: new Date(),
        displayName: WITHDRAWN_DISPLAY_NAME,
        handle: null,
        avatarPath: null,
        email: null,
        intro: null,
        linkUrl: null,
        links: [],
        activities: [],
      })
      .where(eq(artists.userId, artist.userId));
    // 공개 작품을 전부 내린다(기존 active/hidden만). artwork_set_status는 우회하므로
    // consent 로깅·파일 purge는 하지 않는다(이번 범위: 공개 숨김. 파일 정리는 후속).
    await tx
      .update(artworks)
      .set({ status: "withdrawn" })
      .where(
        and(eq(artworks.artistId, artist.userId), inArray(artworks.status, ["active", "hidden"])),
      );
    await tx.update(users).set({ name: null, email: null, image: null }).where(eq(users.id, artist.userId));
    await tx.delete(accounts).where(eq(accounts.userId, artist.userId));
  });
  // 아바타(프로필 사진=PII) 베스트에포트 제거. 실패해도 탈퇴는 완료된 것으로 본다.
  if (artist.avatarPath) await removeAvatar(artist.avatarPath).catch(() => {});
}
