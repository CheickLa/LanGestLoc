import { backendFetch, backendStream } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

type Receipt = components["schemas"]["ReceiptEntity"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;

  let receipt: Receipt;
  try {
    receipt = await backendFetch<Receipt>(`/receipts/payment/${paymentId}`);
  } catch {
    return new Response("Reçu introuvable", { status: 404 });
  }

  const upstream = await backendStream(`/receipts/${receipt.id}/download`);
  if (!upstream.ok || !upstream.body) {
    return new Response("Reçu indisponible", { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // Affichage inline : le reçu s'ouvre dans l'onglet (lien front en _blank).
      "Content-Disposition": `inline; filename="${receipt.receiptNo}.pdf"`,
    },
  });
}
