import Image from "next/image";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-7 text-center">
          <Image
            src="/icon-512.png"
            alt="LanGestLoc"
            width={80}
            height={80}
            priority
          />
          <div className="grid gap-1.5">
            <CardTitle className="text-2xl">Connexion</CardTitle>
            <CardDescription>Accédez à votre espace de gestion.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <LoginForm />
          <p className="text-center text-xs text-muted-foreground">
            Accès réservé. Comptes créés par l&apos;administrateur.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
