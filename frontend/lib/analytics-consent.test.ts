import { describe, expect, it } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  gaCookieNames,
  readConsent,
  writeConsent,
} from "./analytics-consent";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
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

const CHOSEN_AT = new Date("2026-04-15T10:00:00Z");

describe("readConsent", () => {
  it("relit le choix enregistré", () => {
    const storage = memoryStorage();
    writeConsent(() => storage, "granted", CHOSEN_AT);
    expect(readConsent(() => storage, CHOSEN_AT)).toBe("granted");

    writeConsent(() => storage, "denied", CHOSEN_AT);
    expect(readConsent(() => storage, CHOSEN_AT)).toBe("denied");
  });

  it("garde le choix jusqu'à la veille des six mois", () => {
    const storage = memoryStorage();
    writeConsent(() => storage, "granted", CHOSEN_AT);
    expect(readConsent(() => storage, new Date("2026-10-14T10:00:00Z"))).toBe("granted");
  });

  it("redemande le choix au bout de six mois", () => {
    const storage = memoryStorage();
    writeConsent(() => storage, "denied", CHOSEN_AT);
    expect(readConsent(() => storage, new Date("2026-10-15T10:00:00Z"))).toBeNull();
  });

  it("arrête les six mois au dernier jour d'un mois plus court", () => {
    const storage = memoryStorage();
    writeConsent(() => storage, "granted", new Date("2026-08-31T10:00:00Z"));
    expect(readConsent(() => storage, new Date("2027-02-27T10:00:00Z"))).toBe("granted");
    expect(readConsent(() => storage, new Date("2027-02-28T10:00:00Z"))).toBeNull();
  });

  it("renvoie null sans choix enregistré", () => {
    expect(readConsent(() => memoryStorage(), CHOSEN_AT)).toBeNull();
  });

  it("renvoie null sur une valeur illisible", () => {
    for (const value of ["oui", "{}", '{"choice":"maybe","at":"2026-04-15T10:00:00Z"}', '{"choice":"granted","at":"hier"}']) {
      const storage = memoryStorage({ [CONSENT_STORAGE_KEY]: value });
      expect(readConsent(() => storage, CHOSEN_AT)).toBeNull();
    }
  });

  it("renvoie null quand le stockage est inaccessible", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    expect(readConsent(blocked, CHOSEN_AT)).toBeNull();
  });
});

describe("writeConsent", () => {
  it("ne plante pas quand le stockage est inaccessible", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    expect(() => writeConsent(blocked, "granted", CHOSEN_AT)).not.toThrow();
  });
});

describe("gaCookieNames", () => {
  it("garde les cookies de Google Analytics", () => {
    expect(gaCookieNames("_ga=GA1.1.123; langestloc_x=1; _ga_ABC123=GS1.1.456")).toEqual([
      "_ga",
      "_ga_ABC123",
    ]);
  });

  it("renvoie une liste vide sans cookie", () => {
    expect(gaCookieNames("")).toEqual([]);
  });
});
