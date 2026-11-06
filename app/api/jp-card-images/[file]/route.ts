import { readFile } from "node:fs/promises";
import path from "node:path";
import { viewUrl } from "@/lib/storage-client";

// SNKRDUNK 일어판 카드 이미지.
//  - 로컬(dev): .cache/snkrdunk-images 에서 바로 읽어 서빙.
//  - 상용: uploads 버킷 jp-cards/ 에 올려두고 서명 URL 302(= /api/card-images와 동일 패턴).
const FILE = /^\d+\.webp$/;

export async function GET(_req: Request, ctx: RouteContext<"/api/jp-card-images/[file]">) {
  const { file } = await ctx.params;
  if (!FILE.test(file)) return new Response(null, { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), ".cache/snkrdunk-images", file));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    // 로컬에 없으면 S3(uploads 버킷)로.
    try {
      const url = await viewUrl("artworks", `jp-cards/${file}`, { ttl: 3600 });
      return new Response(null, {
        status: 302,
        headers: { Location: url, "Cache-Control": "public, max-age=3000" },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  }
}
