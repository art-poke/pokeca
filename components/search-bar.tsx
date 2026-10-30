import Form from "next/form";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchButton } from "./SearchButton";

type Variant = "hero" | "header";

// 카드 검색은 JS 없이도 동작하는 GET 폼. next/form이 클라이언트 이동과 pending 표시를 더한다.
export const SearchBar = ({
  variant = "hero",
  defaultValue = "",
}: {
  variant?: Variant;
  defaultValue?: string;
}) => {
  const isHero = variant === "hero";
  const id = `q-${variant}`;
  return (
    <Form
      role="search"
      action="/search"
      aria-label={isHero ? undefined : "머리글 카드 검색"}
      className="w-full"
    >
      {isHero && (
        <label htmlFor={id} className="mb-2 block text-sm font-semibold text-muted-foreground">
          카드 번호 또는 이름
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-border bg-background shadow-sm transition-colors",
          "focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15",
          isHero ? "p-2" : "p-1.5",
        )}
      >
        <Search
          className={cn("ml-2 shrink-0 text-muted-foreground", isHero ? "size-6" : "size-5")}
          aria-hidden
        />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={isHero ? "sv2a 201/165, 리자몽" : "카드 검색"}
          aria-label={isHero ? undefined : "카드 번호 또는 이름 검색"}
          className={cn(
            "min-w-0 flex-1 bg-transparent font-medium text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal tabular",
            isHero ? "h-12 text-lg" : "h-9 text-base",
          )}
        />
        <SearchButton
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground transition-colors hover:bg-red-600 active:bg-red-700 aria-disabled:opacity-70",
            isHero ? "h-12 px-6 text-base" : "h-9 px-4 text-sm",
          )}
        />
      </div>
      {isHero && (
        <p className="mt-2 text-sm text-muted-foreground">
          예: <span className="tabular font-medium text-ink-600">sv2a 201/165</span>, 리자몽
        </p>
      )}
    </Form>
  );
};
