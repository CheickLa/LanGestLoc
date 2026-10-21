import Image from "next/image";
import { Check } from "lucide-react";

import { formatGNF } from "@/lib/format";
import { cn } from "@/lib/utils";

// Reproductions du bail et des reçus PDF (backend : contracts/pdf, receipts/pdf).
// Tailles en cqi : le document garde ses proportions quelle que soit sa largeur.

const LANDLORD = { name: "Galerie des Manguiers", place: "Conakry" };
const TENANT = { name: "A. Camara", phone: "+224 621 00 00 00" };
const LOCAL = "Boutique A2";
const LEASE_NO = "BAIL-2026-00007";
const ISSUED_ON = "01/10/2026";
const RENT = 2_000_000;

const digits = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

function Paper({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container h-full">
      <div className="flex h-full flex-col px-[7cqi] pt-[7cqi] pb-[5cqi] text-[2.1cqi] leading-[1.4] text-foreground">
        {children}
      </div>
    </div>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[1.7cqi] font-semibold tracking-[0.06em] text-primary uppercase", className)}>
      {children}
    </div>
  );
}

function PaperHeader({ title, meta }: { title: string; meta: React.ReactNode }) {
  return (
    <>
      <div className="flex items-start justify-between gap-[3cqi]">
        <div>
          <div className="text-[5cqi] leading-[1.1] font-bold tracking-[-0.01em]">{title}</div>
          <div className="mt-[1.4cqi] text-muted-foreground">{meta}</div>
        </div>
        <div className="flex items-center gap-[1.2cqi]">
          <Image src="/icon.svg" alt="" width={24} height={24} className="size-[4.6cqi]" />
          <span className="text-[2.9cqi] font-bold">LanGestLoc</span>
        </div>
      </div>
      <div className="my-[4cqi] h-px bg-primary" />
    </>
  );
}

function Parties() {
  return (
    <div className="grid grid-cols-2 gap-px bg-border">
      <div className="bg-background px-[3cqi] py-[2.4cqi]">
        <Caption>Bailleur</Caption>
        <div className="mt-[0.6cqi] text-[2.6cqi] font-semibold">{LANDLORD.name}</div>
        <div className="text-muted-foreground">{LANDLORD.place}</div>
      </div>
      <div className="bg-background px-[3cqi] py-[2.4cqi]">
        <Caption>Locataire</Caption>
        <div className="mt-[0.6cqi] text-[2.6cqi] font-semibold">{TENANT.name}</div>
        <div className="font-mono text-muted-foreground">{TENANT.phone}</div>
      </div>
    </div>
  );
}

function Facts({ facts }: { facts: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <div
      className={cn(
        "grid gap-px border-t border-border bg-border",
        facts.length === 4 ? "grid-cols-4" : "grid-cols-3",
      )}
    >
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0 bg-muted px-[2.6cqi] py-[1.8cqi]">
          <Caption className="text-[1.6cqi] tracking-[0.05em] text-faint">{fact.label}</Caption>
          <div className={cn("font-medium", fact.mono && "font-mono")}>{fact.value}</div>
        </div>
      ))}
    </div>
  );
}

const ARTICLES = [
  {
    title: "Objet",
    body: `Le bailleur donne en location au locataire le local commercial désigné « ${LOCAL} », situé à ${LANDLORD.place}. Le local est destiné à un usage exclusivement commercial.`,
  },
  {
    title: "Durée",
    body: `Le présent contrat prend effet le ${ISSUED_ON} pour une durée indéterminée. Il pourra être renouvelé par accord exprès des deux parties.`,
  },
  {
    title: "Loyer",
    body: `Le loyer mensuel est fixé à ${formatGNF(RENT)}, payable au plus tard le 5 du mois suivant le mois concerné.`,
  },
  {
    title: "Dépôt de caution",
    body: `À la signature du présent contrat, le locataire verse un dépôt de caution de ${formatGNF(RENT)}, équivalent à un mois de loyer. Cette caution constitue une garantie pure : elle n'est jamais imputée sur un loyer.`,
  },
  {
    title: "Charges",
    body: "Les frais d'eau et d'électricité afférents au local sont à la charge exclusive du locataire.",
  },
];

