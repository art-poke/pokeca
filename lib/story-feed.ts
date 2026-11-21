import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { stories } from "@/app/stories/stories";
import type { StoryCardData, StoryFeedPage, StoryFilter } from "@/domains/story/types";
import { db } from "@/lib/db";
import { comments, storyLikes, storyViews } from "@/lib/db/schema";

const latest = [...stories].sort((a, b) =>
  b.researchedOn.localeCompare(a.researchedOn) || a.slug.localeCompare(b.slug),
);
const pageSize = 8;

const filteredStories = (category: StoryFilter) =>
  category === "all" ? latest : latest.filter((story) => story.category === category);

async function getViews(ids: string[]) {
  const rows = await db.select({ id: storyViews.storyId, total: count() })
    .from(storyViews)
    .where(inArray(storyViews.storyId, ids))
    .groupBy(storyViews.storyId);
  return new Map(rows.map(({ id, total }) => [id, total]));
}

async function getCards(items: Array<(typeof stories)[number]>): Promise<StoryCardData[]> {
  if (items.length === 0) return [];
  const ids = items.map(({ id }) => id);
  const [views, likes, replies] = await Promise.all([
    getViews(ids),
    db.select({ id: storyLikes.storyId, total: count() }).from(storyLikes)
      .where(inArray(storyLikes.storyId, ids)).groupBy(storyLikes.storyId),
    db.select({ id: comments.targetId, total: count() }).from(comments)
      .where(and(eq(comments.targetType, "story"), inArray(comments.targetId, ids), isNull(comments.deletedAt)))
      .groupBy(comments.targetId),
  ]);
  const likesById = new Map(likes.map(({ id, total }) => [id, total]));
  const commentsById = new Map(replies.map(({ id, total }) => [id, total]));

  return items.map(({ id, slug, category, title, summary, author, researchedOn, image }) => ({
    slug,
    category,
    title,
    summary,
    author,
    researchedOn,
    image: { src: image.src, width: image.width, height: image.height },
    views: views.get(id) ?? 0,
    likes: likesById.get(id) ?? 0,
    comments: commentsById.get(id) ?? 0,
  }));
}

export async function getStoryFeed(category: StoryFilter, excludedSlug: string, cursor: string | null): Promise<StoryFeedPage> {
  const remaining = filteredStories(category).filter(({ slug }) => slug !== excludedSlug);
  const previousIndex = cursor === null ? -1 : remaining.findIndex(({ slug }) => slug === cursor);
  if (cursor !== null && previousIndex === -1) return { items: [], nextCursor: null };

  const offset = previousIndex + 1;
  const page = remaining.slice(offset, offset + pageSize);
  return {
    items: await getCards(page),
    nextCursor: remaining.length > offset + page.length ? page.at(-1)?.slug ?? null : null,
  };
}

export async function getStoryIndex(category: StoryFilter) {
  const stories = filteredStories(category);
  if (stories.length === 0) return { featured: null, feed: { items: [], nextCursor: null } };
  const views = await getViews(stories.map(({ id }) => id));
  const featuredStory = stories.reduce((current, candidate) =>
    (views.get(candidate.id) ?? 0) > (views.get(current.id) ?? 0) ? candidate : current,
  );
  const [[featured], feed] = await Promise.all([
    getCards([featuredStory]),
    getStoryFeed(category, featuredStory.slug, null),
  ]);
  return { featured, feed };
}
