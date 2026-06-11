import { requireUser } from "@/lib/auth-server";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <p className="text-sm text-muted-foreground">
      Connecté en tant que{" "}
      <span className="font-medium text-foreground">{user.name}</span> ({user.email})
      — rôle {user.role}.
    </p>
  );
}
