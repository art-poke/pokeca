export const artistKeys = {
  all: ["artists"] as const,
  search: (q: string) => [...artistKeys.all, "search", q] as const,
};
