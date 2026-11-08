export const cardSearchKeys = {
  all: ["card-search"] as const,
  byQuery: (q: string) => [...cardSearchKeys.all, q] as const,
};
