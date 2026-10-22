export type PdfMode = "share" | "download" | "tab";

export function pdfMode(env: { coarsePointer: boolean; canShareFiles: boolean }): PdfMode {
  if (!env.coarsePointer) return "tab";
  return env.canShareFiles ? "share" : "download";
}

export function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

export class PdfUnavailableError extends Error {
  constructor() {
    super("PDF indisponible");
    this.name = "PdfUnavailableError";
  }
}

export async function fetchPdf(url: string, fetcher: typeof fetch = fetch): Promise<File> {
  const response = await fetcher(url, { credentials: "same-origin" });
  const type = response.headers.get("Content-Type") ?? "";
  if (!response.ok || !type.startsWith("application/pdf")) {
    throw new PdfUnavailableError();
  }
  const name = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    "document.pdf",
  );
  return new File([await response.blob()], name, { type: "application/pdf" });
}

export type PdfDeps = {
  fetch: typeof fetch;
  share: (data: ShareData) => Promise<void>;
  download: (file: File) => void;
  shareBlocked: (file: File) => void;
};

export async function deliverPdf(
  url: string,
  mode: "share" | "download",
  deps: PdfDeps,
): Promise<void> {
  const file = await fetchPdf(url, deps.fetch);
  if (mode === "download") {
    deps.download(file);
    return;
  }
  try {
    await deps.share({ files: [file], title: file.name });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      deps.shareBlocked(file);
      return;
    }
    deps.download(file);
  }
}

export function downloadFile(file: File): void {
  const href = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = href;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
