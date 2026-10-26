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
