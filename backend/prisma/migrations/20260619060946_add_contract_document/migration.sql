-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "documentNo" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractDocument_contractId_key" ON "ContractDocument"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDocument_documentNo_key" ON "ContractDocument"("documentNo");

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
