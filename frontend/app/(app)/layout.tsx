import { requireUser } from "@/lib/auth-server";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <Providers>
      <AppShell user={user}>{children}</AppShell>
      <Toaster position="top-center" richColors />
    </Providers>
  );
}
