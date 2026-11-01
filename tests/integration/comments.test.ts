import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CommentError,
  commentCount,
  createComment,
  deleteComment,
  listComments,
} from "@/lib/comments";
import { db } from "@/lib/db";
import { comments, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// 다형 댓글 생성/목록/대댓글/소프트삭제/카운트를 로컬 Docker Postgres(5432)에 직접 검증한다.
// target_id는 FK 없는 다형 참조이므로 아무 UUID나 대상으로 쓴다.

const TAG = `cmt${Date.now()}`;
const targetId = crypto.randomUUID(); // artwork 대상(FK 없음)

let userA: string;
let userB: string;

beforeAll(async () => {
  [{ id: userA }, { id: userB }] = await db
    .insert(users)
    .values([{ email: `${TAG}-a@example.com` }, { email: `${TAG}-b@example.com` }])
    .returning({ id: users.id });
});

afterAll(async () => {
  await db.delete(comments).where(eq(comments.targetId, targetId));
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

describe("createComment / listComments", () => {
  it("루트 댓글 생성 후 목록에 mine 플래그와 함께 보인다", async () => {
    await createComment({
      target: "artwork",
      targetId,
      userId: userA,
      authorName: "별빛",
      body: "  좋은 도안이에요  ",
    });

    const asAuthor = await listComments("artwork", targetId, userA);
    expect(asAuthor).toHaveLength(1);
    expect(asAuthor[0]).toMatchObject({ authorName: "별빛", body: "좋은 도안이에요", mine: true, deleted: false });

    const asOther = await listComments("artwork", targetId, userB);
    expect(asOther[0].mine).toBe(false);
  });

  it("빈 본문·너무 긴 본문·없는 대상은 거절한다", async () => {
    await expect(
      createComment({ target: "artwork", targetId, userId: userA, authorName: "x", body: "   " }),
    ).rejects.toSatisfy((e) => e instanceof CommentError && e.code === "empty");
    await expect(
      createComment({ target: "artwork", targetId, userId: userA, authorName: "x", body: "a".repeat(2001) }),
    ).rejects.toSatisfy((e) => e instanceof CommentError && e.code === "too_long");
    await expect(
      createComment({ target: "artwork", targetId: "not-a-uuid", userId: userA, authorName: "x", body: "hi" }),
    ).rejects.toSatisfy((e) => e instanceof CommentError && e.code === "not_found");
  });

  it("1단계 대댓글만 허용한다", async () => {
    const [root] = await listComments("artwork", targetId, userA);
    await createComment({
      target: "artwork",
      targetId,
      userId: userB,
      authorName: "다른회원",
      body: "동의해요",
      parentId: root.id,
    });

    const tree = await listComments("artwork", targetId, userA);
    const parent = tree.find((c) => c.id === root.id)!;
    expect(parent.replies).toHaveLength(1);
    expect(parent.replies[0].authorName).toBe("다른회원");

    // 대댓글에 다시 대댓글은 invalid_parent.
    await expect(
      createComment({
        target: "artwork",
        targetId,
        userId: userA,
        authorName: "x",
        body: "중첩",
        parentId: parent.replies[0].id,
      }),
    ).rejects.toSatisfy((e) => e instanceof CommentError && e.code === "invalid_parent");
  });
});

describe("deleteComment / commentCount", () => {
  it("본인/어드민만 소프트삭제하고, 삭제 후 카운트에서 빠진다", async () => {
    const before = await commentCount("artwork", targetId);
    expect(before).toBe(2); // 루트 + 대댓글

    const [root] = await listComments("artwork", targetId, userA);

    // 남이 삭제 시도 → forbidden.
    await expect(deleteComment(root.id, userB, false)).rejects.toSatisfy(
      (e) => e instanceof CommentError && e.code === "forbidden",
    );
    // 본인 삭제 OK(소프트).
    await deleteComment(root.id, userA, false);
    expect(await commentCount("artwork", targetId)).toBe(1); // 루트 빠짐

    // 삭제된 루트도 답글이 남아 있으면 목록에 "삭제된 댓글이에요."로 유지.
    const tree = await listComments("artwork", targetId, userA);
    const kept = tree.find((c) => c.id === root.id);
    expect(kept).toBeTruthy();
    expect(kept!.deleted).toBe(true);
    expect(kept!.body).toBe("삭제된 댓글이에요.");

    // 재삭제는 no-op(에러 없음).
    await expect(deleteComment(root.id, userA, false)).resolves.toBeUndefined();
  });
});
