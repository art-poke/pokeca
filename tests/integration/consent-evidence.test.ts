import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAdminAction } from "@/lib/admin";
import { evidenceUrl } from "@/lib/admin-data";
import { ArtworkError, createArtwork, type NewArtwork } from "@/lib/artworks";
import { cleanup } from "@/lib/cleanup";
import { createUpload, StorageInputError } from "@/lib/storage";
import { putObject } from "@/lib/storage-client";
import { GET as viewEvidence } from "@/app/api/admin/evidence/[eventId]/route";
import {
  cardId,
  evidencePaths,
  FAKE_PNG,
  PDF,
  PNG,
  resetArtworks,
  sql,
  storedPaths,
  uploadAsBrowser,
} from "../helpers/fixtures";

// blocked until sub D (storage): 허락 근거 업로드·열람·삭제가 전부 Supabase 스토리지에 의존한다.
// evidenceUrl의 비스토리지 부분("경로 없음→null")은 admin-data-drizzle.test.ts가 커버한다.

// @/auth는 node 전용 next-auth를 끌어와 테스트 환경에서 import가 깨진다(artists-auth.test.ts와 동일).
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
// 라우트 핸들러를 요청 밖에서 부르므로 쿠키 저장소를 빈 것으로 바꾼다(= 로그인하지 않은 요청).
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

afterAll(() => sql.end());
beforeEach(resetArtworks);

// 허락 근거 업로드 (설계 R3): 별도 비공개 버킷, 어드민 라우트로만 열람.

const admin = { userId: "00000000-0000-0000-0000-000000000001", email: "admin@test" };

async function input(overrides: Partial<NewArtwork> = {}): Promise<NewArtwork> {
  return {
    id: crypto.randomUUID(),
    cardId: await cardId(),
    artistName: "근거작가",
    format: "9pocket",
    sourceUrl: "https://cafe.naver.com/example/7",
    sourceVisibility: "public",
    printSizeVerified: false,
    ...overrides,
  };
}

// 원본(PDF)과 미리보기를 올려 작품을 만든다. extra로 허락 근거를 함께 넘길 수 있다.
async function create(a: NewArtwork, extra: { evidence?: string } = {}) {
  const original = await uploadAsBrowser("original", PDF, "application/pdf");
  const thumbnail = await uploadAsBrowser("thumbnail", PNG, "image/png");
  await createArtwork(a, { original, thumbnail, ...extra }, "test");
  return { original, thumbnail };
}

async function events(id: string) {
  return sql<{ id: string; kind: string; evidence_path: string | null }[]>`
    select id::text, kind, evidence_path from consent_events where artwork_id = ${id} order by id`;
}

const later = () => new Date(Date.now() + 24 * 60 * 60 * 1000 + 60_000);

