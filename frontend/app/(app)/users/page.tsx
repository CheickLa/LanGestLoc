import { requireAdmin } from "@/lib/auth-server";
import { backendFetchPage, type Paginated } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { UsersPageClient } from "./users-page-client";

type User = components["schemas"]["UserEntity"];

export type UsersPage = Paginated<User>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  const currentUser = await requireAdmin();
  const { skip } = await searchParams;

  // L'API des utilisateurs n'a pas de recherche : seul `skip` est relayé
  const { data } = await backendFetchPage<User>("/users", { skip });

  return <UsersPageClient data={data} currentUserId={currentUser.id} />;
}
