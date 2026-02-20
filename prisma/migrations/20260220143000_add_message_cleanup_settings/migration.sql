-- CreateTable
CREATE TABLE "MessageCleanupSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptText" TEXT,
    "modelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
