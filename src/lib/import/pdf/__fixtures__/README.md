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

## `trumf-2026-09.pdf` closes the loop back to a real file

The JSON fixtures start after `extract-items.ts`, so on their own they prove
nothing about `unpdf`. `trumf-2026-09.pdf` is `trumf-2026-09.json` rendered back
into a PDF, and `extract-items.test.ts` reads it to check that the extraction
returns those same 303 items. Regenerate it with:

```
node tests/support/statement-pdf.ts \
  src/lib/import/pdf/__fixtures__/trumf-2026-09.json \
  src/lib/import/pdf/__fixtures__/trumf-2026-09.pdf
```

`tests/support/statement-pdf.ts` prints the items through Playwright's chromium
at their statement coordinates, flipping y because PDF user space counts up from
the bottom of the page and CSS counts down from the top. Chromium's Helvetica is
not the issuer's font, so an item wide enough to reach its right-hand neighbour
is scaled down until it clears the 0.6pt gap that `extract-items.ts` glues
across. Text and x positions never move.

Regenerating changes the bytes even when the items are identical, because
chromium stamps a creation date. Rerun the command only when the JSON changes.

Chromium prints cleaner than the issuer does, so this fixture does not cover all
of `extract-items.ts`. It gives every item on a line one identical y and emits
each item as a single run. Setting `Y_TOLERANCE` to 0 or `GLUE_GAP` to 0 still
passes, whereas rounding y down instead of to nearest fails. Those two constants
absorb quirks only a real statement has, and the JSON fixtures are the record of
them.
