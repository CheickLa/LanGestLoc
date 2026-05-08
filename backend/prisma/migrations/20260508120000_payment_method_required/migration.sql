-- paymentMethod devient obligatoire : tout paiement doit avoir un moyen de paiement
-- (CASH, ORANGE_MONEY, MOBILE_MONEY) pour la traçabilité comptable.
-- Backfill défensif des éventuels NULL en CASH avant l'ajout de la contrainte.

UPDATE "Payment" SET "paymentMethod" = 'CASH' WHERE "paymentMethod" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" SET NOT NULL;
