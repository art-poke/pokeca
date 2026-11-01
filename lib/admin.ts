import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { db as supabaseDb } from "@/lib/supabase/server";
import { addEvidence, ArtworkError, setStatus } from "@/lib/artworks";

// 어드민 = Auth.js 로그인 + admins 허용 목록 (설계 "관리자와 업로드 보안").
// 과도기(C1): 로그인·허용 목록은 Drizzle(db)로, 작품·카드 의존 함수는 Supabase(supabaseDb)로. C2에서 정리한다.
export type Admin = { userId: string; email: string };

export async function currentAdmin(): Promise<Admin | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const rows = await db
    .select({ userId: admins.userId, email: admins.email })
    .from(admins)
    .where(eq(admins.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

// 어드민 화면과 server action의 첫 줄. 허용 목록에 없으면 로그인으로 보낸다.
export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login?denied=1");
  return admin;
}

// 파괴적 행동(철회)은 화면 확인과 별개로 서버에서도 확인한다 (eng E1).
// confirm은 그 작품 정본 카드의 "세트 번호" 문자열이어야 한다. 예: "sv2a 201/165"
export async function expectedConfirm(artworkId: string): Promise<string | null> {
  const { data, error } = await supabaseDb()
    .from("artworks")
    .select("cards(set_code, collector_number)")
    .eq("id", artworkId)
    .maybeSingle<{ cards: { set_code: string; collector_number: string } }>();
  if (error) throw error;
  return data ? `${data.cards.set_code} ${data.cards.collector_number}` : null;
}

export type AdminArtworkAction =
  | { action: "hide" | "restore"; reason?: string }
  | { action: "withdraw"; reason?: string; confirm?: string }
  | {
      action: "evidence";
      evidenceUploadId: string; // 허락 근거 업로드 ID (POST /api/admin/uploads, kind "evidence")
      reason?: string;
    };

export async function applyAdminAction(id: string, input: AdminArtworkAction, admin: Admin) {
  const actor = admin.email;
  if (!input || typeof input !== "object") throw new ArtworkError("invalid_action");
  switch (input.action) {
    case "hide":
      return setStatus(id, "hidden", { reason: input.reason, actor });
    case "restore":
      return setStatus(id, "active", { reason: input.reason, actor });
    case "withdraw":
      await requireConfirm(id, input.confirm);
      return setStatus(id, "withdrawn", { reason: input.reason, actor });
    case "evidence":
      if (typeof input.evidenceUploadId !== "string") throw new ArtworkError("evidence_required");
      await addEvidence(id, input.evidenceUploadId, { reason: input.reason, actor });
      return { changed: true, purged: true };
    default:
      throw new ArtworkError("invalid_action");
  }
}

export function normalizeConfirm(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

async function requireConfirm(id: string, confirm: string | undefined) {
  const expected = await expectedConfirm(id);
  if (!expected) throw new ArtworkError("not_found");
  if (!confirm || normalizeConfirm(confirm) !== normalizeConfirm(expected)) throw new ArtworkError("confirm_mismatch");
}
