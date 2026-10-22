import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("manifest", () => {
  it("ouvre l'appli installée sur la page d'accueil, qui renvoie au tableau de bord si l'on est connecté", () => {
    expect(manifest().start_url).toBe("/");
  });
});
