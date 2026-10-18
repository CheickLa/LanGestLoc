# Charte graphique — LanGestLoc

> Référence design pour le frontend (Next.js 16 + Tailwind v4 + shadcn/ui).
> À committer dans le repo et à utiliser comme contexte UI de référence.

## Parti pris

Outil métier financier, pas un produit grand public. Le design sert la **clarté**, la **confiance** et la **prévention d'erreur**, pas l'esthétique. Direction : **utilitaire raffiné** — sobre, dense mais lisible, restreint et intentionnel.

La signature visuelle de l'app, c'est le **système de statuts** : presque tous les écrans affichent des états (`RentDue`, `Contract`, `Deposit`). Un système de badges cohérent et accessible est l'élément central — c'est ce qui rend un tableau de 50 lignes lisible d'un coup d'œil.

Trois règles non négociables :
1. Les couleurs sémantiques (vert / ambre / rouge) ne servent **qu'aux statuts et alertes**. Jamais en décoration.
2. Le bleu primaire est réservé aux **actions et à la marque**. Jamais pour signaler un statut (sinon confusion avec les badges).
3. Tout montant utilise des **chiffres tabulaires** (`tabular-nums`) pour s'aligner en colonne.

## Couleurs

### Base

| Rôle                | Clair                | Sombre               | Usage                                |
|---------------------|----------------------|----------------------|--------------------------------------|
| Primaire            | `#194FD6`            | `#4F7BE8`            | Actions, liens, marque, **sidebar**  |
| Primaire (texte)    | `#FFFFFF`            | `#0A1F52`            | Texte sur fond primaire              |
| Primaire (hover)    | `#143FAD`            | `#6E92EC`            | État survol                          |

Bleu de marque unique : `#194FD6` sert à la fois pour la sidebar et pour toutes les actions principales (boutons, liens, états actifs). Surcharge `--primary` et `--ring` shadcn avec ce bleu.

### Neutres

