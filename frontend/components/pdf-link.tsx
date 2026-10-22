"use client";

import * as React from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { deliverPdf, downloadFile, pdfMode } from "@/lib/pdf";

function offerShare(file: File) {
  toast("Le document est prêt.", {
    action: {
      label: "Partager le document",
      onClick: () => {
        navigator.share({ files: [file], title: file.name }).catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          downloadFile(file);
        });
      },
    },
  });
}

export function PdfLink({
  href,
  className,
  onClick,
  ...props
}: React.ComponentProps<"a"> & { href: string }) {
  const [busy, setBusy] = React.useState(false);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    const mode = pdfMode({
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      canShareFiles:
        navigator.canShare?.({
          files: [new File([], "x.pdf", { type: "application/pdf" })],
        }) ?? false,
    });
    if (mode === "tab") return;

    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await deliverPdf(href, mode, {
        fetch,
        share: (data) => navigator.share(data),
        download: downloadFile,
        shareBlocked: offerShare,
      });
    } catch {
      toast.error("Le document n'a pas pu être récupéré.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener"
      aria-busy={busy || undefined}
      className={cn(className, busy && "opacity-60")}
      onClick={handleClick}
    />
  );
}
