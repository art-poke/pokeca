import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { artists, artworks, cards } from "@/lib/db/schema";
import { ArtworkError, setStatus, toPublic, type PublicArtwork, type Status } from "@/lib/artworks";
import { expectedConfirm, normalizeConfirm } from "@/lib/admin";
import { UUID } from "@/lib/uuid";

// 작가 계정 (20261029120000_artists.sql). 누구나 신청하고, 어드민이 승인한 작가만 도안을 올린다.
// 로그인은 카카오·구글뿐이다. 처음 로그인하면 auth 계정만 생기고, 작가 신청(registerArtist)을 내야 작가가 된다.

export type ArtistStatus = "pending" | "approved" | "rejected";
export const ARTIST_STATUSES: ArtistStatus[] = ["pending", "approved", "rejected"];

export type Artist = {
  userId: string;
  handle: string;
  displayName: string;
  email: string | null;
  provider: SocialProvider;
  intro: string | null;
  linkUrl: string | null;
  status: ArtistStatus;
  createdAt: string;
};

// Drizzle select 결과(camelCase)를 Artist로. createdAt은 timestamptz → ISO 문자열로 맞춘다.
const artistColumns = {
  userId: artists.userId,
  handle: artists.handle,
  displayName: artists.displayName,
  email: artists.email,
  provider: artists.provider,
  intro: artists.intro,
  linkUrl: artists.linkUrl,
  status: artists.status,
  createdAt: artists.createdAt,
};

type DrizzleArtistRow = {
  userId: string;
  handle: string;
  displayName: string;
  email: string | null;
  provider: string;
  intro: string | null;
  linkUrl: string | null;
  status: string;
  createdAt: Date;
};

