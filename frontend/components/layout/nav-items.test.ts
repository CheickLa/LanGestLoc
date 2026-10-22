import { describe, expect, it } from "vitest";
import { parentPathFor } from "./nav-items";

describe("parentPathFor", () => {
  it("retourne /contracts pour /contracts/abc", () => {
    expect(parentPathFor("/contracts/abc")).toBe("/contracts");
  });

  it("retourne null pour /contracts", () => {
    expect(parentPathFor("/contracts")).toBeNull();
  });

  it("retourne null pour /dashboard", () => {
    expect(parentPathFor("/dashboard")).toBeNull();
  });

  it("retourne null pour /contractsx/abc (préfixe strict)", () => {
    expect(parentPathFor("/contractsx/abc")).toBeNull();
  });

  it("retourne null pour /inconnu/abc (chemin inconnu)", () => {
    expect(parentPathFor("/inconnu/abc")).toBeNull();
  });
});
