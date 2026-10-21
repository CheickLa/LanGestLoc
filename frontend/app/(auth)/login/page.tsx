import Image from "next/image";
import Link from "next/link";

import { LeasePaper, ReceiptPaper } from "@/components/landing/papers";
import { HOME_PATH } from "@/lib/auth";

import { LoginForm } from "./login-form";

const PAPER =
  "absolute top-1/2 left-1/2 aspect-[1/1.414] w-[min(44%,400px)] overflow-hidden rounded-[3px] bg-background";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:bg-background">
      <div aria-hidden className="relative hidden overflow-hidden bg-canvas lg:order-2 lg:block">
        <div className={`${PAPER} -translate-x-[78%] -translate-y-[58%] rotate-6 shadow-[var(--paper-shadow-soft)]`}>
          <LeasePaper />
        </div>
        <div
          className={`${PAPER} -translate-x-[30%] -translate-y-[44%] -rotate-3 shadow-[var(--paper-shadow)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-700`}
        >
          <ReceiptPaper kind="payment" />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-6 md:px-8 lg:px-12 lg:py-10">
        <Link href={HOME_PATH} aria-label="LanGestLoc, accueil" className="hidden self-start lg:block">
          <Image src="/logo.svg" alt="LanGestLoc" width={126} height={34} priority className="h-[34px] w-auto" />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8 lg:py-12">
          <div className="flex flex-col rounded-2xl border border-border bg-background px-5 pt-8 pb-6 shadow-[var(--paper-shadow-soft)] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <Link href={HOME_PATH} aria-label="LanGestLoc, accueil" className="self-center lg:hidden">
              <Image
                src="/icon.svg"
                alt="LanGestLoc"
                width={72}
                height={72}
                priority
                className="drop-shadow-lg drop-shadow-primary/30"
              />
            </Link>
            <h1 className="mt-6 text-center text-[1.75rem] leading-tight font-bold tracking-[-0.03em] lg:mt-0 lg:text-left lg:text-[2.125rem]">
              Connexion
            </h1>
            <p className="mt-1.5 text-center text-[15px] text-muted-foreground lg:text-left">
              Accédez à vos boutiques, contrats et loyers.
            </p>
            <div className="mt-8 lg:mt-7">
              <LoginForm />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground lg:text-left">
          Accès réservé. Les comptes sont créés par l&apos;administrateur.
        </p>
      </div>
    </main>
  );
}
