"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { reset: () => void }) {
  const router = useRouter();

  // reset seul réafficherait la page sans redemander les données au serveur
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
      <CloudOff aria-hidden className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-[-0.02em]">
        Service momentanément indisponible
      </h1>
      <p className="max-w-xs text-[15px] text-muted-foreground">
        Le serveur ne répond pas. Réessayez dans un instant.
      </p>
      <Button className="mt-3" onClick={retry}>
        Réessayer
      </Button>
    </main>
  );
}
