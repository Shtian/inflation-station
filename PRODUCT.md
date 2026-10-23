# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The owner plus a close circle of family and friends. Each person runs their own self-hosted clone with its own database. Use is mostly a recurring ritual at a desk: import the month's bank and card statements, check and fix categories, then read the monthly review to see where the money went.

## Product Purpose
Inflation Station puts a person's spending from several Norwegian banks and cards into one place. It categorizes transactions automatically and turns each month into AI-assisted insight. Success means the monthly import-and-review takes little effort, the categories are accurate enough to trust, and the review tells the user something true about their spending they would not otherwise notice.

## Positioning
- **Across banks:** it combines statements from banks and cards that never talk to each other (CSV exports and PDF invoices such as Trumf) into one ledger.
- **Auto-categorized:** deterministic rule matches run first, then AI suggestions with calibrated confidence fill the gaps, and the user keeps the final say.
- **AI insight:** a monthly review explains the month instead of only charting it.

## Operating Context
- Self-hosted on a Raspberry Pi or Linux box under pm2, reached over the local network or through a reverse proxy. There is no login, so access control lives at the proxy.
- Data is Norwegian: amounts are in NOK with nb-NO formatting, and bank exports and invoices come from Norwegian providers. The UI copy is currently in English, and a Norwegian translation or localization is planned.
- Core workflow: import (CSV column mapping or PDF provider) → review stage (rule match / AI suggestion, dedupe) → transactions → monthly review. Supporting surfaces are overview dashboard, accounts, categories with classifier hints, onboarding (guide + chat), and a feedback widget that files GitHub issues.
- AI features need `OPENAI_API_KEY`. Everything else runs fully locally on SQLite.

## Capabilities and Constraints
- Stack: TanStack Start on Vite+, TypeScript, Prisma + SQLite, Tailwind, Base UI / shadcn-style components, Sonner toasts.
- Domain terms are defined in `CONTEXT.md` (rule match, AI suggestion, confidence, classifier hint, demo dataset). Use those words in the UI and in docs.
- Confidence is shown only on the import review page, only next to AI suggestions, and never when the suggestion is "Uncategorized".
- The app is used mainly on desktop. Mobile layouts are not a priority.
- Language: Norwegian UI is planned, either as a full translation or through localization (the approach is not decided yet). New copy should be easy to translate: no strings baked into images, layouts that can take longer Norwegian words, and no idioms that only work in English.

## Brand Commitments
- Name: Inflation Station.
- Dark-first: dark is the default theme, and the user-selectable palettes (Ember, Ocean, Botanical, Plum) are part of the product.

## Evidence on Hand
- The demo dataset (`pnpm db:seed`) gives realistic accounts, months of transactions, and categories for exploring and screenshots.
- Real statement samples live in `test-data/`.
- There are no testimonials, user counts, or external claims. Do not fabricate them.

## Product Principles
1. **One honest ledger.** Bring scattered sources together without losing or duplicating a transaction.
2. **Automate the drudgery, keep the user in charge.** Rules first, AI second, and the human confirms. Show confidence only where it helps a decision.
3. **Insight over bookkeeping.** The payoff is understanding the month, not maintaining a budget.
4. **Your data stays yours.** Local-first and self-hosted. Only AI calls leave the box.

## Accessibility & Inclusion
Screen-reader support is out of scope for this audience. No formal accessibility standard is required.
