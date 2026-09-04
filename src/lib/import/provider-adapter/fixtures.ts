/** Shared CSV fixture strings for provider-adapter tests. Grow as needed. */

/** Semicolon-delimited statement with Nordic headers, matching all mapped fields. */
export const NORDIC_SEMICOLON_CSV = [
  "Bokføringsdato;Beløp;Avsender;Mottaker;Beskrivelse;Melding;Valuta;Betalingstype",
  "15.01.2026;1234,56;Alice;ACME AS;Dagligvarer;Ukens handel;NOK;Kort",
].join("\n");

/**
 * Comma-delimited statement where the decimal-comma amount and a description
 * containing a literal comma both require quoting.
 */
export const COMMA_QUOTED_CSV = [
  "Dato,Beløp,Beskrivelse,Melding,Valuta",
  '01.02.2026,"1500,00","Rema 1000, Sentrum",Ukentlig,NOK',
].join("\n");

/** Statement with a blank line between the header and a reserved-booking-date row. */
export const RESERVED_ROW_WITH_BLANK_LINE_CSV = [
  "Bokføringsdato;Beløp;Beskrivelse;Melding;Valuta",
  "",
  "reservert;100,00;Ukjent;Ukjent;NOK",
  "16.01.2026;250,00;Kiosk;Snacks;NOK",
].join("\n");
