import { backendMutate } from "@/lib/api/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  return backendMutate(`/tenants/${id}`, { method: "PATCH", body });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return backendMutate(`/tenants/${id}`, { method: "DELETE" });
}
