"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { LOGOUT_PATH } from "@/lib/auth";
import type { UserEntity } from "@/lib/auth-server";
import { getInitials } from "@/lib/user";
import { titleForPath } from "@/components/layout/nav-items";

export function AppHeader({
  user,
  onMenuClick,
}: {
  user: UserEntity;
  /** Ouvre le drawer de navigation (mobile uniquement). */
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-primary px-4 md:border-border md:bg-muted/50 md:px-7">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white md:hidden"
        >
          <Menu className="size-5" strokeWidth={1.8} />
        </button>
        <Link href="/dashboard" className="shrink-0 md:hidden" aria-label="LanGestLoc">
          <Image
            src="/icon-white.svg"
            alt=""
            width={100}
            height={100}
            priority
            className="size-8"
          />
        </Link>
        <h1 className="truncate text-lg font-semibold tracking-tight text-white md:text-foreground">
          {titleForPath(pathname)}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full border border-white/25 bg-white/15 text-xs text-white md:border-border md:bg-secondary md:text-muted-foreground">
          {getInitials(user.name)}
        </span>
        <a
          href={LOGOUT_PATH}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="grid size-9 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white md:text-muted-foreground md:hover:bg-secondary md:hover:text-foreground"
        >
          <LogOut className="size-5" strokeWidth={1.8} />
        </a>
      </div>
    </header>
  );
}
