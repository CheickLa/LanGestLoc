import { NextResponse } from "next/server";

import { backendMutate } from "@/lib/api/server";

// L'API renvoie le jeton du compte créé : il ne doit pas atteindre le navigateur.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const response = await backendMutate("/auth/register", { method: "POST", body });
  return response.ok ? new NextResponse(null, { status: 201 }) : response;
}
