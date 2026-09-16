import { backendStream } from "@/lib/api/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const upstream = await backendStream(`/contracts/${id}/document/download`);

  if (!upstream.ok || !upstream.body) {
    return new Response("Bail indisponible", { status: upstream.status || 502 });
  }

  // Affichage inline : le PDF s'ouvre dans l'onglet (le lien front cible _blank)
  // plutôt que de se télécharger. On reprend le filename du backend si présent.
  const disposition =
    upstream.headers.get("Content-Disposition")?.replace("attachment", "inline") ??
    `inline; filename="bail-${id}.pdf"`;

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
