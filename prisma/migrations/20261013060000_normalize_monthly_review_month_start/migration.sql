-- MonthlyReview.monthStart is canonical at UTC midnight on the 1st. Older seeds
-- wrote local midnight (Oslo September = 2026-08-31T22:00Z), and generating a
-- review for such a month inserted a second, UTC-keyed row. Shifting by 12 hours
-- before truncating maps both shapes to the same month. Prisma stores DateTime
-- here as TEXT in the form 2026-09-01T00:00:00.000+00:00.

-- When two rows land on the same month, keep the most recently updated one.
DELETE FROM "MonthlyReview"
WHERE EXISTS (
  SELECT 1 FROM "MonthlyReview" AS other
  WHERE other."id" <> "MonthlyReview"."id"
    AND strftime('%Y-%m', other."monthStart", '+12 hours')
      = strftime('%Y-%m', "MonthlyReview"."monthStart", '+12 hours')
    AND (
      other."updatedAt" > "MonthlyReview"."updatedAt"
      OR (other."updatedAt" = "MonthlyReview"."updatedAt" AND other."id" > "MonthlyReview"."id")
    )
);

UPDATE "MonthlyReview"
SET "monthStart" = strftime('%Y-%m-01T00:00:00.000+00:00', "monthStart", '+12 hours')
WHERE "monthStart" <> strftime('%Y-%m-01T00:00:00.000+00:00', "monthStart", '+12 hours');
