import { backendMutate } from "@/lib/api/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return backendMutate("/contracts", { method: "POST", body });
}
