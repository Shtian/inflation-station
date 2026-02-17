-- CreateTable
CREATE TABLE "ImportProviderMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerName" TEXT NOT NULL,
    "normalizationRules" JSONB NOT NULL,
    "mappingVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportProviderFieldMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerMappingId" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "canonicalField" TEXT NOT NULL,
    "transformRules" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportProviderFieldMapping_providerMappingId_fkey" FOREIGN KEY ("providerMappingId") REFERENCES "ImportProviderMapping" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportProviderMapping_providerName_key" ON "ImportProviderMapping"("providerName");

-- CreateIndex
CREATE INDEX "ImportProviderFieldMapping_providerMappingId_sourceField_idx" ON "ImportProviderFieldMapping"("providerMappingId", "sourceField");

-- CreateIndex
CREATE UNIQUE INDEX "ImportProviderFieldMapping_providerMappingId_canonicalField_key" ON "ImportProviderFieldMapping"("providerMappingId", "canonicalField");
