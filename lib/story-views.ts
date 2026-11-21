import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { storyViews } from "@/lib/db/schema";

export async function recordStoryView(storyId: string, visitorId: string) {
  await db.insert(storyViews).values({ storyId, visitorId }).onConflictDoNothing();
  const [result] = await db
    .select({ views: count() })
    .from(storyViews)
    .where(eq(storyViews.storyId, storyId));
  return result;
}
