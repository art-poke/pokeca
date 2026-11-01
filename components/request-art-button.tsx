"use client";

import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRequestArtMutation } from "@/domains/card-request/hooks";
import { isApiError } from "@/lib/api/errors";
import { showErrorToast, showLoginNudge, showSuccessToast } from "@/lib/toast/gr-toast";
import { FORMAT_INFO, type Format } from "@/lib/formats";

// 도안이 없는 규격만 요청 버튼으로 보여준다. 회원 규격별 요청(피드백은 toast).
export const RequestArtButton = ({
  cardId,
  isMember,
  missingFormats,
  requestedFormats,
}: {
  cardId: string;
  isMember: boolean;
  missingFormats: Format[];
  requestedFormats: Format[];
}) => {
  const router = useRouter();
  const [requested, setRequested] = useState<Format[]>(requestedFormats);
  const { mutate, isPending, variables: sendingFormat } = useRequestArtMutation(cardId);

  if (missingFormats.length === 0) return null;

  const nudge = () =>
    showLoginNudge("로그인하면 요청할 수 있어요", () => router.push("/artist/login"));

  function request(format: Format) {
    if (!isMember) return nudge();
    if (requested.includes(format) || isPending) return;
    mutate(format, {
      onSuccess: () => {
        setRequested((r) => [...r, format]);
        showSuccessToast(`${FORMAT_INFO[format].label} 도안을 요청했어요`);
      },
      onError: (error) => {
        if (isApiError(error) && error.status === 401) return nudge();
        showErrorToast(isApiError(error) ? error.code ?? undefined : undefined);
      },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <Megaphone className="size-4" aria-hidden />
        없는 규격 요청:
      </span>
      {missingFormats.map((f) => {
        const done = requested.includes(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => request(f)}
            disabled={done || (isPending && sendingFormat === f)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-primary hover:text-primary disabled:opacity-70"
          >
            {FORMAT_INFO[f].label} {done ? "요청함" : "요청"}
          </button>
        );
      })}
    </div>
  );
};
