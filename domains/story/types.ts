export const storyCategoryLabels = {
  promo: "프로모 뒷이야기",
  auction: "낙찰 기록",
  release: "새 카드 소식",
} as const;

export type StoryCategory = keyof typeof storyCategoryLabels;
export type StoryFilter = StoryCategory | "all";

export function isStoryCategory(value: unknown): value is StoryCategory {
  return typeof value === "string" && Object.hasOwn(storyCategoryLabels, value);
}

export type StoryCardData = {
  slug: string;
  category: StoryCategory;
  title: string;
  summary: string;
  author: string;
  researchedOn: string;
  image: { src: string; width: number; height: number };
  views: number;
  likes: number;
  comments: number;
};

export type StoryFeedPage = {
  items: StoryCardData[];
  nextCursor: string | null;
};
