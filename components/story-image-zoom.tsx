"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useId, useRef, useState } from "react";

type Photo = { src: string; width: number; height: number; alt: string; credit?: string };

export function StoryImageZoom({ photo, children }: { photo: Photo; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`${photo.alt} 크게 보기`}
        aria-haspopup="dialog"
        className="mx-auto block max-w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={title}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        className="m-auto max-h-[94dvh] w-fit max-w-[94vw] overflow-auto overscroll-contain rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/70"
      >
        <div className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id={title} className="sr-only">{photo.alt}</h2>
            <button type="button" autoFocus onClick={() => dialog.current?.close()}
              aria-label="사진 닫기" className="ml-auto rounded-lg p-2 hover:bg-muted">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {open && (
            <Image src={photo.src} width={photo.width} height={photo.height} alt={photo.alt}
              unoptimized className="mx-auto block h-auto max-h-[75dvh] max-w-full object-contain" />
          )}
          {photo.credit && <p className="text-center text-xs text-muted-foreground">{photo.credit}</p>}
        </div>
      </dialog>
    </>
  );
}
