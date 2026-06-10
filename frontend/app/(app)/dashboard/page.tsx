import { requireUser } from "@/lib/auth-server";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="p-7">
      <h1 className="text-2xl font-semibold text-foreground">Tableau de bord</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Connecté en tant que <span className="font-medium text-foreground">{user.name}</span>{" "}
        ({user.email}) — rôle {user.role}.
      </p>
    </main>
  );
}
