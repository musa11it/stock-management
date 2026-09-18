-- Expense Management module: a new, additive table - no existing data touched.

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARY', 'ELECTRICITY', 'WATER', 'RENT', 'TAX', 'TRANSPORT', 'MAINTENANCE', 'INTERNET', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PAID');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "recipientUserId" TEXT,
    "recipientName" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PAID',
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expenseNumber_key" ON "expenses"("expenseNumber");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_createdAt_idx" ON "expenses"("createdAt");

-- CreateIndex
CREATE INDEX "expenses_recipientUserId_idx" ON "expenses"("recipientUserId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