export function LeasePaper() {
  return (
    <Paper>
      <PaperHeader
        title="Contrat de location"
        meta={
          <>
            Référence <Value>{LEASE_NO}</Value>, émis le <Value>{ISSUED_ON}</Value>
          </>
        }
      />
      <div className="overflow-hidden rounded-[2cqi] border border-border">
        <Parties />
        <Facts
          facts={[
            { label: "Local", value: LOCAL },
            { label: "Période", value: `À partir du ${ISSUED_ON}` },
            { label: "Loyer mensuel", value: formatGNF(RENT) },
            { label: "Dépôt de caution", value: formatGNF(RENT) },
          ]}
        />
      </div>
      <p className="mt-[3.4cqi] text-muted-foreground">
        Entre les soussignés, le Bailleur et le Locataire désignés ci-dessus, il a été convenu et
        arrêté ce qui suit :
      </p>
      <ol className="mt-[3cqi] flex flex-col gap-[2.4cqi] text-[1.75cqi] leading-[1.45]">
        {ARTICLES.map((article, i) => (
          <li key={article.title} className="grid grid-cols-[8cqi_minmax(0,1fr)]">
            <span className="font-semibold text-primary">Art. {i + 1}</span>
            <span>
              <span className="block text-[2.3cqi] font-semibold">{article.title}</span>
              <span className="block text-justify text-muted-foreground">{article.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-auto grid grid-cols-2 gap-[6cqi] pt-[3cqi]">
        {["Le bailleur", "Le locataire"].map((signer) => (
          <div key={signer}>
            <div className="font-semibold">{signer}</div>
            <div className="mt-[7cqi] border-t border-foreground/20 pt-[1cqi] text-[1.7cqi] text-faint">
              Nom et signature
            </div>
          </div>
        ))}
      </div>
    </Paper>
  );
}

const RECEIPTS = {
  payment: {
    title: "Reçu de paiement",
    number: "REC-2026-00042",
    caption: "Montant payé",
    amount: 3 * RENT,
    words: "six millions de francs guinéens",
    when: "le 1er octobre 2026, par Orange Money",
    lastFact: { label: "Mois payés", value: "3" },
  },
  deposit: {
    title: "Reçu de caution",
    number: "REC-2026-00041",
    caption: "Caution versée",
    amount: RENT,
    words: "deux millions de francs guinéens",
    when: "le 1er octobre 2026, en espèces",
    lastFact: { label: "Objet", value: "Dépôt de caution" },
  },
};

export function ReceiptPaper({ kind }: { kind: keyof typeof RECEIPTS }) {
  const receipt = RECEIPTS[kind];

  return (
    <Paper>
      <PaperHeader
        title={receipt.title}
        meta={
          <>
            <div>
              N° <Value>{receipt.number}</Value>
            </div>
            <div>
              Émis le <Value>{ISSUED_ON}</Value>
            </div>
          </>
        }
      />
      <div className="rounded-[2.4cqi] bg-muted px-[4cqi] py-[3.6cqi]">
        <div className="flex items-center justify-between gap-[2cqi]">
          <Caption className="text-[1.8cqi]">{receipt.caption}</Caption>
          {kind === "payment" ? (
            <span className="inline-flex items-center gap-[0.8cqi] rounded-full bg-success px-[1.8cqi] py-[0.5cqi] text-[2cqi] font-semibold text-success-foreground">
              <Check className="size-[2.2cqi]" strokeWidth={3} />
              Payé
            </span>
          ) : null}
        </div>
        <div className="mt-[1.6cqi] flex items-baseline gap-[1.4cqi]">
          <span className="text-[8cqi] leading-[1.05] font-bold tracking-[-0.02em]">{digits(receipt.amount)}</span>
          <span className="text-[3.2cqi] font-semibold text-muted-foreground">GNF</span>
        </div>
        <div className="mt-[1cqi] text-muted-foreground">{receipt.when}</div>
        <div className="my-[2.4cqi] h-px bg-border" />
        <div className="text-muted-foreground">
          Arrêté le présent reçu à la somme de <Value>{receipt.words}</Value>.
        </div>
      </div>
      <div className="mt-[3.4cqi] overflow-hidden rounded-[2cqi] border border-border">
        <Parties />
        <Facts
          facts={[
            { label: "Local", value: LOCAL },
            { label: "Contrat", value: LEASE_NO, mono: true },
            receipt.lastFact,
          ]}
        />
      </div>
      {kind === "payment" ? (
        <>
          <div className="mt-[4cqi] text-[2.6cqi] font-semibold">Détail du paiement</div>
          <div className="flex items-start justify-between gap-[3cqi] border-b border-border py-[2cqi]">
            <div>
              <div className="font-medium">octobre 2026 → décembre 2026</div>
              <div className="text-muted-foreground">3 mois × {formatGNF(RENT)}</div>
            </div>
            <div className="font-semibold whitespace-nowrap">{formatGNF(receipt.amount)}</div>
          </div>
        </>
      ) : null}
      <div className="mt-auto flex justify-between text-[1.7cqi] text-faint">
        <span>Ce reçu fait foi du paiement.</span>
        <span>Page 1 / 1</span>
      </div>
    </Paper>
  );
}
