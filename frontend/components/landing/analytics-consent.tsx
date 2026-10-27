"use client";

import Link from "next/link";
import Script from "next/script";
import { Cookie } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  type ConsentChoice,
  gaCookieNames,
  readConsent,
  writeConsent,
} from "@/lib/analytics-consent";
import { PRIVACY_PATH } from "@/lib/auth";

declare global {
  interface Window {
    [key: `ga-disable-${string}`]: boolean;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// 13 mois, la durée maximale admise par la CNIL.
const GA_COOKIE_MAX_AGE_S = 13 * 30 * 24 * 3600;

const REOPEN_EVENT = "langestloc:analytics-consent";
const CHANGE_EVENT = "langestloc:analytics-consent-change";

const localStorage = () => window.localStorage;

let sessionChoice: ConsentChoice | undefined;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const getChoice = (): ConsentChoice | null => readConsent(localStorage, new Date()) ?? sessionChoice ?? null;

// undefined : choix inconnu côté serveur, le bandeau attend le navigateur.
const getServerChoice = (): ConsentChoice | null | undefined => undefined;

function setTracking(enabled: boolean) {
  if (GA_ID) window[`ga-disable-${GA_ID}`] = !enabled;
}

function deleteGaCookies() {
  for (const name of gaCookieNames(document.cookie)) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

export function AnalyticsConsent() {
  const choice = useSyncExternalStore(subscribe, getChoice, getServerChoice);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  // Coupé en quittant la page d'accueil : l'appli n'est jamais mesurée.
  useEffect(() => {
    setTracking(choice === "granted");
    return () => setTracking(false);
  }, [choice]);

  if (!GA_ID) return null;

  const bannerOpen = choice === null || reopened;

  function decide(next: ConsentChoice) {
    sessionChoice = next;
    writeConsent(localStorage, next, new Date());
    if (next === "denied") {
      setTracking(false);
      deleteGaCookies();
    }
    setReopened(false);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <>
      {choice === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(GA_ID)}, { cookie_domain: 'none', cookie_expires: ${GA_COOKIE_MAX_AGE_S} });`}
          </Script>
        </>
      )}
      {bannerOpen && (
        <div
          role="dialog"
          aria-labelledby="analytics-consent-title"
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[400px] rounded-2xl border border-border bg-background p-5 shadow-[var(--paper-shadow)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 md:inset-x-6 md:bottom-6 md:flex md:max-w-[780px] md:items-center md:gap-8 md:p-6"
        >
          <div className="flex items-start gap-3.5 md:flex-1 md:items-center md:gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary md:size-12">
              <Cookie className="size-5 md:size-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="analytics-consent-title" className="font-semibold">
                Cookies
              </h2>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                Avec votre accord, Google Analytics compte les visites de cette page et dépose des cookies.{" "}
                <Link
                  href={PRIVACY_PATH}
                  className="font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline"
                >
                  Ce qui est recueilli
                </Link>
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-0 md:w-[260px] md:shrink-0">
            <Button variant="outline" className="h-11 rounded-[10px] font-semibold" onClick={() => decide("denied")}>
              Refuser
            </Button>
            <Button variant="outline" className="h-11 rounded-[10px] font-semibold" onClick={() => decide("granted")}>
              Accepter
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function CookieSettingsButton() {
  if (!GA_ID) return null;
  return (
    <button
      type="button"
      className="underline-offset-4 hover:underline"
      onClick={() => window.dispatchEvent(new Event(REOPEN_EVENT))}
    >
      Cookies
    </button>
  );
}
