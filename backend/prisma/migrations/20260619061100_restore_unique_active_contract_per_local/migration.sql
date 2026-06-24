-- Restore the partial unique index dropped by Prisma during add_contract_document migration.
-- Enforces: a single ACTIVE contract per local at any time.
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_localId_active_unique"
  ON "Contract" ("localId")
  WHERE "status" = 'ACTIVE';