Neutres **légèrement teintés navy** (plus froids et plus précis que le slate générique de shadcn — c'est en grande partie ce qui rend le rendu net et premium) :

| Token           | Valeur    | Usage                                       |
|-----------------|-----------|---------------------------------------------|
| ink (texte 1)   | `#0E1726` | Texte principal (presque noir, nuance navy) |
| muted (texte 2) | `#5B6472` | Texte secondaire                            |
| faint (texte 3) | `#8A92A1` | Labels, méta, en-têtes de tableau           |
| line            | `#E8EAF0` | Bordures fines                              |
| soft            | `#F4F6FA` | Fond des cartes KPI, surfaces secondaires   |
| bg              | `#FFFFFF` | Fond de page et panneaux                    |

Surcharge les tokens shadcn correspondants (`--foreground`, `--muted-foreground`, `--border`, `--muted`…) avec ces valeurs plutôt que de garder le slate par défaut.

### Sémantiques — statuts (style badge « soft »)

Chaque statut = un fond doux + un texte foncé de la même famille (jamais de noir/gris générique sur fond coloré).

| Token      | Fond clair | Texte clair | Fond sombre | Texte sombre |
|------------|------------|-------------|-------------|--------------|
| success    | `#EAF3DE`  | `#27500A`   | `#173404`   | `#C0DD97`    |
| warning    | `#FAEEDA`  | `#633806`   | `#412402`   | `#FAC775`    |
| danger     | `#FCEBEB`  | `#791F1F`   | `#501313`   | `#F7C1C1`    |
| info       | `#E6F1FB`  | `#0C447C`   | `#042C53`   | `#B5D4F4`    |
| neutral    | `#F1F5F9`  | `#475569`   | `#1E293B`   | `#CBD5E1`    |

## Mapping statut → couleur

Le tableau qui pilote tous les badges de l'app. Un seul composant `<StatusBadge status={...} />` doit suffire.

| Entité     | Statut          | Token     | Libellé FR    |
|------------|-----------------|-----------|---------------|
| `RentDue`  | `PENDING`       | info      | En attente    |
| `RentDue`  | `PAID`          | success   | Payé          |
| `RentDue`  | `LATE`          | danger    | En retard     |
| `Contract` | `ACTIVE`        | success   | Actif         |
| `Contract` | `TERMINATED`    | neutral   | Résilié       |
| `Contract` | `CANCELED`      | danger    | Annulé        |
| `Deposit`  | `HELD`          | warning   | Détenue       |
| `Deposit`  | `REFUNDED`      | neutral   | Restituée     |

**Type de paiement** (`RENT` / `DEPOSIT_HELD` / `DEPOSIT_REFUND`) et **méthode** (`CASH` / `ORANGE_MONEY` / `MOBILE_MONEY`) : ce ne sont **pas** des statuts → puces neutres en `outline`, pas de couleur sémantique. On garde le rouge/vert/ambre pour ce qui exige une action.

## Surfaces et navigation

- **Sidebar** : fond bleu de marque `#194FD6` plein. Logo et libellés en blanc.
  - Item **actif** : pastille blanche pleine (`background:#FFFFFF`) + texte et icône en bleu `#194FD6`, graisse 500. C'est le repère « tu es ici ».
  - Items **inactifs** : texte blanc à ~90 % (`rgba(255,255,255,0.9)`). Survol : fond blanc très léger (`rgba(255,255,255,0.12)`).
- **Zone de contenu** : fond blanc, pas de canvas teinté. Cartes KPI sur fond `muted` (secondaire) ; tableaux et panneaux sur blanc avec bordure fine.
- **Header** : barre blanche, titre de page à gauche, badge de rôle + avatar à droite.

## Typographie

- **UI** : Geist Sans (cohérent avec l'hébergement Vercel, plus de caractère qu'Inter tout en restant ultra-lisible). **À charger via `next/font`** — sans chargement effectif, le rendu retombe sur une police système et perd son aspect épuré (c'est précisément ce chargement de Geist qui rend l'interface plus nette).
- **Chiffres / codes / identifiants** : Geist Mono.
- **Montants** : toujours `font-variant-numeric: tabular-nums` (classe `tabular-nums`).

Échelle (2 graisses seulement : 400 normal, 500 medium ; 600 réservé aux titres de page) :

| Usage              | Taille  | Graisse |
|--------------------|---------|---------|
| Titre de page      | 24px    | 600     |
| Titre de section   | 18px    | 500     |
| Corps              | 14–15px | 400     |
| Label / méta       | 13px    | 400     |
| KPI (chiffre)      | 24–27px | 600     |
| Petit / hint       | 12px    | 400     |

## Montants

Format unique partout, via `Intl.NumberFormat` :

```ts
export const formatGNF = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " GNF";
// 250000 → "250 000 GNF"
```

Toujours combiné à `tabular-nums` dans les cellules de tableau et les KPI.

## Espacements, rayons, dimensions

- **Rayons** : champs et boutons ~10px, cartes 12px, panneaux 14px, badges `rounded-full`. (Un cran plus arrondi que le 8px initial — plus doux, plus net.)
- **Bordures** : fines, 1px `line` (`#E8EAF0`). Pas d'ombre lourde ; `shadow-sm` réservé aux overlays (dialogs/sheets).
- **Sidebar** : 244px de large.
- **Header** : 64px de haut, fond blanc, bordure basse `line`.
- **Contenu** : padding ~26–28px.
- **Tableaux** : lignes ~46px, en-tête sur fond très clair (`#FCFCFD`) avec libellés `faint` 12px, séparateurs `line` 1px.
- **Densité** : tableaux compacts, formulaires aérés.

## Conventions de composants

- **`StatusBadge`** — pièce maîtresse, pilotée par le mapping ci-dessus. Pastille (`rounded-full`), 12px, fond doux + texte foncé, icône optionnelle en tête (`clock` / `check` / `alert-triangle`).
- **Boutons** (shadcn) : `default` (primaire) pour l'action principale, `secondary`/`outline` pour le reste, `destructive` pour résilier/annuler, `ghost` pour les actions de tableau.
- **Tableaux** : shadcn `table` + TanStack Table (tri / pagination branchée sur `?skip=&take=`). En-tête collant, colonnes de montants alignées à droite + `tabular-nums`.
- **Cartes KPI** (dashboard) : fond `soft` (`#F4F6FA`), label 13px (`muted`) avec petite icône en tête, chiffre 24–27px/600 en dessous, suffixe (GNF, %) plus petit et atténué. Chiffre en `danger` quand il signale un problème (ex. loyers en retard).
- **Panneau de tableau** : carte bordée (`line`, rayon 14px) = en-tête (titre + action principale) au-dessus du tableau, et pied (compteur + pagination) en dessous.
- **Survol & motion** : survol subtil sur les lignes de tableau (`#FAFBFD`) et les items de nav ; léger fade-in décalé (staggered) au chargement du contenu. Discret, jamais clinquant.
- **Formulaires** : React Hook Form + Zod + shadcn `form`. La validation Zod reflète les DTO `class-validator` du backend (symétrie).
- **Inputs** : texte saisi en couleur **neutre** (lisibilité avant tout, surtout les montants). La mise en valeur passe par l'**état focus** — bordure + anneau (`--ring`) en `#194FD6`, label qui passe en bleu au focus. Avec shadcn c'est natif : régler `--ring` sur `#194FD6` suffit. Placeholder en gris clair (`text-tertiary`).
- **Enregistrement de paiement** : voir la section « Parcours paiement » (sélecteur « Solder jusqu'à », série contiguë, total verrouillé).
- **Notifications** : `sonner` (déjà installé) pour succès/erreur de mutation.
- **États vides** : icône discrète + une phrase + l'action principale si pertinente.
- **Sidebar** : navigation principale, items masqués/désactivés selon le rôle (USER en lecture seule sur locaux/locataires/contrats).

## Parcours paiement

Écran d'enregistrement d'un paiement (`Dialog`, sur mobile aussi, comme les autres formulaires), **toujours scopé à un seul contrat** : « Nouveau paiement » dans la liste (contrat choisi dans un Combobox) ou « Paiement » sur la fiche contrat (contrat fixé).

- **Sélection par plage, pas à la carte.** Un seul contrôle : « Solder jusqu'à [mois] » (sélecteur de mois cible). La liste se remplit automatiquement de la **plus ancienne échéance due** jusqu'au mois choisi, de façon **contiguë**. Pas de cases à cocher.
- **Jamais de trou.** Règlement chronologique strict : impossible de payer un mois en sautant un arriéré plus ancien. Garanti par l'API : `POST /payments` reçoit un mois cible (`untilMonth`) et solde tout ce qui le précède.
- **Défaut = dernier mois dû** (le dernier qui n'est pas à l'avance). Si rien n'est dû, aucun mois n'est choisi et une note le dit. Les mois suivants sont marqués **« À l'avance »** (badge neutre, ce n'est pas un statut de dette).
- **Paiement à l'avance = génération à la demande.** Les `RentDue` futures n'existent pas encore (cron mensuel) : on les génère dans la transaction de paiement, chacune au montant du `Rent` effectif pour son mois (SCD), puis on les solde. Le `@@unique([contractId, month])` empêche le cron de les recréer.
- **Total exact, verrouillé.** Aucun champ « montant » saisissable : le total est la somme des mois couverts (cadenas + note). Le bouton de confirmation porte le total → applique « paiement partiel interdit ».
- **Borné** : jusqu'à 12 mois après le mois en cours, sans dépasser la fin du contrat. Les mois et montants viennent de `GET /rent-dues/contract/:id/payable`.
- **Méthode** : select natif (`CASH` / `ORANGE_MONEY` / `MOBILE_MONEY`), Espèces par défaut. **Date** = `paymentDate`, aujourd'hui par défaut, jamais dans le futur ni avant le versement de la caution.
- **Après confirmation** : transaction (Payment + PaymentLine + `RentDue` → PAID + Receipt), puis récapitulatif avec « Ouvrir le reçu », ou « Le reçu n'a pas pu être généré. ».
- **Hors scope ici** : la caution (`DEPOSIT_HELD` / `DEPOSIT_REFUND`), gérée à la création / résiliation du contrat.

## À coller dans `globals.css`

Règle le bleu de marque et ajoute les tokens de statut par-dessus le thème shadcn (le reste — `--background`, `--foreground`, etc. — vient de l'init shadcn) :

```css
:root {
  --primary: #194FD6; --primary-foreground: #FFFFFF; --ring: #194FD6;
  --success-bg: #EAF3DE; --success-fg: #27500A;
  --warning-bg: #FAEEDA; --warning-fg: #633806;
  --danger-bg:  #FCEBEB; --danger-fg:  #791F1F;
  --info-bg:    #E6F1FB; --info-fg:    #0C447C;
  --neutral-bg: #F1F5F9; --neutral-fg: #475569;
}
.dark {
  --primary: #4F7BE8; --primary-foreground: #0A1F52; --ring: #4F7BE8;
  --success-bg: #173404; --success-fg: #C0DD97;
  --warning-bg: #412402; --warning-fg: #FAC775;
  --danger-bg:  #501313; --danger-fg:  #F7C1C1;
  --info-bg:    #042C53; --info-fg:    #B5D4F4;
  --neutral-bg: #1E293B; --neutral-fg: #CBD5E1;
}
```

## `StatusBadge` — implémentation de référence

```tsx
const STATUS_MAP = {
  PENDING:    { token: "info",    label: "En attente" },
  PAID:       { token: "success", label: "Payé" },
  LATE:       { token: "danger",  label: "En retard" },
  ACTIVE:     { token: "success", label: "Actif" },
  TERMINATED: { token: "neutral", label: "Résilié" },
  CANCELED:   { token: "danger",  label: "Annulé" },
  HELD:       { token: "warning", label: "Détenue" },
  REFUNDED:   { token: "neutral", label: "Restituée" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_MAP }) {
  const { token, label } = STATUS_MAP[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs"
      style={{
        backgroundColor: `var(--${token}-bg)`,
        color: `var(--${token}-fg)`,
      }}
    >
      {label}
    </span>
  );
}
```
