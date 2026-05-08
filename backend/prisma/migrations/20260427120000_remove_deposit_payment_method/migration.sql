-- Rendre paymentMethod nullable et passer les anciens DEPOSIT_USAGE à NULL
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" DROP NOT NULL;
UPDATE "Payment" SET "paymentMethod" = NULL WHERE "paymentMethod" = 'DEPOSIT';

-- Recréer l'enum PaymentMethod sans la valeur DEPOSIT
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'ORANGE_MONEY', 'MOBILE_MONEY');
ALTER TABLE "Payment"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
  USING ("paymentMethod"::text::"PaymentMethod");
DROP TYPE "PaymentMethod_old";
