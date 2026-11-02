import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPost, deletePost, getPost, listPosts, PostError } from "@/lib/community";
import { db } from "@/lib/db";
import { comments, posts, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 커뮤니티 게시판(생성·목록·상세·소프트삭제·권한)을 로컬 Docker Postgres(5432)에 직접 검증한다.
// 전역 시드에 의존하지 않고 필요한 행을 Drizzle로 직접 넣고 끝나면 지운다.

const TAG = `comm${Date.now()}`;

let author: string;
let other: string;
const createdIds: string[] = [];

beforeAll(async () => {
  [{ id: author }, { id: other }] = await db
    .insert(users)
    .values([{ email: `${TAG}-a@example.com` }, { email: `${TAG}-b@example.com` }])
    .returning({ id: users.id });
});

afterAll(async () => {
  if (createdIds.length) {
    await db.delete(comments).where(inArray(comments.targetId, createdIds));
    await db.delete(posts).where(inArray(posts.id, createdIds));
  }
  await db.delete(users).where(inArray(users.id, [author, other]));
});

describe("createPost / getPost / listPosts", () => {
  it("자유게시판 글 생성·상세 조회(mine 반영)", async () => {
    const id = await createPost({
      board: "free",
      userId: author,
      authorName: `${TAG} 글쓴이`,
      title: `${TAG} 제목`,
      body: `${TAG} 본문`,
      isAdmin: false,
    });
    createdIds.push(id);

    const mine = await getPost(id, author);
    expect(mine).toMatchObject({
      id,
      board: "free",
      title: `${TAG} 제목`,
      authorName: `${TAG} 글쓴이`,
      body: `${TAG} 본문`,
      comments: 0,
      mine: true,
    });
    expect(typeof mine!.createdAt).toBe("string");

    const notMine = await getPost(id, other);
    expect(notMine!.mine).toBe(false);
    expect((await getPost(id, null))!.mine).toBe(false);
  });

  it("공지는 어드민만, 잘못된 입력은 PostError", async () => {
    await expect(
      createPost({ board: "notice", userId: author, authorName: "a", title: "t", body: "b", isAdmin: false }),
    ).rejects.toSatisfy((e) => e instanceof PostError && e.code === "forbidden");

    await expect(
      createPost({ board: "free", userId: author, authorName: "a", title: "  ", body: "b", isAdmin: false }),
    ).rejects.toSatisfy((e) => e instanceof PostError && e.code === "invalid_title");

    await expect(
      createPost({ board: "free", userId: author, authorName: "a", title: "t", body: "  ", isAdmin: false }),
    ).rejects.toSatisfy((e) => e instanceof PostError && e.code === "invalid_body");

    // 어드민은 공지 작성 가능.
    const id = await createPost({
      board: "notice",
      userId: author,
      authorName: `${TAG} 어드민`,
      title: `${TAG} 공지`,
      body: `${TAG} 공지 본문`,
      isAdmin: true,
    });
    createdIds.push(id);
    const list = await listPosts("notice");
    expect(list.some((p) => p.id === id)).toBe(true);
  });

  it("목록은 해당 보드만 최신순, 비UUID 상세는 null", async () => {
    const list = await listPosts("free");
    expect(list.every((p) => p.board === "free")).toBe(true);
    expect(await getPost("not-a-uuid", null)).toBeNull();
    expect(await getPost(crypto.randomUUID(), null)).toBeNull();
  });
});

describe("deletePost", () => {
  it("본인만 삭제, 소프트삭제 후 조회 불가", async () => {
    const id = await createPost({
      board: "free",
      userId: author,
      authorName: `${TAG} 글쓴이`,
      title: `${TAG} 지울글`,
      body: `${TAG} 본문`,
      isAdmin: false,
    });
    createdIds.push(id);

    await expect(deletePost(id, other, false)).rejects.toSatisfy(
      (e) => e instanceof PostError && e.code === "forbidden",
    );

    await deletePost(id, author, false);
    expect(await getPost(id, author)).toBeNull();
    // 멱등: 이미 삭제된 글 재삭제는 no-op.
    await deletePost(id, author, false);

    const rows = await db.select({ deletedAt: posts.deletedAt }).from(posts).where(eq(posts.id, id));
    expect(rows[0].deletedAt).not.toBeNull();
  });

  it("어드민은 남의 글도 삭제, 없는 글은 not_found", async () => {
    const id = await createPost({
      board: "free",
      userId: author,
      authorName: `${TAG} 글쓴이`,
      title: `${TAG} 어드민삭제`,
      body: `${TAG} 본문`,
      isAdmin: false,
    });
    createdIds.push(id);
    await deletePost(id, other, true); // admin
    expect(await getPost(id, author)).toBeNull();

    await expect(deletePost(crypto.randomUUID(), author, true)).rejects.toSatisfy(
      (e) => e instanceof PostError && e.code === "not_found",
    );
  });
});
