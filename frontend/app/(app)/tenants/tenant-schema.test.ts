import { describe, expect, it } from "vitest";
import { TENANT_NAME_MAX_LENGTH, tenantSchema } from "./tenant-schema";

const tenant = (name: string) => ({
  name,
  phone: "+224612345678",
  dateOfBirth: "1990-05-15",
  birthPlace: "Conakry",
  idNumber: "234567890",
});

describe("tenantSchema", () => {
  it("limite le nom à 60 caractères, comme l'API", () => {
    expect(TENANT_NAME_MAX_LENGTH).toBe(60);
  });

  it("accepte un nom à la limite", () => {
    expect(
      tenantSchema.safeParse(tenant("a".repeat(TENANT_NAME_MAX_LENGTH)))
        .success,
    ).toBe(true);
  });

  it("refuse un nom trop long", () => {
    const result = tenantSchema.safeParse(
      tenant("a".repeat(TENANT_NAME_MAX_LENGTH + 1)),
    );
    expect(result.error?.issues.map((i) => i.path)).toEqual([["name"]]);
  });
});
