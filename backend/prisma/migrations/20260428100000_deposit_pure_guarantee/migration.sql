-- La caution devient une garantie pure : jamais utilisée pour solder un loyer.
-- À la fin d'un contrat, elle est systématiquement restituée (REFUNDED).
-- Cette migration supprime DEPOSIT_USAGE de PaymentType, USED de DepositStatus,
-- et les colonnes usedAt/usageNote de Deposit qui n'ont plus d'usage.

-- 1. Recrée PaymentType sans DEPOSIT_USAGE
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
CREATE TYPE "PaymentType" AS ENUM ('RENT', 'DEPOSIT_HELD', 'DEPOSIT_REFUND');
ALTER TABLE "Payment" ALTER COLUMN "type" TYPE "PaymentType" USING "type"::text::"PaymentType";
DROP TYPE "PaymentType_old";

-- 2. Recrée DepositStatus sans USED
ALTER TYPE "DepositStatus" RENAME TO "DepositStatus_old";
CREATE TYPE "DepositStatus" AS ENUM ('HELD', 'REFUNDED');
ALTER TABLE "Deposit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Deposit" ALTER COLUMN "status" TYPE "DepositStatus" USING "status"::text::"DepositStatus";
ALTER TABLE "Deposit" ALTER COLUMN "status" SET DEFAULT 'HELD';
DROP TYPE "DepositStatus_old";

-- 3. Supprime les colonnes obsolètes
ALTER TABLE "Deposit" DROP COLUMN "usedAt";
ALTER TABLE "Deposit" DROP COLUMN "usageNote";
