import { backendMutate } from "@/lib/api/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return backendMutate("/tenants", { method: "POST", body });
}
