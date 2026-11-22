export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <article className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-background px-5 py-7 text-sm leading-relaxed text-ink-700 sm:px-8 sm:py-10 [&_a]:break-all [&_a]:underline [&_a]:underline-offset-4 [&_h1]:mb-4 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li+li]:mt-2 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </article>
  );
}
