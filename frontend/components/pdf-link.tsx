"use client";

import * as React from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { downloadFile, fetchPdf } from "@/lib/pdf";

export function PdfLink({
  href,
  className,
  onClick,
  ...props
}: React.ComponentProps<"a"> & { href: string }) {
  const [busy, setBusy] = React.useState(false);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    // Sur téléphone, suivre le lien coince l'appli installée : on télécharge le PDF, le téléphone l'affiche.
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      downloadFile(await fetchPdf(href));
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
