# Norwegian UI copy

The app's interface is Norwegian Bokmål only. There is no i18n layer and no English fallback. Strings live in the components that render them.

`pnpm check:english` scans `src/` for English text in UI positions and exits non-zero when it finds any. English the user never sees, such as LLM prompt text and developer invariant errors, goes in `scripts/english-ui-allowlist.tsv`.

## Style

- Write Bokmål, addressing the user as "du".
- Use sentence case for headings, buttons, and navigation: "Månedlig oppsummering", not "Månedlig Oppsummering".
- Keep the English copy's tone and length. Do not add exclamation marks the English lacked.
- Norwegian month and weekday names are lowercase mid-sentence ("i mars").
- Format numbers, currency, and dates through `Intl` with the `nb-NO` locale, and `date-fns` with its `nb` locale. Never hand-build a decimal separator.
- Pluralise with both forms spelled out: `${count} transaksjon` / `${count} transaksjoner`.
- Keep API error codes (`snake_case`), URL paths, query parameters, and `data-testid` values in English. Only the human-readable `message` changes.

## Glossary

| English | Bokmål |
| --- | --- |
| Overview / Dashboard | Oversikt |
| Transaction(s) | Transaksjon(er) |
| Import (noun, nav) | Import |
| Import (verb) | Importer |
| Monthly review | Månedsoppsummering |
| Month in review | Måneden som gikk |
| Recap | Oppsummering |
| Settings | Innstillinger |
| Account(s) | Konto / kontoer |
| Category / categories | Kategori / kategorier |
| Uncategorized | Ukategorisert |
| Category rule | Kategoriregel |
| Classifier hint | Klassifiseringshint |
| AI suggestion | AI-forslag |
| Confidence | Sikkerhet |
| Merchant | Brukersted |
| Description | Beskrivelse |
| Notes | Notater |
| Amount | Beløp |
| Booking date | Bokføringsdato |
| Payment type | Betalingstype |
| Income | Inntekt |
| Expense / spending | Utgift / forbruk |
| Transfer | Overføring |
| Net cashflow | Netto kontantstrøm |
| Inflow / outflow | Inn / ut |
| Balance | Saldo |
| Message cleanup | Meldingsrydding |
| Column mapping | Kolonnekobling |
| Duplicate | Duplikat |
| Setup guide | Oppsettsguide |
| Feedback | Tilbakemelding |
| Theme: light / dark / system | Lyst / mørkt / system |
| Add / Edit / Delete / Remove | Legg til / Rediger / Slett / Fjern |
| Save / Cancel / Close | Lagre / Avbryt / Lukk |
| Search | Søk |
| Previous / Next | Forrige / Neste |
| Loading… | Laster inn… |
| Something went wrong | Noe gikk galt |
| Try again | Prøv igjen |
| Update (self-update) | Oppdater |
