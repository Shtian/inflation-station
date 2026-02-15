import { expect, test } from "@playwright/test";

test("parses CSV uploads from /import and shows validation feedback", async ({
  page,
}) => {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [
          {
            id: "acc-1",
            name: "Main Account",
            institution: "DNB",
            isActive: true,
          },
        ],
      }),
    });
  });

  await page.route("**/api/imports/parse", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          imported: 2,
          duplicates: 0,
          ignoredReserved: 1,
          invalid: 1,
        },
        errors: [
          {
            rowNumber: 4,
            code: "INVALID_AMOUNT",
            message:
              'Row 4 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
          },
        ],
      }),
    });
  });

  await page.goto("/import");

  await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
  await expect(page.getByLabel("Account")).toHaveValue("acc-1");

  await page.getByLabel("CSV file").setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bokføringsdato;Beløp\n01.01.2026;123,45", "utf8"),
  });

  await page.getByRole("button", { name: "Parse CSV" }).click();

  await expect(page.getByText("Parse summary")).toBeVisible();
  await expect(page.getByText("Imported")).toBeVisible();
  await expect(page.getByText("Ignored reserved")).toBeVisible();
  await expect(page.getByText("Validation errors")).toBeVisible();
  await expect(
    page.getByText(
      'Row 4: Row 4 has invalid amount "abc". Expected Norwegian decimal format like 123,45.',
    ),
  ).toBeVisible();
});
