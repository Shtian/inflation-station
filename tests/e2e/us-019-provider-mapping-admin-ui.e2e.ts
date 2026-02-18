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
    transformRules: null;
  }>;
};

test("manages provider mappings from admin UI with validation feedback", async ({
  page,
}) => {
  let createAttempt = 0;
  let lastPatchBody: unknown = null;
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

      if (request.method() === "POST") {
        if (createAttempt === 0) {
          createAttempt += 1;
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              error: "REQUIRED_CANONICAL_FIELDS_MISSING",
              missingCanonicalFields: ["amount", "paymentType"],
            }),
          });
          return;
        }

        const payload = request.postDataJSON() as {
          providerName: string;
          mappingVersion?: number;
          normalizationRules?: unknown;
          fieldMappings?: Array<{
            sourceField: string;
            canonicalField: string;
          }>;
        };

        const createdMapping: MockProviderMapping = {
          id: "provider-2",
          providerName: payload.providerName,
          normalizationRules: payload.normalizationRules ?? {},
          mappingVersion: payload.mappingVersion ?? null,
          fieldMappings: (payload.fieldMappings ?? []).map(
            (fieldMapping, index) => ({
              id: `field-new-${index + 1}`,
              sourceField: fieldMapping.sourceField,
              canonicalField: fieldMapping.canonicalField,
              transformRules: null,
            }),
          ),
        };
        mappings = [createdMapping, ...mappings];

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ mapping: createdMapping }),
        });
        return;
      }

      await route.fallback();
    },
  );

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
            transformRules: null,
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
  await page.getByLabel("Provider name").fill("Bank B");
  await page.getByLabel("Mapping version (optional)").fill("2");
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
    page.getByText("Missing required canonical fields: amount, paymentType."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create provider mapping" }).click();
  await expect(page.getByText("Provider mapping added.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Bank B/i })).toBeVisible();

  const bankBRow = page.getByRole("row", { name: /Bank B/i });
  await bankBRow.getByRole("button", { name: "Actions for Bank B" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editReqHeaders = page.getByRole("textbox", {
    name: "Edit required headers",
  });
  await editReqHeaders.fill("dato");
  await editReqHeaders.press("Enter");
  await editReqHeaders.fill("belop");
  await editReqHeaders.press("Enter");
  await page.getByRole("button", { name: "Save provider mapping" }).click();

  await expect(page.getByText("Provider mapping updated.")).toBeVisible();
  expect(lastPatchBody).toEqual(
    expect.objectContaining({
      providerName: "Bank B",
      mappingVersion: 2,
      normalizationRules: {
        requiredHeaders: ["dato", "belop"],
      },
    }),
  );
});
