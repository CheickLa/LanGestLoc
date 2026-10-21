"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { DashboardPreview } from "./dashboard-preview";
import { LeasePaper, ReceiptPaper } from "./papers";

type Item = "dashboard" | "receipt" | "deposit" | "lease";

const ITEMS: Record<Item, { label: string; name: string; caption: string }> = {
  dashboard: {
    label: "Tableau de bord",
    name: "le tableau de bord",
    caption:
      "Le tableau de bord : contrats actifs, encaissements du mois, loyers en retard et taux de recouvrement, d'un coup d'œil.",
  },
  receipt: {
    label: "Reçu",
    name: "le reçu de paiement",
    caption:
      "Un reçu par paiement, même pour plusieurs mois, avec la somme en toutes lettres. Le locataire le reçoit en PDF.",
  },
  deposit: {
    label: "Caution",
    name: "le reçu de caution",
    caption: "La caution versée à la signature a son reçu, et sa restitution à la fin du contrat aussi.",
  },
  lease: {
    label: "Bail",
    name: "le contrat de location",
    caption:
      "Le contrat sort rempli : les parties, la boutique, le loyer, la caution et les articles. Il reste à l'imprimer et à le signer.",
  },
};

const BUTTONS: Item[] = ["dashboard", "receipt", "deposit", "lease"];

const PAPERS = ["lease", "deposit", "receipt"] as const;

// Places des papiers en éventail, du premier plan au dernier.
const SLOTS = [
  { left: "12%", top: "38%", rotate: "-3deg" },
  { left: "31%", top: "34%", rotate: "5deg" },
  { left: "0%", top: "31%", rotate: "-8deg" },
];

export function DocumentStack() {
  const [order, setOrder] = useState<Item[]>(["receipt", "deposit", "lease", "dashboard"]);
  const [fanned, setFanned] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setFanned(true), reduced ? 0 : 350);
    return () => window.clearTimeout(timer);
  }, []);

  const front = order[0];
  const papersOrder = order.filter((item) => item !== "dashboard");
  const zIndex = (item: Item) => order.length - order.indexOf(item);

  return (
    <figure>
      <div
        role="img"
        aria-label={`Un tableau de bord et trois documents produits par LanGestLoc, posés les uns sur les autres : un reçu de paiement, un reçu de caution et un contrat de location. Au premier plan : ${ITEMS[front].name}.`}
        className="relative -mx-2 aspect-[1/0.98]"
      >
        <div
          aria-hidden
          className="absolute top-0 left-[14%] aspect-16/10 w-[86%] overflow-hidden rounded-[10px] border border-foreground/10 bg-canvas shadow-[var(--screen-shadow)]"
          style={{ zIndex: zIndex("dashboard") }}
        >
          <DashboardPreview />
        </div>
        {PAPERS.map((paper) => {
          const rank = papersOrder.indexOf(paper);
          const slot = SLOTS[fanned ? rank : 0];
          return (
            <div
              key={paper}
              aria-hidden
              className={cn(
                "absolute aspect-[1/1.414] w-[42%] overflow-hidden rounded-[3px] bg-background transition-[left,top,rotate,box-shadow] duration-560 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none",
                rank === 0 ? "shadow-[var(--paper-shadow)]" : "shadow-[var(--paper-shadow-soft)]",
              )}
              style={{ left: slot.left, top: slot.top, rotate: slot.rotate, zIndex: zIndex(paper) }}
            >
              {paper === "lease" ? (
                <LeasePaper />
              ) : (
                <ReceiptPaper kind={paper === "receipt" ? "payment" : "deposit"} />
              )}
            </div>
          );
        })}
      </div>

      <figcaption className="mt-5">
        <div role="group" aria-label="Choisir ce qui passe devant" className="flex flex-wrap gap-1.5 md:gap-2">
          {BUTTONS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={item === front}
              onClick={() => setOrder([item, ...order.filter((other) => other !== item)])}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 md:px-4 md:text-[15px]",
                item === front
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/15 bg-background text-foreground hover:bg-muted",
              )}
            >
              {ITEMS[item].label}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="mt-3 min-h-[3.1em] max-w-[34em] text-[15px] text-pretty text-muted-foreground">
          {ITEMS[front].caption}
        </p>
      </figcaption>
    </figure>
  );
}
