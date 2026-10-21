import { requireAdmin } from "@/lib/auth-server";
import { backendFetch } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

import { UsersPageClient } from "./users-page-client";

type User = components["schemas"]["UserEntity"];

export type UsersPage = {
  items: User[];
  total: number;
  skip: number;
  take: number;
};

const DEFAULT_TAKE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  const currentUser = await requireAdmin();
  const { skip: skipParam } = await searchParams;

  const skip = Math.max(0, Number(skipParam ?? 0) || 0);

  const data = await backendFetch<UsersPage>(
    `/users?skip=${skip}&take=${DEFAULT_TAKE}`,
  );

  return <UsersPageClient data={data} currentUserId={currentUser.id} />;
}