describe("evidence upload validation", () => {
  it("accepts png, jpeg, pdf up to 20 MB and rejects anything else", async () => {
    await expect(createUpload({ kind: "evidence", mimeType: "image/gif", sizeBytes: 10 })).rejects.toThrow(
      "bad_file_type",
    );
    await expect(
      createUpload({ kind: "evidence", mimeType: "image/png", sizeBytes: 20 * 1024 * 1024 + 1 }),
    ).rejects.toSatisfy((e) => e instanceof StorageInputError && e.message === "file_too_large");
    expect(await createUpload({ kind: "evidence", mimeType: "application/pdf", sizeBytes: 20 * 1024 * 1024 }))
      .toMatchObject({ key: expect.stringMatching(/^pending\//) });
  });

  it("uploads into the private evidence bucket, not the artworks bucket", async () => {
    await uploadAsBrowser("evidence", PNG, "image/png");
    expect(await evidencePaths()).toHaveLength(1);
    expect(await storedPaths()).toEqual([]);
  });

  it("deletes an evidence file whose bytes are not an allowed type and creates nothing", async () => {
    const evidence = await uploadAsBrowser("evidence", FAKE_PNG, "image/png");
    await expect(create(await input(), { evidence })).rejects.toSatisfy(
      (e) => e instanceof ArtworkError && e.code === "bad_file_type",
    );
    expect(await evidencePaths()).toEqual([]);
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int from artworks`;
    expect(count).toBe(0);
  });
});

describe("evidence_path is recorded", () => {
  it("on create, under the artwork in the evidence bucket", async () => {
    const a = await input();
    const evidence = await uploadAsBrowser("evidence", PDF, "application/pdf");
    const uploads = await create(a, { evidence });
    // 재시도해도 같은 경로(멱등).
    await createArtwork(a, { ...uploads, evidence }, "test");

    const [created] = await events(a.id);
    expect(created).toMatchObject({ kind: "created", evidence_path: `artworks/${a.id}/${evidence}` });
    expect(await evidencePaths()).toEqual([created.evidence_path]);
  });

  it("on each evidence added later from the admin page", async () => {
    const a = await input();
    await create(a);

    const first = await uploadAsBrowser("evidence", PNG, "image/png");
    await applyAdminAction(a.id, { action: "evidence", evidenceUploadId: first, reason: "DM" }, admin);
    const second = await uploadAsBrowser("evidence", PDF, "application/pdf");
    await applyAdminAction(a.id, { action: "evidence", evidenceUploadId: second }, admin);

    const [created, ...added] = await events(a.id);
    expect(created.evidence_path).toBeNull();
    expect(added).toMatchObject([
      { kind: "consent", evidence_path: `artworks/${a.id}/${first}` },
      { kind: "consent", evidence_path: `artworks/${a.id}/${second}` },
    ]);

    // 기록된 근거는 정리 작업이 지우지 않는다.
    expect(await cleanup(later())).toMatchObject({ evidence: 0 });
    expect(await evidencePaths()).toHaveLength(2);
  });

  it("refuses an evidence action without a file", async () => {
    const a = await input();
    await create(a);
    await expect(
      applyAdminAction(a.id, { action: "evidence" } as never, admin),
    ).rejects.toSatisfy((e) => e instanceof ArtworkError && e.code === "evidence_required");
    expect(await events(a.id)).toHaveLength(1);
  });
});

describe("cleanup of evidence", () => {
  it("removes stale pending evidence and moved evidence that no event recorded", async () => {
    await uploadAsBrowser("evidence", PNG, "image/png");
    const orphan = `artworks/${crypto.randomUUID()}/${crypto.randomUUID()}`;
    await putObject("consent-evidence", orphan, PNG, "image/png");

    expect(await cleanup()).toMatchObject({ evidence: 0 });
    expect(await cleanup(later())).toMatchObject({ evidence: 2 });
    expect(await evidencePaths()).toEqual([]);
  });
});

describe("evidence view is admin only", () => {
  async function recorded() {
    const a = await input();
    const evidence = await uploadAsBrowser("evidence", PNG, "image/png");
    await create(a, { evidence });
    const [created] = await events(a.id);
    return created.id;
  }

  it("returns 401 to a request without an admin session", async () => {
    const eventId = await recorded();
    const res = await viewEvidence(new Request(`http://localhost/api/admin/evidence/${eventId}`), {
      params: Promise.resolve({ eventId }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("signs only paths recorded on an event, for a short time", async () => {
    const eventId = await recorded();
    const url = await evidenceUrl(eventId);
    // S3 presigned URL은 버킷을 서브도메인에 둔다(pokeca-consent-evidence-….s3.…amazonaws.com).
    expect(url).toContain("consent-evidence");
    const res = await fetch(url!);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);

    expect(await evidenceUrl("999999")).toBeNull();
    expect(await evidenceUrl("artworks/x/y")).toBeNull();
    expect(await evidenceUrl("../artworks")).toBeNull();
  });

  it("cannot be read without a signed URL (private bucket blocks anonymous access)", async () => {
    await recorded();
    const [path] = await evidencePaths();
    // 서명 없는 평문 GET은 비공개 버킷(public-access-block)이 거부해야 한다.
    const region = process.env.AWS_REGION ?? "ap-northeast-1";
    const raw = `https://${process.env.S3_BUCKET_EVIDENCE}.s3.${region}.amazonaws.com/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const res = await fetch(raw);
    expect(res.ok).toBe(false);
    expect([401, 403]).toContain(res.status);
  });

  it("is not reachable from any public route", () => {
    // 근거 버킷을 읽는 코드는 어드민 라우트·화면에서만 import한다.
    const root = path.resolve(import.meta.dirname, "../../app");
    const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f));
    const offenders = files.filter((f) => {
      const admin = /^(api\/)?admin\//.test(f.split(path.sep).join("/"));
      const src = readFileSync(path.join(root, f), "utf8");
      return !admin && /consent-evidence|evidenceUrl|signedEvidenceUrl|promoteEvidence|EVIDENCE_BUCKET/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
