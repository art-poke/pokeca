import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArtistError,
  getPortfolio,
  listArtists,
  listMyArtworks,
  registerArtist,
  setArtistStatus,
  withdrawMyArtwork,
  type Artist,
  type ArtistApplication,
  type SocialUser,
} from "@/lib/artists";
import { ArtworkError, createArtwork, listPublicArtworks, setStatus } from "@/lib/artworks";
import { db } from "@/lib/supabase/server";
import { ART_PNG, cardId, resetArtworks, sql, uploadAsBrowser } from "../helpers/fixtures";

// 데이터 계층은 Drizzle(@/lib/db)로 전환됐지만 스토리지·시드 카드는 아직 Supabase(sub D)다.
// 둘이 같은 Postgres를 보도록, @/lib/db가 Pool을 만들기 전에 DATABASE_URL을 Supabase DB로 맞춘다(hoisted).
vi.hoisted(() => {
  if (process.env.SUPABASE_DB_URL) process.env.DATABASE_URL = process.env.SUPABASE_DB_URL;
});
// @/auth는 node 전용 next-auth를 끌어와 테스트 환경에서 import가 깨진다(artists-auth.test.ts와 동일).
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

afterAll(() => sql.end());

async function resetArtists() {
  const users = await sql<{ user_id: string }[]>`select user_id from artists`;
  for (const u of users) await db().auth.admin.deleteUser(u.user_id);
}

beforeEach(async () => {
  await resetArtworks();
  await resetArtists();
});

let n = 0;
// 카카오·구글로 처음 로그인한 사람. auth 계정은 서비스 키로 만든다(소셜 로그인 흉내).
async function socialUser(provider: SocialUser["provider"] = "kakao", email: string | null = null): Promise<SocialUser> {
  n += 1;
  const { data, error } = await db().auth.admin.createUser({
    email: email ?? `social${n}-${Date.now()}@example.com`,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email, provider, name: "카카오닉네임" };
}

function application(overrides: Partial<ArtistApplication> = {}): ArtistApplication {
  n += 1;
  return { handle: `artist_${n}_${Date.now() % 100000}`, displayName: "도안장인", ...overrides };
}

async function register(overrides: Partial<ArtistApplication> = {}) {
  return registerArtist(await socialUser(), application(overrides));
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => (e instanceof ArtistError || e instanceof ArtworkError) && e.code === code);
}

async function upload(artist: Artist) {
  const id = crypto.randomUUID();
  await createArtwork(
    {
      id,
      cardId: await cardId(),
      artistName: artist.displayName,
      artistId: artist.userId,
      format: "psa",
      sourceUrl: null,
      sourceVisibility: null,
      printSizeVerified: false,
    },
    { original: await uploadAsBrowser("original", ART_PNG, "image/png") },
    `artist:${artist.handle}`,
  );
  return id;
}

describe("application", () => {
  it("records a pending artist for the social account", async () => {
    const user = await socialUser("google", "pika@example.com");
    const artist = await registerArtist(user, application({ handle: "Pika_Art" }));
    expect(artist).toMatchObject({
      userId: user.id,
      handle: "pika_art",
      email: "pika@example.com",
      provider: "google",
      status: "pending",
    });
  });

  it("works without an email (Kakao without a business app)", async () => {
    const artist = await registerArtist(await socialUser("kakao", null), application());
    expect(artist).toMatchObject({ email: null, provider: "kakao" });
  });

  it("rejects bad input", async () => {
    const user = await socialUser();
    await expectCode(registerArtist(user, application({ handle: "한글" })), "invalid_handle");
    await expectCode(registerArtist(user, application({ displayName: "  " })), "invalid_name");
    await expectCode(registerArtist(user, application({ linkUrl: "cafe.naver.com" })), "invalid_link");
    expect(await listArtists()).toHaveLength(0);
  });

  it("refuses a taken handle and a second application", async () => {
    const user = await socialUser();
    await registerArtist(user, application({ handle: "same_handle" }));
    await expectCode(registerArtist(await socialUser(), application({ handle: "same_handle" })), "handle_taken");
    await expectCode(registerArtist(user, application()), "already_registered");
    expect(await listArtists()).toHaveLength(1);
  });
});

describe("approval and portfolio", () => {
  it("lists pending artists first and records who reviewed", async () => {
    const a = await register();
    const b = await register();
    await setArtistStatus(a.userId, "approved", "admin@example.com");
    const list = await listArtists();
    expect(list.map((x) => x.userId)).toEqual([b.userId, a.userId]);
    const [row] = await sql`select reviewed_by, reviewed_at from artists where user_id = ${a.userId}`;
    expect(row.reviewed_by).toBe("admin@example.com");
    expect(row.reviewed_at).not.toBeNull();
  });

  it("shows only approved artists and their active artworks, linked from the card page", async () => {
    const artist = await register();
    const id = await upload(artist);
    const hiddenId = await upload(artist);
    await setStatus(hiddenId, "hidden", { actor: "admin" });

    // 대기 중이면 작가 페이지도, 카드 페이지 링크도 없다.
    expect(await getPortfolio(artist.handle)).toBeNull();
    expect((await listPublicArtworks(await cardId())).find((a) => a.id === id)?.artistHandle).toBeNull();

    await setArtistStatus(artist.userId, "approved", "admin");
    const portfolio = await getPortfolio(artist.handle);
    expect(portfolio?.artworks.map((a) => a.id)).toEqual([id]);
    expect(portfolio?.artworks[0]).toMatchObject({
      artistName: "도안장인",
      artistHandle: artist.handle,
      card: { label: "sv2a 201/165", path: "/cards/sv2a/201-165" },
    });
    expect((await listPublicArtworks(await cardId())).find((a) => a.id === id)?.artistHandle).toBe(artist.handle);

    // 업로드를 막아도(rejected) 작가 페이지는 내려간다. 작품 자체는 어드민이 따로 숨긴다.
    await setArtistStatus(artist.userId, "rejected", "admin");
    expect(await getPortfolio(artist.handle)).toBeNull();
  });

  it("keeps artworks when the account is deleted", async () => {
    const artist = await register();
    const id = await upload(artist);
    await db().auth.admin.deleteUser(artist.userId);
    const [row] = await sql`select artist_id, artist_name, status from artworks where id = ${id}`;
    expect(row).toEqual({ artist_id: null, artist_name: "도안장인", status: "active" });
  });
});

describe("artist withdraws own artwork", () => {
  it("needs the card number and only works on the artist's own artwork", async () => {
    const artist = await register();
    const other = await register();
    const id = await upload(artist);

    await expectCode(withdrawMyArtwork(other, id, "sv2a 201/165"), "not_found");
    await expectCode(withdrawMyArtwork(artist, id, "sv2a 205/165"), "confirm_mismatch");
    expect(await listMyArtworks(artist.userId)).toHaveLength(1);

    await withdrawMyArtwork(artist, id, " SV2A  201/165 ");
    expect(await listMyArtworks(artist.userId)).toHaveLength(0);
    const [event] = await sql`
      select actor, after from consent_events where artwork_id = ${id} and kind = 'status'`;
    expect(event.actor).toBe(`artist:${artist.handle}`);
    expect(event.after).toEqual({ status: "withdrawn" });
    const files = await sql`select 1 from storage.objects where name like ${`artworks/${id}/%`}`;
    expect(files).toHaveLength(0);
  });
});
