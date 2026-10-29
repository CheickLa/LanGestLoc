import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { HOME_PATH } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Confidentialité — LanGestLoc",
  description: "Ce que la page d'accueil de LanGestLoc mesure, avec quels cookies, et comment changer d'avis.",
};

const CONTACT_EMAIL = "cheickla.pro@gmail.com";

const COLLECTED = [
  "les pages vues et le site d'où vous arrivez ;",
  "le pays et la ville approximative, déduits de votre adresse IP, que Google ne conserve pas ;",
  "le type d'appareil, le système, le navigateur et la langue ;",
  "la durée de la visite et le défilement de la page.",
];

const COOKIES = [
  { name: "_ga", purpose: "Reconnaître un visiteur d'une visite à l'autre", lifetime: "13 mois" },
  { name: "_ga_…", purpose: "Suivre la visite en cours", lifetime: "13 mois" },
  {
    name: "langestloc_token",
    purpose: "Vous garder connecté à l'application, posé à la connexion. Indispensable, il ne demande pas d'accord.",
    lifetime: "45 jours",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="text-xl font-bold tracking-[-0.015em]">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-pretty text-foreground/80">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-svh bg-canvas text-foreground">
      <div className="mx-auto max-w-[720px] px-4 py-5 md:px-8 md:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href={HOME_PATH} aria-label="LanGestLoc, accueil">
            <Image src="/logo.svg" alt="LanGestLoc" width={126} height={34} priority className="h-[34px] w-auto" />
          </Link>
          <Link
            href={HOME_PATH}
            className="flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Accueil
          </Link>
        </header>

        <article className="mt-8 rounded-2xl border border-border bg-background px-5 py-7 shadow-[var(--paper-shadow-soft)] md:mt-12 md:px-10 md:py-10">
          <h1 className="text-3xl leading-tight font-bold tracking-[-0.03em] md:text-4xl">Confidentialité</h1>
          <p className="mt-4 text-lg text-pretty text-foreground/80">
            La page d&apos;accueil mesure sa fréquentation avec Google Analytics, seulement si vous l&apos;acceptez.
            L&apos;application, une fois connecté, n&apos;est jamais mesurée.
          </p>

          <div className="mt-8 flex flex-col gap-8">
            <Section title="Ce qui est recueilli">
              <ul className="flex list-disc flex-col gap-1.5 pl-5">
                {COLLECTED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                Ni votre nom, ni votre adresse e-mail, ni aucune donnée de l&apos;application (contrats, paiements,
                reçus) n&apos;est envoyé à Google.
              </p>
            </Section>

            <Section title="Les cookies">
              <ul className="flex flex-col gap-3">
                {COOKIES.map((cookie) => (
                  <li key={cookie.name} className="rounded-xl bg-canvas px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <code className="font-mono text-sm font-medium text-foreground">{cookie.name}</code>
                      <span className="shrink-0 text-sm text-muted-foreground">{cookie.lifetime}</span>
                    </div>
                    <p className="mt-1 text-[15px]">{cookie.purpose}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Qui reçoit ces données">
              <p>
                Google (Google Ireland Limited) les traite pour en tirer des statistiques de fréquentation. Elles peuvent
                être transférées aux États-Unis, dans le cadre du Data Privacy Framework entre l&apos;Union européenne
                et les États-Unis. Google Analytics les conserve deux mois.
              </p>
            </Section>

            <Section title="Changer d'avis">
              <p>
                Votre choix est gardé six mois, puis la question vous est reposée. Vous pouvez le changer à tout moment
                avec le lien Cookies en bas de la page d&apos;accueil. Un refus efface les cookies de Google Analytics.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Le responsable de ces données est LanGestLoc. Pour toute question, écrivez à{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </div>
        </article>
      </div>
    </main>
  );
}
