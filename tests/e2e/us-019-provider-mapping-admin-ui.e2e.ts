import { expect, test } from "@playwright/test";

type MockProviderMapping = {
  id: string;
  providerName: string;
  normalizationRules: unknown;
  mappingVersion: number | null;
  fieldMappings: Array<{
    id: string;
    sourceField: string;
    canonicalField: string;
    transformRules: unknown;
  }>;
};

test("manages provider mappings from admin UI with validation feedback", async ({
  page,
}) => {
  let createServerActionRequestCount = 0;
  let lastPatchBody: unknown = null;
  const providerName = `Bank B ${Date.now()}`;
  let mappings: MockProviderMapping[] = [
    {
      id: "provider-1",
      providerName: "Bank A",
      normalizationRules: {},
      mappingVersion: 1,
      fieldMappings: [
        {
          id: "field-1",
          sourceField: "Dato",
          canonicalField: "bookingDate",
          transformRules: null,
        },
      ],
    },
  ];

  await page.route(
    "**/api/import-provider-mappings",
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ mappings }),
        });
        return;
      }

      await route.fallback();
    },
  );

  await page.route("**/import-provider-mappings", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      Object.hasOwn(request.headers(), "next-action")
    ) {
      createServerActionRequestCount += 1;

      if (createServerActionRequestCount === 1) {
        mappings = [
          {
            id: "provider-2",
            providerName,
            normalizationRules: {},
            mappingVersion: 1,
            fieldMappings: [
              {
                id: "field-new-1",
                sourceField: "Dato",
                canonicalField: "bookingDate",
                transformRules: null,
              },
              {
                id: "field-new-2",
                sourceField: "Belop",
                canonicalField: "amount",
                transformRules: null,
              },
              {
                id: "field-new-3",
                sourceField: "Tekst",
                canonicalField: "title",
                transformRules: null,
              },
            ],
          },
          ...mappings,
        ];
      }
    }

    await route.fallback();
  });

  await page.route(
    "**/api/import-provider-mappings/provider-2",
    async (route, request) => {
      if (request.method() !== "PATCH") {
        await route.fallback();
        return;
      }

      const payload = request.postDataJSON() as {
        providerName: string;
        mappingVersion?: number;
        normalizationRules?: unknown;
        fieldMappings?: Array<{
          sourceField: string;
          canonicalField: string;
          transformRules?: unknown;
        }>;
      };
      lastPatchBody = payload;

      const updatedMapping: MockProviderMapping = {
        id: "provider-2",
        providerName: payload.providerName,
        normalizationRules: payload.normalizationRules ?? {},
        mappingVersion: payload.mappingVersion ?? null,
        fieldMappings: (payload.fieldMappings ?? []).map(
          (fieldMapping, index) => ({
            id: `field-edit-${index + 1}`,
            sourceField: fieldMapping.sourceField,
            canonicalField: fieldMapping.canonicalField,
            transformRules: fieldMapping.transformRules ?? null,
          }),
        ),
      };
      mappings = [
        updatedMapping,
        ...mappings.filter((mapping) => mapping.id !== updatedMapping.id),
      ];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mapping: updatedMapping }),
      });
    },
  );

  await page.goto("/import-provider-mappings");

  await expect(
    page.getByRole("heading", { name: "Provider mappings" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add provider mapping" }).click();
  await page.getByLabel("Provider name").fill(providerName);
  await page.getByLabel("Mapping version (optional)").fill("1");
  await page
    .getByRole("textbox", { name: "Required source field bookingDate" })
    .fill("Dato");
  await page
    .getByRole("textbox", { name: "Required source field amount" })
    .fill("Belop");
  await page
    .getByRole("textbox", { name: "Required source field merchant signal" })
    .fill("Tekst");

  await page.getByRole("button", { name: "Create provider mapping" }).click();
  await expect(
    page.locator("[data-sonner-toast]", { hasText: "Provider mapping added." }),
  ).toBeVisible();
  await expect.poll(() => createServerActionRequestCount).toBe(1);
  await expect(
    page.getByRole("row", { name: new RegExp(providerName) }),
  ).toBeVisible();

  const bankBRow = page.getByRole("row", { name: new RegExp(providerName) });
  await bankBRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editReqHeaders = page.getByRole("textbox", {
    name: "Edit required headers",
  });
  await editReqHeaders.fill("dato");
  await editReqHeaders.press("Enter");
  await editReqHeaders.fill("belop");
  await editReqHeaders.press("Enter");

  // Lexical rule: select a supported decimal separator, derived from
  // SUPPORTED_PROVIDER_DECIMAL_SEPARATORS rather than free text.
  await page.getByRole("combobox", { name: "Edit decimal separator" }).click();
  await page.getByRole("option", { name: ".", exact: true }).click();

  // Supported transform: add a parameterless "trim" transform to the
  // bookingDate field mapping (the type select defaults to "trim").
  await page
    .getByRole("button", { name: "Add transform for bookingDate" })
    .click();
  await expect(
    page.getByRole("button", {
      name: 'Remove transform "Trim" for bookingDate',
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save provider mapping" }).click();

  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Provider mapping updated.",
    }),
  ).toBeVisible();
  expect(lastPatchBody).toEqual(
    expect.objectContaining({
      providerName,
      mappingVersion: 1,
      normalizationRules: {
        requiredHeaders: ["dato", "belop"],
        decimalSeparator: ".",
        dateFormat: "DD.MM.YYYY",
      },
      fieldMappings: expect.arrayContaining([
        expect.objectContaining({
          canonicalField: "bookingDate",
          sourceField: "Dato",
          transformRules: [{ type: "trim" }],
        }),
      ]),
    }),
  );

  // Reopen the mapping to confirm both the lexical rule and the transform
  // persisted through the reload rather than being dropped.
  await bankBRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Edit decimal separator" })
      .locator("[data-slot=select-value]"),
  ).toHaveText(".");
  await expect(
    page.getByRole("button", {
      name: 'Remove transform "Trim" for bookingDate',
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Add provider mapping" }).click();
  await page.getByLabel("Provider name").fill(providerName);
  await page.getByLabel("Mapping version (optional)").fill("1");
  await page
    .getByRole("textbox", { name: "Required source field bookingDate" })
    .fill("Dato");
  await page
    .getByRole("textbox", { name: "Required source field amount" })
    .fill("Belop");
  await page
    .getByRole("textbox", { name: "Required source field merchant signal" })
    .fill("Tekst");
  await page.getByRole("button", { name: "Create provider mapping" }).click();

  await expect.poll(() => createServerActionRequestCount).toBe(2);
  await expect(
    page.getByText("A provider mapping with this name already exists."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.route(
    "**/api/import-provider-mappings/provider-2",
    async (route, request) => {
      if (request.method() !== "DELETE") {
        await route.fallback();
        return;
      }

      mappings = mappings.filter((mapping) => mapping.id !== "provider-2");
      await route.fulfill({
        status: 204,
        contentType: "application/json",
        body: "",
      });
    },
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("row", { name: new RegExp(providerName) })
    .getByRole("button")
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(
    page.locator("[data-sonner-toast]", {
      hasText: "Provider mapping removed.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: new RegExp(providerName) }),
  ).toHaveCount(0);
});
