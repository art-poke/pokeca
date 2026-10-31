import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/auth";
import { db } from "@/lib/supabase/server";
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
  const {
    data: { user },
  } = await (await authClient()).auth.getUser();
  if (!user) return null;
  const provider = user.app_metadata.provider as SocialProvider | undefined;
  // 어드민의 이메일 계정 등 소셜 로그인이 아닌 계정은 작가 영역에서 로그인하지 않은 것으로 본다.
  if (!provider || !SOCIAL_PROVIDERS.includes(provider)) return null;
  const meta = user.user_metadata ?? {};
  const name = meta.full_name ?? meta.name ?? meta.nickname ?? meta.preferred_username ?? null;
  return { id: user.id, email: user.email || null, provider, name: typeof name === "string" ? name : null };
}

async function artistByUserId(userId: string): Promise<Artist | null> {
  const { data, error } = await db().from("artists").select(COLUMNS).eq("user_id", userId).maybeSingle<ArtistRow>();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function currentArtist(): Promise<Artist | null> {
  const user = await currentSocialUser();
  return user ? artistByUserId(user.id) : null;
}

// 개발 미리보기용: 승인된 작가 아무나 1명(로컬에서 로그인 없이 스튜디오 UI 확인).
export async function anyApprovedArtist(): Promise<Artist | null> {
  const { data, error } = await db()
    .from("artists")
    .select(COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<ArtistRow>();
  if (error) throw error;
  return data ? fromRow(data) : null;
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

  const { data, error } = await db()
    .from("artists")
    .insert({
      user_id: user.id,
      handle,
      display_name: displayName,
      email: user.email,
      provider: user.provider,
      intro,
      link_url: linkUrl,
    })
    .select(COLUMNS)
    .single<ArtistRow>();
  if (error) {
    if (error.code === "23505") {
      // 주소가 겹치거나, 같은 계정이 두 번 신청했다.
      if (await artistByUserId(user.id)) throw new ArtistError("already_registered");
      throw new ArtistError("handle_taken");
    }
    throw error;
  }
  return fromRow(data);
}

// 어드민 승인 -------------------------------------------------------------------

export async function listArtists(): Promise<(Artist & { artworkCount: number })[]> {
  const { data, error } = await db()
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
  const { data, error } = await db()
    .from("artists")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: actor })
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw error;
  if (!data.length) throw new ArtistError("not_found");
}

export async function getArtistById(userId: string): Promise<Artist | null> {
  if (!UUID.test(userId)) return null;
  const { data, error } = await db().from("artists").select(COLUMNS).eq("user_id", userId).maybeSingle<ArtistRow>();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

// 공개 작가 페이지 -----------------------------------------------------------------

export type PortfolioArtwork = PublicArtwork & { card: { label: string; path: string; name: string } };

type PortfolioRow = ArtworkRow & { cards: { set_code: string; collector_number: string; name_ko: string } };

// 승인된 작가만 공개한다. 작품은 공개(active) 상태만, 최신 순.
export async function getPortfolio(handle: string): Promise<{ artist: Artist; artworks: PortfolioArtwork[] } | null> {
  if (!HANDLE.test(handle)) return null;
  const found = await db()
    .from("artists")
    .select(COLUMNS)
    .eq("handle", handle)
    .eq("status", "approved")
    .maybeSingle<ArtistRow>();
  if (found.error) throw found.error;
  if (!found.data) return null;
  const artist = fromRow(found.data);

  const { data, error } = await db()
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

// 철회한 작품은 빼고, 숨김(어드민이 내린 것)은 보여 준다.
export async function listMyArtworks(artistId: string): Promise<MyArtwork[]> {
  const { data, error } = await db()
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

// 작가가 자기 작품을 내린다 = 철회(파일 삭제, 되돌릴 수 없음). 어드민 철회와 같이 카드 번호를 확인한다.
// 숨김·복구는 어드민 몫이다(어드민이 숨긴 작품을 작가가 되살리지 못하게).
export async function withdrawMyArtwork(artist: Artist, artworkId: string, confirm: string): Promise<void> {
  if (!UUID.test(artworkId)) throw new ArtworkError("not_found");
  const { data, error } = await db().from("artworks").select("artist_id").eq("id", artworkId).maybeSingle();
  if (error) throw error;
  if (!data || data.artist_id !== artist.userId) throw new ArtworkError("not_found");
  const expected = await expectedConfirm(artworkId);
  if (!expected || normalizeConfirm(confirm) !== normalizeConfirm(expected)) throw new ArtworkError("confirm_mismatch");
  await setStatus(artworkId, "withdrawn", { reason: "작가 본인 요청", actor: artistActor(artist) });
}
