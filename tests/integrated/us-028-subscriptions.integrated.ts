import { expect, test } from "@playwright/test";
import { format, subDays, subMonths } from "date-fns";
import {
  type FixtureTransaction,
  INTEGRATED_DB_LOCK,
  layFixture,
} from "../support/integrated-database";

const LAST_CHARGE = subDays(new Date(), 10);

function monthlyCharges(
  merchant: string,
  amounts: number[],
): FixtureTransaction[] {
  return amounts.map((amount, index) => ({
    account: "Brukskonto",
    bookingDate: format(
      subMonths(LAST_CHARGE, amounts.length - 1 - index),
      "yyyy-MM-dd",
    ),
    amountNok: -amount,
    merchant,
  }));
}

test(
  "confirms, dismisses and restores detected subscriptions",
  { lock: INTEGRATED_DB_LOCK },
  async ({ page }) => {
    await layFixture({
      accounts: [{ name: "Brukskonto" }],
      transactions: [
        ...monthlyCharges("Netflix", [129, 129, 139]),
        ...monthlyCharges("Spotify", [119, 119, 119]),
        ...monthlyCharges("Rema 1000", [312, 87, 540]),
      ],
    });

    await page.goto("/subscriptions");

    await expect(
      page.getByRole("heading", { level: 1, name: "Faste trekk" }),
    ).toBeVisible();
    const confirmed = page.getByRole("region", { name: "Bekreftet" });
    const suggested = page.getByRole("region", { name: "Forslag" });
    await expect(suggested.getByRole("link")).toHaveText([
      "Netflix",
      "Spotify",
    ]);
    await expect(
      confirmed.getByText("Ingen bekreftede faste trekk ennå."),
    ).toBeVisible();
    await expect(page.getByText("Per måned")).toHaveCount(0);

    await suggested.getByRole("button", { name: "Bekreft Netflix" }).click();

    await expect(
      page.locator("[data-sonner-toast]", {
        hasText: "Netflix er lagt til i faste trekk",
      }),
    ).toBeVisible();
    const netflixLink = confirmed.getByRole("link", { name: "Netflix" });
    await expect(netflixLink).toHaveAttribute(
      "href",
      "/transactions?globalQuery=netflix",
    );
    await expect(confirmed.getByText(/129\skr → 139\skr fra /)).toBeVisible();
    await expect(suggested.getByRole("link")).toHaveText(["Spotify"]);
    await expect(page.locator("dd")).toHaveText([/^139\skr$/, /^1\s668\skr$/]);

    await suggested.getByRole("button", { name: "Avvis Spotify" }).click();

    await expect(
      page.locator("[data-sonner-toast]", { hasText: "Spotify er avvist" }),
    ).toBeVisible();
    await expect(suggested.getByText("Ingen nye forslag.")).toBeVisible();

    await page.getByRole("button", { name: "Avviste (1)" }).click();
    await page.getByRole("button", { name: "Gjenopprett Spotify" }).click();

    await expect(
      page.locator("[data-sonner-toast]", {
        hasText: "Spotify er tilbake blant forslagene",
      }),
    ).toBeVisible();
    await expect(suggested.getByRole("link")).toHaveText(["Spotify"]);
    await expect(page.getByRole("button", { name: /Avviste/ })).toHaveCount(0);
  },
);
