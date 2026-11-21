import { ArrowUpRight, Eye, Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { storyCategoryLabels, type StoryCardData } from "@/domains/story/types";
import { cn } from "@/lib/utils";

const categoryColors = {
  promo: "bg-blue-100 text-blue-800",
  auction: "bg-violet-100 text-violet-800",
  release: "bg-cyan-100 text-cyan-800",
};

export function StoryCard({ story, featured = false }: { story: StoryCardData; featured?: boolean }) {
  const metrics = [
    { label: "조회", count: story.views, icon: Eye },
    { label: "좋아요", count: story.likes, icon: Heart },
    { label: "댓글", count: story.comments, icon: MessageCircle },
  ];

  return (
    <Link
      href={`/stories/${story.slug}`}
      className={cn(
        "group grid h-full overflow-hidden rounded-[1.25rem] border border-blue-100 bg-white text-slate-900 transition-colors hover:border-blue-400",
        featured && "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
      )}
    >
      <div className={cn(
        "relative isolate grid min-h-44 place-items-center overflow-hidden bg-blue-50 p-5 [background-image:radial-gradient(#8da9d1_0.8px,transparent_0.8px)] [background-size:12px_12px]",
        featured && "min-h-56 bg-[#dce9ff] sm:min-h-72 sm:p-8",
      )}>
        <span aria-hidden className="absolute -z-10 size-36 rounded-full bg-white/85 sm:size-44" />
        <Image
          src={story.image.src}
          alt=""
          width={story.image.width}
          height={story.image.height}
          unoptimized
          className={cn(
            "h-36 w-auto max-w-full rotate-[-5deg] rounded-md object-contain drop-shadow-[0_8px_12px_#23397055] transition-transform duration-300 motion-safe:group-hover:rotate-0",
            featured && "h-44 sm:h-56",
          )}
        />
      </div>
      <div className={cn("flex min-w-0 flex-col gap-3 p-4 sm:p-5", featured && "justify-center p-5 sm:p-7 md:p-9")}>
        <div className="flex items-center justify-between gap-3">
          <p className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-bold", categoryColors[story.category])}>
            {storyCategoryLabels[story.category]}
          </p>
          <ArrowUpRight className="size-5 shrink-0 text-blue-700 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" aria-hidden />
        </div>
        <h3 className={cn("font-display text-xl leading-tight font-bold", featured && "text-2xl md:text-3xl")}>
          {story.title}
        </h3>
        <p className="text-sm leading-relaxed break-keep text-slate-700">{story.summary}</p>
        <div className="mt-auto space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-600">
            {story.author} · <time dateTime={story.researchedOn}>{story.researchedOn}</time>
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-slate-600 sm:text-sm">
            {metrics.map(({ label, count, icon: Icon }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="size-4" aria-hidden />
                <span>{label} {count.toLocaleString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Link>
  );
}
