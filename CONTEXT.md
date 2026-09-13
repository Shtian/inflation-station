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
