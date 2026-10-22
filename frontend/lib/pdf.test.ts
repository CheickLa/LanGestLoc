import { describe, expect, it, vi } from "vitest";
import {
  deliverPdf,
  fetchPdf,
  filenameFromDisposition,
  PdfUnavailableError,
  pdfMode,
  type PdfDeps,
} from "./pdf";

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

function makeDeps(fetcher: typeof fetch) {
  const share = vi.fn<PdfDeps["share"]>(async () => {});
  const download = vi.fn<PdfDeps["download"]>();
  const shareBlocked = vi.fn<PdfDeps["shareBlocked"]>();
  return { deps: { fetch: fetcher, share, download, shareBlocked }, share, download, shareBlocked };
}

describe("pdfMode", () => {
  it("ouvre un onglet sur un pointeur précis", () => {
    expect(pdfMode({ coarsePointer: false, canShareFiles: true })).toBe("tab");
    expect(pdfMode({ coarsePointer: false, canShareFiles: false })).toBe("tab");
  });

  it("partage sur tactile quand le partage de fichiers existe", () => {
    expect(pdfMode({ coarsePointer: true, canShareFiles: true })).toBe("share");
  });

  it("télécharge sur tactile sans partage de fichiers", () => {
    expect(pdfMode({ coarsePointer: true, canShareFiles: false })).toBe("download");
  });
});

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

describe("deliverPdf", () => {
  it("ne télécharge pas quand le partage réussit", async () => {
    const { deps, share, download } = makeDeps(fakeFetch(pdfResponse));
    await deliverPdf("/x", "share", deps);
    expect(share).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
  });

  it("partage le fichier avec son nom comme titre", async () => {
    const { deps, share } = makeDeps(fakeFetch(pdfResponse));
    await deliverPdf("/x", "share", deps);
    const data = share.mock.calls[0][0];
    expect(data.title).toBe("bail-c1.pdf");
    expect(data.files?.[0].name).toBe("bail-c1.pdf");
  });

  it("ne fait rien quand l'utilisateur annule le partage", async () => {
    const { deps, share, download } = makeDeps(fakeFetch(pdfResponse));
    share.mockRejectedValue(new DOMException("", "AbortError"));
    await expect(deliverPdf("/x", "share", deps)).resolves.toBeUndefined();
    expect(download).not.toHaveBeenCalled();
  });

  it("ne fait rien de plus quand l'annulation du partage est signalée", async () => {
    const { deps, share, download, shareBlocked } = makeDeps(fakeFetch(pdfResponse));
    share.mockRejectedValue(new DOMException("", "AbortError"));
    await deliverPdf("/x", "share", deps);
    expect(download).not.toHaveBeenCalled();
    expect(shareBlocked).not.toHaveBeenCalled();
  });

  it("signale le partage refusé sans télécharger", async () => {
    const { deps, share, download, shareBlocked } = makeDeps(fakeFetch(pdfResponse));
    share.mockRejectedValue(new DOMException("", "NotAllowedError"));
    await deliverPdf("/x", "share", deps);
    expect(shareBlocked).toHaveBeenCalledTimes(1);
    expect(shareBlocked.mock.calls[0][0]).toBeInstanceOf(File);
    expect(shareBlocked.mock.calls[0][0].name).toBe("bail-c1.pdf");
    expect(download).not.toHaveBeenCalled();
  });

  it("télécharge quand le partage échoue autrement", async () => {
    const { deps, share, download, shareBlocked } = makeDeps(fakeFetch(pdfResponse));
    share.mockRejectedValue(new DOMException("", "DataError"));
    await deliverPdf("/x", "share", deps);
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0].name).toBe("bail-c1.pdf");
    expect(shareBlocked).not.toHaveBeenCalled();
  });

  it("télécharge directement en mode download", async () => {
    const { deps, share, download } = makeDeps(fakeFetch(pdfResponse));
    await deliverPdf("/x", "download", deps);
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it("rejette sans partager ni télécharger quand le PDF est indisponible", async () => {
    const { deps, share, download } = makeDeps(
      fakeFetch(() => new Response("", { status: 404 })),
    );
    await expect(deliverPdf("/x", "share", deps)).rejects.toBeInstanceOf(PdfUnavailableError);
    expect(share).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });
});
