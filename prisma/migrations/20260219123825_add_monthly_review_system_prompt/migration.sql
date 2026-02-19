-- CreateTable
CREATE TABLE "MonthlyReviewSystemPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
