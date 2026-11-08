"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { CARD_SEARCH_ENDPOINTS } from "./api/endpoints";
import { cardSearchKeys } from "./api/queries";
import type { CardSearchPage } from "./api/types";

const PAGE_SIZE = 20;

// 1페이지(SSR)를 initialData로 주입받아, 2페이지부터 /api/search로 이어 받는다.
export const useCardSearchInfinite = (query: string, initial: CardSearchPage) =>
  useInfiniteQuery({
    queryKey: cardSearchKeys.byQuery(query),
    queryFn: ({ pageParam }) =>
      apiFetch<CardSearchPage>(CARD_SEARCH_ENDPOINTS.page(query, pageParam)),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    initialData: { pages: [initial], pageParams: [0] },
  });
