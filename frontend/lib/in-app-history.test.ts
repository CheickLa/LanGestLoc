import { afterEach, describe, expect, it, vi } from "vitest";

import { hasInAppNavigation, markInAppNavigation } from "./in-app-history";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new Error("SecurityError");
  };
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("in-app-history", () => {
  it("est faux sans window (rendu serveur), et marquer ne lève rien", () => {
    expect(() => markInAppNavigation()).not.toThrow();
    expect(hasInAppNavigation()).toBe(false);
  });

  it("est faux tant qu'aucune navigation n'a été marquée", () => {
    vi.stubGlobal("window", { sessionStorage: memoryStorage() });
    expect(hasInAppNavigation()).toBe(false);
  });

  it("est vrai après une navigation marquée", () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    markInAppNavigation();
    expect(hasInAppNavigation()).toBe(true);
    expect(storage.getItem("langestloc:in-app-nav")).not.toBeNull();
  });

  it("est faux si sessionStorage lève une erreur", () => {
    vi.stubGlobal("window", { sessionStorage: throwingStorage() });
    expect(() => markInAppNavigation()).not.toThrow();
    expect(hasInAppNavigation()).toBe(false);
  });

  it("est faux si l'accès à sessionStorage lui-même lève une erreur", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    expect(() => markInAppNavigation()).not.toThrow();
    expect(hasInAppNavigation()).toBe(false);
  });
});
