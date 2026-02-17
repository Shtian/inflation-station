import { NextResponse } from "next/server";
import { detectProviderFromCsv } from "@/lib/import/provider-detection";
import { stageParsedImportRows } from "@/lib/import/review-stage";
import { prisma } from "@/lib/prisma";

type ParseImportPayload = {
  accountId: string;
  csvContent: string;
};

function badRequest(error: string, message: string) {
  return NextResponse.json({ error, message }, { status: 400 });
}

async function parseImportPayload(
  request: Request,
): Promise<ParseImportPayload | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return null;
    }

    const accountId = formData.get("accountId");
    const file = formData.get("file");

    if (typeof accountId !== "string") {
      return null;
    }

    let csvContent: string | null = null;

    if (file instanceof File) {
      csvContent = await file.text();
    } else if (typeof file === "string") {
      csvContent = file;
    } else {
      const content = formData.get("csvContent");
      csvContent = typeof content === "string" ? content : null;
    }

    if (csvContent === null) {
      return null;
    }

    return {
      accountId,
      csvContent,
    };
  }

  const payload = await request.json().catch(() => null);

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.accountId !== "string" ||
    typeof payload.csvContent !== "string"
  ) {
    return null;
  }

  return {
    accountId: payload.accountId,
    csvContent: payload.csvContent,
  };
}

export async function POST(request: Request) {
  const payload = await parseImportPayload(request);

  if (!payload) {
    return badRequest(
      "INVALID_IMPORT_PAYLOAD",
      "Expected accountId and CSV content via multipart form-data or JSON payload.",
    );
  }

  const accountId = payload.accountId.trim();
  if (!accountId) {
    return badRequest("ACCOUNT_ID_REQUIRED", "An account must be selected.");
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });

  if (!account) {
    return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  }

  const csvContent = payload.csvContent.trim();
  if (!csvContent) {
    return badRequest(
      "CSV_FILE_REQUIRED",
      "A CSV file is required for transaction import.",
    );
  }

  const staged = await stageParsedImportRows(prisma, {
    accountId,
    csvContent,
  });
  const detection = await detectProviderFromCsv(prisma, csvContent);

  return NextResponse.json({
    detection,
    summary: staged.summary,
    errors: staged.errors,
    review: staged.review,
  });
}
