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
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Locaux", href: "/locals", icon: Store },
  { label: "Locataires", href: "/tenants", icon: Users },
  { label: "Contrats", href: "/contracts", icon: FileText },
  { label: "Paiements", href: "/payments", icon: CreditCard },
  { label: "Utilisateurs", href: "/users", icon: UserCog, adminOnly: true },
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
