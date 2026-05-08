-- Garantit au niveau base qu'un local ne peut avoir qu'un seul contrat ACTIVE à la fois.
-- Les contrats TERMINATED ou CANCELED ne sont pas contraints (un local peut avoir plusieurs
-- contrats passés). Cet index complémente la vérification applicative dans ContractsService.create
-- et protège contre les race conditions concurrentes.

CREATE UNIQUE INDEX "Contract_localId_active_unique"
  ON "Contract" ("localId")
  WHERE "status" = 'ACTIVE';
