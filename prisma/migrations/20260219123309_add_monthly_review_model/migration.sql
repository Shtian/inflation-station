-- CreateTable
CREATE TABLE "MonthlyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthStart" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "reviewText" TEXT,
    "errorMessage" TEXT,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReview_monthStart_key" ON "MonthlyReview"("monthStart");
