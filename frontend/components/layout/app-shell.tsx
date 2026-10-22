"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import type { UserEntity } from "@/lib/auth-server";
import { markInAppNavigation } from "@/lib/in-app-history";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTabBar } from "@/components/layout/app-tab-bar";

export function AppShell({
  user,
  children,
}: {
  user: UserEntity;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  // Le premier écran ouvert ne compte pas : rien derrière lui dans l'appli
  useEffect(() => {
    if (pathname === previousPath.current) return;
    previousPath.current = pathname;
    markInAppNavigation();
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden md:gap-3 md:bg-canvas md:p-3">
      <AppSidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted md:rounded-3xl md:border md:border-border md:shadow-sm">
        <AppHeader user={user} />
        <div className="flex-1 overflow-auto px-4 py-5 md:px-7 md:py-6">
          {children}
        </div>
        <AppTabBar user={user} />
      </div>
    </div>
  );
}
