-- Per-account column mapping replaces provider mappings.
ALTER TABLE "Account" ADD COLUMN "csvColumnMapping" JSONB;
ALTER TABLE "Account" ADD COLUMN "csvHeaderSignature" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ImportProviderFieldMapping";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ImportProviderMapping";
PRAGMA foreign_keys=on;
