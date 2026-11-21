import { stories } from "@/app/stories/stories";
import { memberRoute } from "@/lib/artist-route";
import { setStoryLike } from "@/lib/story-likes";

export const PUT = memberRoute(
  async (request, ctx: RouteContext<"/api/stories/[slug]/likes">, member) => {
    const { slug } = await ctx.params;
    const story = stories.find((item) => item.slug === slug);
    if (!story) return Response.json({ code: "not_found" }, { status: 404 });

    const payload = (await request.json().catch(() => null)) as { liked?: unknown } | null;
    if (typeof payload?.liked !== "boolean") {
      return Response.json({ code: "invalid_json" }, { status: 400 });
    }
    return Response.json(await setStoryLike(story.id, member.userId, payload.liked));
  },
);
