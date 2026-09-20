# PDF statement fixtures

Each file is a `StatementItem[]`, the positioned text of a real monthly
credit-card statement after `extract-items.ts` has run over it.

They are anonymized derivatives. Preserved exactly: every x and y coordinate,
the row counts, all header variants, the wrapped-specification line in
`trumf-2026-01`, both sign conventions, and Norwegian number formatting.
Replaced: merchant names, every amount, every balance, and the cardholder's
name, address, card number, account number and KID.

The balances were recomputed from the synthetic amounts, so the reconciliation
assertions check a number that was derived rather than one that was typed. A
fixture whose rows no longer sum to its closing balance is a broken fixture.

| fixture | rows | why it exists |
|---|---|---|
| `trumf-2026-09.json` | 39 | Three header variants on one page, a third page with no header at all, and `Nytt skyldig beløp` repeating as a page footer |
| `trumf-2026-01.json` | 30 | Crosses the new year, so `.25` and `.26` dates appear in one document. Also holds the one wrapped specification line |
| `amex-2026-09.json` | 9 | Two independent table columns per page, multi-line foreign-currency rows, and charges printed positive |

Merchant name literals in the tests move whenever these are regenerated.
Amounts, row counts and drift do not.

Regenerating needs the original statements, which are not in this repo for the
obvious reason. Run `probe.mjs` from the exploration scratch directory over a
real PDF, then the anonymizer and the balance fixer.
