"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Champ de recherche relié à ?q= : met l'URL à jour après la frappe et suit
// les navigations extérieures (Précédent, menu) sans écraser une saisie en cours.
export function useSearchQuery(search: string, path: string) {
  const router = useRouter();
  const [input, setInput] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);

  if (search !== prevSearch) {
    setPrevSearch(search);
    if (input.trim() === prevSearch) setInput(search);
  }

  useEffect(() => {
    const value = input.trim();
    if (value === search) return;
    const handle = setTimeout(() => {
      router.push(value ? `${path}?${new URLSearchParams({ q: value })}` : path);
    }, 350);
    return () => clearTimeout(handle);
  }, [input, search, path, router]);

  return [input, setInput] as const;
}
