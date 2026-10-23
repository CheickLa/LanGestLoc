import { describe, expect, it } from "vitest";
import { LOCAL_NAME_MAX_LENGTH, localSchema } from "./local-schema";

const local = (name: string) => ({ code: "LOCAL-001", name });

describe("localSchema", () => {
  it("limite le nom à 40 caractères, comme l'API", () => {
    expect(LOCAL_NAME_MAX_LENGTH).toBe(40);
  });

  it("accepte un nom à la limite", () => {
    expect(
      localSchema.safeParse(local("a".repeat(LOCAL_NAME_MAX_LENGTH))).success,
    ).toBe(true);
  });

  it("refuse un nom trop long", () => {
    const result = localSchema.safeParse(
      local("a".repeat(LOCAL_NAME_MAX_LENGTH + 1)),
    );
    expect(result.error?.issues.map((i) => i.path)).toEqual([["name"]]);
  });
});
