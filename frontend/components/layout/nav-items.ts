import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Store,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserEntity } from "@/lib/auth-server";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Sous-titre affiché dans le header de page (desktop) */
  description?: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Vue d'ensemble de votre activité",
  },
  {
    label: "Locaux",
    href: "/locals",
    icon: Store,
    description: "Gérer vos locaux et leur occupation",
  },
  {
    label: "Locataires",
    href: "/tenants",
    icon: Users,
    description: "Gérer vos locataires",
  },
  {
    label: "Contrats",
    href: "/contracts",
    icon: FileText,
    description: "Gérer les contrats de location",
  },
  {
    label: "Paiements",
    href: "/payments",
    icon: CreditCard,
    description: "Suivi des paiements et reçus",
  },
  {
    label: "Utilisateurs",
    href: "/users",
    icon: UserCog,
    adminOnly: true,
    description: "Gestion des comptes utilisateurs",
  },
];

/** Filtre les items selon le rôle (USER = lecture seule, pas de gestion utilisateurs) */
export function navItemsForRole(role: UserEntity["role"]): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN");
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleForPath(pathname: string): string {
  return (
    NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ??
    NAV_ITEMS[0].label
  );
}

export function descriptionForPath(pathname: string): string {
  return (
    NAV_ITEMS.find((item) => isActive(pathname, item.href))?.description ?? ""
  );
}

/** Le `href` du NAV_ITEMS dont ce pathname est un sous-chemin strict, ou `null` */
export function parentPathFor(pathname: string): string | null {
  const parent = NAV_ITEMS.find((item) => pathname.startsWith(`${item.href}/`));
  return parent?.href ?? null;
}
