import { stories } from "@/app/stories/stories";
import { recordStoryView } from "@/lib/story-views";
import { visitorId } from "@/lib/visitor";

export async function POST(_request: Request, ctx: RouteContext<"/api/stories/[slug]/views">) {
  const { slug } = await ctx.params;
  const story = stories.find((item) => item.slug === slug);
  if (!story) return Response.json({ code: "not_found" }, { status: 404 });

  const visitor = await visitorId();
  if (!visitor) return Response.json({ code: "no_visitor" }, { status: 400 });

  return Response.json(await recordStoryView(story.id, visitor), {
    headers: { "Cache-Control": "no-store" },
  });
}
