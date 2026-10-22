const KEY = "langestloc:in-app-nav";

/** Note qu'une navigation a eu lieu dans l'appli pendant cette session d'onglet. */
export function markInAppNavigation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // stockage indisponible (navigation privée, bloqué) : on s'en passe
  }
}

/** Vrai si l'historique contient un écran de l'appli vers lequel revenir. */
export function hasInAppNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
