"use client";

import { createClient } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/api/client";

// 어드민·작가 브라우저 업로드 (eng D3). 서버가 발급한 서명 URL로 Supabase Storage에 직접 올린다.
// 공개 키 클라이언트지만 서명 토큰이 있는 경로에만 쓸 수 있다.
const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false },
}).storage;

export const UPLOAD_ERRORS: Record<string, string> = {
  bad_file_type: "PNG·JPEG·PDF만 올릴 수 있어요(미리보기는 PNG·JPEG).",
  file_too_large: "파일이 너무 커요. 원본은 100 MB, 허락 근거는 20 MB까지 올릴 수 있어요.",
  upload_missing: "업로드한 파일을 찾지 못했어요. 다시 올려 주세요.",
};

// 허락 근거(evidence)는 별도 비공개 버킷에 올린다. 서명 토큰이 버킷·경로에 묶여 있어 다른 곳에는 못 쓴다.
// api는 업로드 URL을 발급하는 영역: 어드민 "/api/admin", 작가 "/api/artist", 회원 "/api/member"(아바타).
export async function uploadFile(
  kind: "original" | "thumbnail" | "evidence" | "avatar" | "review",
  file: File,
  api: "/api/admin" | "/api/artist" | "/api/member" = "/api/admin",
): Promise<string> {
  // 업로드 URL 발급은 같은 Next의 route. 실패 시 apiFetch가 ApiError(message=code)를 던진다.
  const body = await apiFetch<{ path: string; token: string; uploadId: string }>(
    `${api}/uploads`,
    {
      method: "POST",
      body: JSON.stringify({ kind, mimeType: file.type, sizeBytes: file.size }),
    },
  );
  const bucket = kind === "evidence" ? "consent-evidence" : "artworks";
  const { error } = await storage.from(bucket).uploadToSignedUrl(body.path, body.token, file, {
    contentType: file.type,
  });
  if (error) throw new Error("upload_failed");
  return body.uploadId as string;
}

export function errorMessage(code: string, fallback = "저장하지 못했어요. 다시 시도해 주세요."): string {
  return UPLOAD_ERRORS[code] ?? ERRORS[code] ?? fallback;
}

const ERRORS: Record<string, string> = {
  original_required: "원본 파일이 필요해요.",
  duplicate_position: "같은 자리에 조각이 두 개예요. 자리를 다시 확인해 주세요.",
  thumbnail_required: "미리보기를 만들지 못했어요. 미리보기 파일을 직접 올려 주세요.",
  pdf_needs_thumbnail: "PDF 원본은 미리보기를 만들 수 없어요. 미리보기(PNG·JPEG)를 함께 올려 주세요.",
  preview_failed: "원본 이미지를 읽지 못해 미리보기를 만들지 못했어요. 파일을 확인해 주세요.",
  evidence_required: "근거 파일을 골라 주세요.",
  source_visibility_required: "원본 글 공개 범위를 골라 주세요.",
  invalid_source_url: "원본 글 주소는 http(s)://로 시작해야 해요.",
  artist_required: "작가 이름을 넣어 주세요.",
  invalid_format: "규격을 골라 주세요.",
  confirm_mismatch: "카드 번호가 맞지 않아요.",
  withdrawn_is_final: "철회한 작품은 바꿀 수 없어요.",
  unauthorized: "로그인이 풀렸어요. 다시 로그인해 주세요.",
  artist_not_approved: "아직 승인되지 않은 작가 계정이에요. 승인된 뒤에 올릴 수 있어요.",
};
