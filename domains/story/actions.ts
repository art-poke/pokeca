"use server";

import { getStoryFeed } from "@/lib/story-feed";
import { isStoryCategory, type StoryFilter } from "./types";

export async function fetchStoryFeed(category: StoryFilter, excludedSlug: string, cursor: string | null) {
  if (category !== "all" && !isStoryCategory(category)) return { items: [], nextCursor: null };
  return getStoryFeed(category, excludedSlug, cursor);
}
