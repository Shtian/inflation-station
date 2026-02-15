-- CreateTable
CREATE TABLE "ImportReviewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportReviewSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportReviewRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "bookingDate" DATETIME NOT NULL,
    "amountNok" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "normalizedMerchant" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'OTHER',
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportReviewRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImportReviewSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportReviewSession_accountId_createdAt_idx" ON "ImportReviewSession"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportReviewRow_sessionId_rowNumber_idx" ON "ImportReviewRow"("sessionId", "rowNumber");
