-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MonthlyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthStart" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "recap" JSONB,
    "errorMessage" TEXT,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- Carry legacy plain-text recaps over losslessly: the first sentence becomes the
-- headline and the rest becomes a single point. SQLite trim() strips only spaces
-- by default, so whitespace is passed explicitly to also strip newlines and tabs.
INSERT INTO "new_MonthlyReview" ("createdAt", "errorMessage", "generatedAt", "id", "monthStart", "recap", "status", "updatedAt")
SELECT "createdAt", "errorMessage", "generatedAt", "id", "monthStart",
  CASE
    WHEN "text" IS NULL OR "text" = '' THEN NULL
    WHEN instr("text", '. ') > 0 THEN json_object(
      'headline', trim(substr("text", 1, instr("text", '. ') + 1), ' ' || char(9) || char(10) || char(13)),
      'points', json_array(trim(substr("text", instr("text", '. ') + 2), ' ' || char(9) || char(10) || char(13)))
    )
    ELSE json_object('headline', "text", 'points', json_array())
  END,
  "status", "updatedAt"
FROM (
  SELECT *, trim("reviewText", ' ' || char(9) || char(10) || char(13)) AS "text" FROM "MonthlyReview"
);
DROP TABLE "MonthlyReview";
ALTER TABLE "new_MonthlyReview" RENAME TO "MonthlyReview";
CREATE UNIQUE INDEX "MonthlyReview_monthStart_key" ON "MonthlyReview"("monthStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
