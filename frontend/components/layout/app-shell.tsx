"use client";

import { useState } from "react";

import type { UserEntity } from "@/lib/auth-server";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function AppShell({
  user,
  children,
}: {
  user: UserEntity;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden md:gap-3 md:bg-canvas md:p-3">
      {/* Backdrop mobile : masque le contenu et ferme le drawer au clic */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <AppSidebar
        user={user}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted md:rounded-3xl md:border md:border-border md:shadow-sm">
        <AppHeader user={user} onMenuClick={() => setMenuOpen(true)} />
        <div className="flex-1 overflow-auto px-4 py-5 md:px-7 md:py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
