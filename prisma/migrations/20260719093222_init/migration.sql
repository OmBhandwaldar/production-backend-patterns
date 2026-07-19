-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "makerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Transaction_makerId_idx" ON "Transaction"("makerId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