function fromDrizzle(r: DrizzleArtistRow): Artist {
  return {
    userId: r.userId,
    handle: r.handle,
    displayName: r.displayName,
    email: r.email,
    provider: r.provider as SocialProvider,
    intro: r.intro,
    linkUrl: r.linkUrl,
    status: r.status as ArtistStatus,
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

// 소셜 로그인한 사용자. 작가 신청 전일 수 있다.
export type SocialUser = { id: string; email: string | null; provider: SocialProvider; name: string | null };

export async function currentSocialUser(): Promise<SocialUser | null> {
  // auth()는 JWT 검증에 불안정값(crypto/Date)을 써서 프리렌더 시 "unstable value" 오류 → 리로드 루프.
  // 옛 authClient()처럼 동적 렌더를 강제한다.
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

export async function currentArtist(): Promise<Artist | null> {
  const user = await currentSocialUser();
  return user ? artistByUserId(user.id) : null;
}

// 개발 미리보기용: 승인된 작가 아무나 1명(로컬에서 로그인 없이 스튜디오 UI 확인).
export async function anyApprovedArtist(): Promise<Artist | null> {
  const rows = await db
    .select(artistColumns)
    .from(artists)
    .where(eq(artists.status, "approved"))
    .orderBy(asc(artists.createdAt))
    .limit(1);
  return rows[0] ? fromDrizzle(rows[0]) : null;
}

// 작가 화면과 server action의 첫 줄. 로그인 전이면 로그인으로, 신청 전이면 신청 폼으로 보낸다.
// 승인 여부는 화면마다 따로 본다(대기 중에도 내 정보는 보여야 한다).
export async function requireArtist(): Promise<Artist> {
  const user = await currentSocialUser();
  if (!user) redirect("/artist/login");
  const artist = await artistByUserId(user.id);
  if (!artist) redirect("/artist/signup");
  return artist;
}

// 작가 신청 폼의 첫 줄. 이미 신청했으면 작가 홈으로 보낸다.
export async function requireApplicant(): Promise<SocialUser> {
  const user = await currentSocialUser();
  if (!user) redirect("/artist/login");
  if (await artistByUserId(user.id)) redirect("/artist");
  return user;
}

// 작가 신청 -------------------------------------------------------------------

export type ArtistApplication = {
  handle: string;
  displayName: string;
  intro?: string | null;
  linkUrl?: string | null;
};

export const HANDLE = /^[a-z0-9_]{2,30}$/;

export async function registerArtist(user: SocialUser, input: ArtistApplication): Promise<Artist> {
  const handle = input.handle.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const intro = input.intro?.trim() || null;
  const linkUrl = input.linkUrl?.trim() || null;
  if (!HANDLE.test(handle)) throw new ArtistError("invalid_handle");
  if (!displayName || displayName.length > 40) throw new ArtistError("invalid_name");
  if (intro && intro.length > 300) throw new ArtistError("intro_too_long");
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) throw new ArtistError("invalid_link");

  try {
    const rows = await db
      .insert(artists)
      .values({
        userId: user.id,
        handle,
        displayName,
        email: user.email,
        provider: user.provider,
        intro,
        linkUrl,
      })
      .returning(artistColumns);
    // INSERT ... RETURNING은 삽입한 그 한 행을 항상 돌려준다(성공 시 rows[0] 보장).
    return fromDrizzle(rows[0]);
  } catch (e) {
    if (isUniqueViolation(e)) {
      // 주소가 겹치거나, 같은 계정이 두 번 신청했다.
      if (await artistByUserId(user.id)) throw new ArtistError("already_registered");
      throw new ArtistError("handle_taken");
    }
    throw e;
  }
}

// 어드민 승인 -------------------------------------------------------------------

export async function listArtists(): Promise<(Artist & { artworkCount: number })[]> {
  // artworks 수는 left join + group by count(작품 id)로 센다(작품 0개면 0).
  const rows = await db
    .select({ ...artistColumns, artworkCount: count(artworks.id) })
    .from(artists)
    .leftJoin(artworks, eq(artworks.artistId, artists.userId))
    .groupBy(
      artists.userId,
      artists.handle,
      artists.displayName,
      artists.email,
      artists.provider,
      artists.intro,
      artists.linkUrl,
      artists.status,
      artists.createdAt,
    )
    .orderBy(desc(artists.createdAt));
  const order: Record<ArtistStatus, number> = { pending: 0, approved: 1, rejected: 2 };
  return rows
    .map((r) => ({ ...fromDrizzle(r), artworkCount: r.artworkCount }))
    .sort((a, b) => order[a.status] - order[b.status]);
}

// 승인을 거두면(rejected) 새 업로드만 막는다. 이미 올린 작품은 어드민이 따로 숨긴다.
export async function setArtistStatus(userId: string, status: ArtistStatus, actor: string): Promise<void> {
  if (!UUID.test(userId)) throw new ArtistError("not_found");
  if (!ARTIST_STATUSES.includes(status)) throw new ArtistError("invalid_status");
  const rows = await db
    .update(artists)
    .set({ status, reviewedAt: new Date(), reviewedBy: actor })
    .where(eq(artists.userId, userId))
    .returning({ userId: artists.userId });
  if (!rows.length) throw new ArtistError("not_found");
}

export async function getArtistById(userId: string): Promise<Artist | null> {
  if (!UUID.test(userId)) return null;
  const rows = await db.select(artistColumns).from(artists).where(eq(artists.userId, userId)).limit(1);
  return rows[0] ? fromDrizzle(rows[0]) : null;
}

// 승인 작가의 user_id를 핸들로 찾는다(후기 작성 등). 없거나 미승인이면 null.
export async function approvedArtistId(handle: string): Promise<string | null> {
  if (!HANDLE.test(handle)) return null;
  const rows = await db
    .select({ userId: artists.userId })
    .from(artists)
    .where(and(eq(artists.handle, handle), eq(artists.status, "approved")))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export type ArtistHit = { userId: string; handle: string; displayName: string };

// 작가 이름/핸들 검색(커뮤니티 후기에서 작가 고르기). 승인 작가만.
export async function searchArtists(q: string, limit = 8): Promise<ArtistHit[]> {
  const query = q.trim();
  if (!query) return [];
  const like = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select({ userId: artists.userId, handle: artists.handle, displayName: artists.displayName })
    .from(artists)
    .where(and(eq(artists.status, "approved"), or(ilike(artists.displayName, like), ilike(artists.handle, like))))
    .orderBy(asc(artists.displayName))
    .limit(limit);
  return rows.map((r) => ({ userId: r.userId, handle: r.handle, displayName: r.displayName }));
}

// 공개 작가 페이지 -----------------------------------------------------------------

export type PortfolioArtwork = PublicArtwork & { card: { label: string; path: string; name: string } };

// 승인된 작가만 공개한다. 작품은 공개(active) 상태만, 최신 순.
export async function getPortfolio(handle: string): Promise<{ artist: Artist; artworks: PortfolioArtwork[] } | null> {
  if (!HANDLE.test(handle)) return null;
  const found = await db
    .select(artistColumns)
    .from(artists)
    .where(and(eq(artists.handle, handle), eq(artists.status, "approved")))
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
        artists: { handle: artist.handle, status: artist.status },
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

// 이력(consent_events.actor)에 남기는 작가 표시. 이메일이 없을 수 있어 주소 이름을 쓴다.
export function artistActor(artist: Artist): string {
  return `artist:${artist.handle}`;
}

// 작가가 자기 작품을 내린다 = 철회(파일 삭제, 되돌릴 수 없음). 어드민 철회와 같이 카드 번호를 확인한다.
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
