"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserEntity } from "@/lib/auth-server";
import { cn } from "@/lib/utils";
import { isActive, navItemsForRole } from "@/components/layout/nav-items";

export function AppTabBar({ user }: { user: UserEntity }) {
  const pathname = usePathname();
  const items = navItemsForRole(user.role);

  return (
    <nav
      aria-label="Navigation principale"
      className="shrink-0 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
    >
      <div className="flex rounded-full border border-border bg-card p-1.5 shadow-[var(--card-shadow)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-13 flex-1 items-center justify-center rounded-full transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-6" strokeWidth={1.8} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
