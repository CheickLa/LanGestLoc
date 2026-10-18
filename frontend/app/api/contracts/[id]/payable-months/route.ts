import { backendMutate } from "@/lib/api/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return backendMutate(`/rent-dues/contract/${id}/payable`, { method: "GET" });
}
