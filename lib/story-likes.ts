import "server-only";
import { recordActivity } from "./analytics/write";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { storyLikes } from "@/lib/db/schema";

export async function getStoryLikes(storyId: string, userId: string | null) {
  const [state] = await db.select({
    count: count(),
    liked: sql<boolean>`coalesce(bool_or(${storyLikes.userId} = ${userId}), false)`,
  }).from(storyLikes).where(eq(storyLikes.storyId, storyId));
  return state;
}

export async function setStoryLike(storyId: string, userId: string, liked: boolean) {
  if (liked) {
    const created = await db.insert(storyLikes).values({ storyId, userId }).onConflictDoNothing().returning({id:storyLikes.storyId});
    if (created.length) await recordActivity("story_liked",userId,{id:storyId});
  } else {
    await db.delete(storyLikes).where(and(eq(storyLikes.storyId, storyId), eq(storyLikes.userId, userId)));
  }
  return getStoryLikes(storyId, userId);
}
