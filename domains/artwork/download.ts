import { ApiError } from "@/lib/api/errors";

// 출처 클릭 집계(fire-and-forget beacon — 페이지 이동에도 살아남게 sendBeacon).
export const trackSourceClick = (artworkId: string) => {
  navigator.sendBeacon?.(
    "/api/events",
    JSON.stringify({ type: "source_click", artworkId }),
  );
};

// 도안 다운로드. 단일 조각=서명URL(JSON), 여러 조각=ZIP(blob) 분기 후 브라우저 다운로드 트리거.
// JSON apiFetch 모델에 안 맞는 바이너리 흐름이라 전용 유틸로 둔다. 실패 시 ApiError throw.
export const downloadArtwork = async (artworkId: string): Promise<void> => {
  const res = await fetch(`/api/download/${artworkId}`, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status === 401 ? "unauthorized" : null, res.status);

  const a = document.createElement("a");
  let revoke: string | null = null;
  if (res.headers.get("content-type")?.includes("application/json")) {
    const { url } = (await res.json()) as { url: string };
    a.href = url;
  } else {
    const blob = await res.blob();
    revoke = URL.createObjectURL(blob);
    a.href = revoke;
    a.download = decodeURIComponent(res.headers.get("X-Download-Filename") ?? "도안.zip");
  }
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  if (revoke) URL.revokeObjectURL(revoke);
};
