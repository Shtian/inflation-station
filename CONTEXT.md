# Inflation Station

A personal-finance app for importing bank transactions, categorising them, and
generating monthly AI-assisted reviews. This file is the project glossary: it
fixes the words we use, not how anything is built.

## Language

### Test suites

**Stubbed suite**:
The Playwright specs that intercept every API call and serve fixtures to the
browser, so no request reaches a route handler or a database. Covers dialog
behaviour, URL/pagination state, and request payload shape.
_Avoid_: mocked suite, fake suite, unit e2e

**Integrated suite**:
The Playwright specs that run against a real Next.js server backed by a real
migrated database, with no request interception. Exists to prove the browser →
route → Prisma → SQLite chain connects, not to re-test edge cases the domain
seam already owns.
_Avoid_: real e2e, true e2e, full e2e, live suite

### Categorization

**Rule match**:
A transaction category chosen by matching `CategoryRule.merchantContains` against
the transaction's normalized merchant text. Deterministic substring matching,
evaluated first, before any AI suggestion is requested. Carries no confidence.
_Avoid_: rule suggestion, static match

**AI suggestion**:
A transaction category chosen by the categorization provider's `Choice`
primitive, requested only for transactions no rule match fired for. Carries a
confidence.
_Avoid_: model pick, AI pick

**Confidence**:
The 0.0–1.0 calibrated probability an AI suggestion carries. Shown only on the
import review page, only beside AI suggestions, and never when the suggestion
itself is "Uncategorized."
_Avoid_: certainty, score

**Classifier hint**:
Optional short text on a `Category`, sent to the categorization provider
alongside the category name to disambiguate non-obvious categories. One hint
per category, reused for every transaction in it.
_Avoid_: description, AI hint

### Test data

**Fixture**:
A minimal, known, disposable row set created for one test and asserted against
by that test. Purpose-built for the scenario it serves.
_Avoid_: seed data, test seed

**Demo dataset**:
The broad, plausible-looking dataset that makes the app worth looking at
locally — named accounts, months of transactions, populated categories. Serves
development and manual exploration, not assertions.
_Avoid_: seed data, the seed
