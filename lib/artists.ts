import "server-only";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { artists } from "@/lib/db/schema";
import { db as supabaseDb } from "@/lib/supabase/server";
import { ArtworkError, setStatus, toPublic, type ArtworkRow, type PublicArtwork, type Status } from "@/lib/artworks";
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

type ArtistRow = {
  user_id: string;
  handle: string;
  display_name: string;
  email: string | null;
  provider: SocialProvider;
  intro: string | null;
  link_url: string | null;
  status: ArtistStatus;
  created_at: string;
};

// C2(Task 2.1)에서 Drizzle 전환되는 4개 함수(artworks/cards 조인)만 쓰는 snake_case 행·매퍼.
const COLUMNS = "user_id, handle, display_name, email, provider, intro, link_url, status, created_at";

function fromRow(r: ArtistRow): Artist {
  return {
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name,
    email: r.email,
    provider: r.provider,
    intro: r.intro,
    linkUrl: r.link_url,
    status: r.status,
    createdAt: r.created_at,
  };
}

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
    return fromDrizzle(rows[0]);
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      // 주소가 겹치거나, 같은 계정이 두 번 신청했다.
      if (await artistByUserId(user.id)) throw new ArtistError("already_registered");
      throw new ArtistError("handle_taken");
    }
    throw e;
  }
}

// 어드민 승인 -------------------------------------------------------------------

// C2(Task 2.1)에서 Drizzle 전환 — artworks/cards 조인 의존, 임시 Supabase 유지
export async function listArtists(): Promise<(Artist & { artworkCount: number })[]> {
  const { data, error } = await supabaseDb()
    .from("artists")
    .select(`${COLUMNS}, artworks(count)`)
    .order("created_at", { ascending: false })
    .returns<(ArtistRow & { artworks: { count: number }[] })[]>();
  if (error) throw error;
  const order: Record<ArtistStatus, number> = { pending: 0, approved: 1, rejected: 2 };
  return data
    .map((r) => ({ ...fromRow(r), artworkCount: r.artworks[0]?.count ?? 0 }))
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

type PortfolioRow = ArtworkRow & { cards: { set_code: string; collector_number: string; name_ko: string } };

// C2(Task 2.1)에서 Drizzle 전환 — artworks/cards 조인 의존, 임시 Supabase 유지
// 승인된 작가만 공개한다. 작품은 공개(active) 상태만, 최신 순.
export async function getPortfolio(handle: string): Promise<{ artist: Artist; artworks: PortfolioArtwork[] } | null> {
  if (!HANDLE.test(handle)) return null;
  const found = await supabaseDb()
    .from("artists")
    .select(COLUMNS)
    .eq("handle", handle)
    .eq("status", "approved")
    .maybeSingle<ArtistRow>();
  if (found.error) throw found.error;
  if (!found.data) return null;
  const artist = fromRow(found.data);

  const { data, error } = await supabaseDb()
    .from("artworks")
    .select(
      "id, title, artist_name, format, source_url, source_visibility, link_status, print_size_verified, cards(set_code, collector_number, name_ko)",
    )
    .eq("artist_id", artist.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<PortfolioRow[]>();
  if (error) throw error;
  return {
    artist,
    artworks: data.map((r) => ({
      ...toPublic({ ...r, artists: { handle: artist.handle, status: artist.status } }),
      card: {
        label: `${r.cards.set_code} ${r.cards.collector_number}`,
        path: `/cards/${encodeURIComponent(r.cards.set_code)}/${r.cards.collector_number.replace("/", "-")}`,
        name: r.cards.name_ko,
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

// C2(Task 2.1)에서 Drizzle 전환 — artworks/cards 조인 의존, 임시 Supabase 유지
// 철회한 작품은 빼고, 숨김(어드민이 내린 것)은 보여 준다.
export async function listMyArtworks(artistId: string): Promise<MyArtwork[]> {
  const { data, error } = await supabaseDb()
    .from("artworks")
    .select("id, title, artist_name, format, status, created_at, cards(set_code, collector_number, name_ko)")
    .eq("artist_id", artistId)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        title: string | null;
        artist_name: string;
        format: string;
        status: Status;
        created_at: string;
        cards: { set_code: string; collector_number: string; name_ko: string };
      }[]
    >();
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    title: r.title?.trim() || `${r.artist_name}님의 도안`,
    format: r.format,
    status: r.status,
    createdAt: r.created_at,
    card: {
      label: `${r.cards.set_code} ${r.cards.collector_number}`,
      path: `/cards/${encodeURIComponent(r.cards.set_code)}/${r.cards.collector_number.replace("/", "-")}`,
      name: r.cards.name_ko,
    },
  }));
}

// 이력(consent_events.actor)에 남기는 작가 표시. 이메일이 없을 수 있어 주소 이름을 쓴다.
export function artistActor(artist: Artist): string {
  return `artist:${artist.handle}`;
}

// C2(Task 2.1)에서 Drizzle 전환 — artworks/cards 조인 의존, 임시 Supabase 유지
// 작가가 자기 작품을 내린다 = 철회(파일 삭제, 되돌릴 수 없음). 어드민 철회와 같이 카드 번호를 확인한다.
// 숨김·복구는 어드민 몫이다(어드민이 숨긴 작품을 작가가 되살리지 못하게).
export async function withdrawMyArtwork(artist: Artist, artworkId: string, confirm: string): Promise<void> {
  if (!UUID.test(artworkId)) throw new ArtworkError("not_found");
  const { data, error } = await supabaseDb().from("artworks").select("artist_id").eq("id", artworkId).maybeSingle();
  if (error) throw error;
  if (!data || data.artist_id !== artist.userId) throw new ArtworkError("not_found");
  const expected = await expectedConfirm(artworkId);
  if (!expected || normalizeConfirm(confirm) !== normalizeConfirm(expected)) throw new ArtworkError("confirm_mismatch");
  await setStatus(artworkId, "withdrawn", { reason: "작가 본인 요청", actor: artistActor(artist) });
}
