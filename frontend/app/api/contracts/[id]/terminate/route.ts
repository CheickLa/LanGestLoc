import { backendMutate } from "@/lib/api/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  return backendMutate(`/contracts/${id}/terminate`, { method: "PATCH", body });
}
