/*
  Warnings:

  - You are about to drop the column `pdfPath` on the `Receipt` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Rent` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Rent` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `RentDue` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Deposit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `s3Key` to the `Receipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `effectiveFrom` to the `Rent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RentDue` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RentDue" DROP CONSTRAINT "RentDue_paymentId_fkey";

-- DropIndex
DROP INDEX "RentDue_paymentId_key";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usageNote" TEXT,
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "pdfPath",
ADD COLUMN     "s3Key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Rent" DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "effectiveTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RentDue" DROP COLUMN "paymentId",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "PaymentLine" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "rentDueId" INTEGER NOT NULL,

    CONSTRAINT "PaymentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentLine_paymentId_idx" ON "PaymentLine"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLine_rentDueId_key" ON "PaymentLine"("rentDueId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "RentDue_status_idx" ON "RentDue"("status");

-- AddForeignKey
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_rentDueId_fkey" FOREIGN KEY ("rentDueId") REFERENCES "RentDue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
