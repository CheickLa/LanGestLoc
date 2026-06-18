CREATE UNIQUE INDEX IF NOT EXISTS "Contract_localId_active_unique"
  ON "Contract" ("localId")
  WHERE "status" = 'ACTIVE';
