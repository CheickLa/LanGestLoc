import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Smartphone } from "lucide-react";

import { AnalyticsConsent, CookieSettingsButton } from "@/components/landing/analytics-consent";
import { DocumentStack } from "@/components/landing/document-stack";
import { PhonePreview } from "@/components/landing/phone-preview";
import { RentRegister } from "@/components/landing/rent-register";
import { Button } from "@/components/ui/button";
import { HOME_PATH, LOGIN_PATH, PRIVACY_PATH } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description:
    "Contrats de bail, suivi des loyers mois par mois et reçus de paiement pour vos locaux commerciaux.",
};

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-[1200px] px-4 md:px-8 lg:px-12", className)}>{children}</div>;
}

function SectionTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h2
      className={cn(
        "text-[1.875rem] leading-[1.08] font-bold tracking-[-0.03em] text-balance lg:text-[2.875rem]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function Lead({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("mt-4 max-w-[34em] text-lg text-pretty text-muted-foreground", className)}>{children}</p>;
}

function LoginButton({ className }: { className?: string }) {
  return (
    <Button asChild className={cn("h-12 rounded-xl px-6 text-base font-semibold", className)}>
      <Link href={LOGIN_PATH}>Se connecter</Link>
    </Button>
  );
}

const TIMELINE = [
  {
    day: "1",
    title: "Le 1er du mois",
    text: "L'échéance est créée pour chaque contrat en cours, au loyer en vigueur.",
    className: "border-2 border-primary text-primary",
  },
  {
    day: "5",
    title: "Le 5",
    text: "Dernier jour pour régler le mois précédent.",
    className: "bg-warning text-warning-foreground",
  },
  {
    day: "6",
    title: "Le 6",
    text: "Ce qui n'est pas réglé passe en retard, ici et sur le tableau de bord.",
    className: "bg-danger text-danger-foreground",
  },
];

const PWA_POINTS = [
  {
    title: "Sans store",
    text: "Elle s'installe depuis le navigateur en quelques secondes, sans Play Store ni App Store.",
  },
  {
    title: "Toujours à jour",
    text: "Chaque ouverture charge la dernière version : personne n'a de mise à jour à faire.",
  },
  {
    title: "Le même compte partout",
    text: "Les mêmes données au bureau sur l'ordinateur et sur le terrain au téléphone.",
  },
  {
    title: "Pour l'installer",
    text: "Sur Android, menu du navigateur puis Installer l'application. Sur iPhone, Partager puis Sur l'écran d'accueil.",
  },
];

const CHORES = [
  {
    before: "Recopier chaque reçu dans le carnet à souches.",
    after: "Le reçu PDF est prêt dès que le paiement est enregistré.",
  },
  {
    before: "Rédiger chaque contrat de bail à partir d'un ancien.",
    after: "Le contrat sort rempli, avec le loyer, la caution et les articles.",
  },
  {
    before: "Feuilleter le cahier pour savoir qui n'a pas payé.",
    after: "Les loyers en retard ressortent d'eux-mêmes, boutique par boutique.",
  },
  {
    before: "Additionner trois mois de loyer quand un locataire paie d'avance.",
    after: "Vous choisissez le dernier mois payé, le total se calcule.",
  },
];

const PARC = [
  {
    title: "Boutiques",
    text: "Chaque local, occupé ou libre, avec son contrat en cours. Une boutique n'a jamais deux contrats actifs à la fois.",
  },
  {
    title: "Locataires",
    text: "Les commerçants, leurs coordonnées et tous leurs contrats, successifs ou sur plusieurs boutiques.",
  },
  {
    title: "Contrats et caution",
    text: "Un contrat commence le 1er d'un mois, sa fin est facultative. La caution vaut un mois de loyer et revient au locataire à la fin, une fois les loyers soldés.",
  },
  {
    title: "Loyers",
    text: "Une augmentation vaut à partir d'un mois donné. Les mois déjà facturés gardent leur montant et l'ancien loyer reste visible.",
  },
  {
    title: "Paiements et reçus",
    text: "Un paiement enregistré ne se modifie pas, son reçu non plus. Chaque encaissement reste traçable, du mois réglé à l'agent qui l'a saisi.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="bg-canvas">
        <Container>
          <header className="flex items-center justify-between gap-4 py-4.5">
            <Link href={HOME_PATH} aria-label="LanGestLoc, accueil">
              <Image src="/logo.svg" alt="LanGestLoc" width={126} height={34} priority className="h-[34px] w-auto" />
            </Link>
            <Button asChild className="h-11 rounded-[10px] px-4.5 text-[15px] font-semibold">
              <Link href={LOGIN_PATH}>Se connecter</Link>
            </Button>
          </header>

          <div className="flex flex-col gap-7 pt-2 pb-12 lg:flex-row-reverse lg:items-center lg:gap-18 lg:pt-10 lg:pb-24">
            <div className="min-w-0 lg:flex-[1.15]">
              <DocumentStack />
            </div>
            <div className="min-w-0 lg:flex-1">
              <h1 className="text-4xl leading-[1.04] font-bold tracking-[-0.035em] text-balance md:text-5xl lg:text-[3.875rem]">
                La gestion de vos locaux commerciaux, du bail au reçu
              </h1>
              <p className="mt-5.5 max-w-[33em] text-[17px] leading-relaxed text-pretty text-foreground/80 lg:text-[19px]">
                LanGestLoc établit vos contrats de bail, suit chaque loyer mois par mois et produit un reçu à chaque
                paiement. Le tableau de bord vous montre d&apos;un coup d&apos;œil ce qui est encaissé et ce qui reste dû.
              </p>
              <div className="mt-7.5 flex flex-wrap items-center gap-x-5 gap-y-3.5">
                <LoginButton />
                <span className="max-w-[22em] text-sm text-muted-foreground">
                  Accès réservé : les comptes sont créés par l&apos;administrateur.
                </span>
              </div>
              <p className="mt-7 flex items-center gap-2.5 border-t border-foreground/10 pt-5 text-[15px] text-foreground/80">
                <Smartphone className="size-5.5 shrink-0 text-primary" strokeWidth={1.8} aria-hidden />
                Sur ordinateur et sur téléphone, où elle s&apos;installe comme une application.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-14 lg:py-28">
          <SectionTitle>Le registre des loyers, tenu tout seul</SectionTitle>
          <Lead className="max-w-[36em]">
            Chaque boutique, chaque mois, comme dans le cahier des loyers, sans rien recopier. Un exemple fictif au 21
            octobre : choisissez une case pour voir son détail.
          </Lead>
          <RentRegister>
            <div>
              <h3 className="text-[17px] font-semibold">Ce qui se passe tout seul</h3>
              <ol className="mt-4 flex flex-col gap-4">
                {TIMELINE.map((step) => (
                  <li key={step.day} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn("grid size-[34px] shrink-0 place-items-center rounded-[9px] text-[15px] font-bold", step.className)}
                    >
                      {step.day}
                    </span>
                    <span className="min-w-0 text-[15px]">
                      <strong className="block font-semibold">{step.title}</strong>
                      {step.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </RentRegister>
        </Container>
      </section>

      <section className="bg-canvas">
        <Container className="flex flex-col items-center gap-10 py-14 lg:flex-row lg:justify-center lg:gap-24 lg:py-28">
          <div className="flex w-full max-w-[340px] justify-center lg:shrink-0">
            <PhonePreview />
          </div>
          <div className="min-w-0 max-w-[540px]">
            <SectionTitle>Une vraie application sur le téléphone de vos agents</SectionTitle>
            <p className="mt-4 text-lg text-pretty text-foreground/80">
              LanGestLoc est une application web installable (PWA). Elle se pose sur l&apos;écran d&apos;accueil et
              s&apos;ouvre en plein écran, comme une application du store. L&apos;agent enregistre le paiement devant la
              boutique et le reçu est prêt aussitôt.
            </p>
            <dl className="mt-7.5 grid gap-x-8 gap-y-5.5 sm:grid-cols-2">
              {PWA_POINTS.map((point) => (
                <div key={point.title}>
                  <dt className="font-semibold">{point.title}</dt>
                  <dd className="mt-1 text-muted-foreground">{point.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-14 lg:py-28">
          <SectionTitle className="max-w-[16em]">Ce que vous ne faites plus à la main</SectionTitle>
          <ul className="mt-9 border-t border-foreground/10">
            {CHORES.map((chore) => (
              <li
                key={chore.before}
                className="flex flex-col gap-1.5 border-b border-foreground/10 py-5.5 text-[17px] md:flex-row md:gap-10 lg:text-[21px]"
              >
                <s className="flex-1 text-muted-foreground decoration-faint decoration-2">{chore.before}</s>
                <span className="flex-1 font-semibold">{chore.after}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="bg-canvas">
        <Container className="py-14 lg:py-28">
          <SectionTitle>Tout le parc, au même endroit</SectionTitle>
          <Lead>
            Ce qui est enregistré ne bouge plus. Une erreur se corrige par une nouvelle écriture, et l&apos;historique se
            relit tel qu&apos;il s&apos;est passé.
          </Lead>
          <div className="mt-11 grid gap-x-12 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
            {PARC.map((item) => (
              <div key={item.title} className="border-t-2 border-foreground pt-4">
                <h3 className="text-[21px] font-bold tracking-[-0.015em]">{item.title}</h3>
                <p className="mt-2 text-pretty text-foreground/80">{item.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="pt-14 lg:pt-26">
          <SectionTitle>Pour le bailleur et ses agents</SectionTitle>
          <div className="mt-9 grid max-w-[900px] gap-x-12 gap-y-7 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">L&apos;administrateur</h3>
              <p className="mt-1.5 text-pretty text-foreground/80">
                Crée les boutiques, les locataires et les contrats. Augmente un loyer, résilie un contrat et gère les
                comptes de l&apos;équipe.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">L&apos;agent</h3>
              <p className="mt-1.5 text-pretty text-foreground/80">
                Consulte tout et encaisse les loyers depuis son téléphone. Il remet le reçu au locataire, sans pouvoir
                modifier le reste.
              </p>
            </div>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3.5">
            <LoginButton />
            <span className="text-sm text-muted-foreground">Votre compte vous est donné par l&apos;administrateur.</span>
          </div>
          <footer className="mt-14 flex flex-col items-center gap-1.5 border-t border-border py-6 text-center text-[13px] text-muted-foreground lg:mt-24">
            <p>LanGestLoc, gestion locative de locaux commerciaux</p>
            <div className="flex gap-4">
              <Link href={PRIVACY_PATH} className="underline-offset-4 hover:underline">
                Confidentialité
              </Link>
              <CookieSettingsButton />
            </div>
          </footer>
        </Container>
      </section>
      <AnalyticsConsent />
    </main>
  );
}
