# Subscriptions Route AGENTS

Load this when working in `src/app/subscriptions`.

- `/subscriptions` ("Faste trekk") is a server component that calls `loadSubscriptionReview` from `src/lib/subscriptions/load.ts` with today's local date. Detection and alert rules live in `src/lib/subscriptions`, not here.
- The page reads the database directly, so stubbed Playwright specs cannot feed it. Cover it with an integrated spec (`tests/integrated/us-028-subscriptions.integrated.ts`).
- Decisions go through `setSubscriptionDecisionAction` and `clearSubscriptionDecisionAction` in `src/app/actions/subscription-decisions.ts`; both revalidate `/subscriptions`, which refreshes the page after the click. `components/decision-button.tsx` maps each button intent to its action and toast copy in one table.
- A decision is keyed by `normalizedMerchant`, so one click moves every candidate at that merchant.
- User-facing copy and number/date formatting live in `format.ts`. Amounts drop øre only when there are none ("449 kr", "149,90 kr").
- Merchant links go to `/transactions?globalQuery=<normalizedMerchant>`; the list query folds the search through `normalizeMerchantKey`, which leaves an already normalized key unchanged.
