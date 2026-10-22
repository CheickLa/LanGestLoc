"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserEntity } from "@/lib/auth-server";
import { cn } from "@/lib/utils";
import { getInitials, roleLabel } from "@/lib/user";
import { isActive, navItemsForRole } from "@/components/layout/nav-items";

export function AppSidebar({ user }: { user: UserEntity }) {
  const pathname = usePathname();
  const items = navItemsForRole(user.role);

  return (
    <aside className="hidden w-61 shrink-0 flex-col bg-primary px-3.5 py-4.5 text-primary-foreground md:flex md:rounded-3xl md:shadow-sm">
      {/* Marque */}
      <Link
        href="/dashboard"
        className="mb-13 mt-1 flex items-center justify-center px-2"
      >
        <Image
          src="/icon-white.svg"
          alt="LanGestLoc"
          width={100}
          height={100}
          priority
          className="size-11"
        />
      </Link>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-white font-semibold text-primary"
                  : "text-primary-foreground/85 hover:bg-white/12 hover:text-primary-foreground",
              )}
            >
              <Icon className="size-4.5" strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Profil */}
      <div className="mt-2 flex items-center gap-2.5 border-t border-white/20 pt-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-semibold">
          {getInitials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{user.name}</p>
          <p className="truncate text-xs text-primary-foreground/70">
            {roleLabel(user.role)}
          </p>
        </div>
      </div>
    </aside>
  );
}
