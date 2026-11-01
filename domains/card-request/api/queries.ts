export const cardRequestKeys = {
  all: ["card-requests"] as const,
  byCard: (cardId: string) => [...cardRequestKeys.all, cardId] as const,
};
