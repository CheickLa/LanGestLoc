"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";

import { LOGOUT_PATH } from "@/lib/auth";
import type { UserEntity } from "@/lib/auth-server";
import { hasInAppNavigation } from "@/lib/in-app-history";
import { getInitials, roleLabel } from "@/lib/user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  descriptionForPath,
  parentPathFor,
  titleForPath,
} from "@/components/layout/nav-items";

export function AppHeader({ user }: { user: UserEntity }) {
  const pathname = usePathname();
  const router = useRouter();
  const description = descriptionForPath(pathname);
  const parent = parentPathFor(pathname);

  // Sans écran de l'appli derrière (lien ouvert dans un nouvel onglet), on remonte à la liste
  function goBack(parentPath: string) {
    if (hasInAppNavigation()) router.back();
    else router.push(parentPath);
  }

  return (
    <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-primary px-4 py-2.5 md:border-border md:bg-card md:px-7 md:py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {parent ? (
          <button
            type="button"
            onClick={() => goBack(parent)}
            aria-label="Retour"
            className="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white md:hidden"
          >
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </button>
        ) : (
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
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-white md:text-2xl md:text-foreground">
            {titleForPath(pathname)}
          </h1>
          {description ? (
            <p className="hidden truncate text-sm text-muted-foreground md:block">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <span className="hidden items-center rounded-full bg-primary/10 px-3 py-1 text-[13px] font-medium text-primary md:inline-flex">
          {roleLabel(user.role)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Mon compte"
            className="grid size-8 place-items-center rounded-full border border-white/25 bg-white/15 text-xs text-white md:border-border md:bg-secondary md:text-muted-foreground"
          >
            {getInitials(user.name)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuLabel>
              <p className="truncate">{user.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">
                {roleLabel(user.role)}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={LOGOUT_PATH}>
                <LogOut strokeWidth={1.8} />
                Se déconnecter
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
