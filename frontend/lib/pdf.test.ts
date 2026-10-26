import { describe, expect, it, vi } from "vitest";
import { fetchPdf, filenameFromDisposition, PdfUnavailableError } from "./pdf";

function pdfResponse(): Response {
  return new Response("%PDF-1.4", {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="bail-c1.pdf"',
    },
  });
}

function fakeFetch(response: () => Response): typeof fetch {
  return vi.fn(async () => response()) as unknown as typeof fetch;
}

describe("filenameFromDisposition", () => {
  it("lit le nom entre guillemets", () => {
    expect(
      filenameFromDisposition('inline; filename="REC-2026-0001.pdf"', "document.pdf"),
    ).toBe("REC-2026-0001.pdf");
  });

  it("retombe sur le nom par défaut sans filename", () => {
    expect(filenameFromDisposition("inline", "document.pdf")).toBe("document.pdf");
    expect(filenameFromDisposition(null, "document.pdf")).toBe("document.pdf");
  });
});

describe("fetchPdf", () => {
  it("renvoie un File nommé d'après l'en-tête", async () => {
    const file = await fetchPdf("/x", fakeFetch(pdfResponse));
    expect(file.name).toBe("bail-c1.pdf");
    expect(file.type).toBe("application/pdf");
  });

  it("rejette sur une réponse 404", async () => {
    const fetcher = fakeFetch(() => new Response("", { status: 404 }));
    await expect(fetchPdf("/x", fetcher)).rejects.toBeInstanceOf(PdfUnavailableError);
  });

  it("rejette sur une page HTML (redirection vers /login)", async () => {
    const fetcher = fakeFetch(
      () =>
        new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    );
    await expect(fetchPdf("/x", fetcher)).rejects.toBeInstanceOf(PdfUnavailableError);
  });
});
