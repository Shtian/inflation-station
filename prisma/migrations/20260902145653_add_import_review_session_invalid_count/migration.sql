-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ImportReviewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportReviewSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ImportReviewSession" ("accountId", "createdAt", "id", "updatedAt") SELECT "accountId", "createdAt", "id", "updatedAt" FROM "ImportReviewSession";
DROP TABLE "ImportReviewSession";
ALTER TABLE "new_ImportReviewSession" RENAME TO "ImportReviewSession";
CREATE INDEX "ImportReviewSession_accountId_createdAt_idx" ON "ImportReviewSession"("accountId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
