import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteTransaction } from "@/lib/transactions/delete";
import {
  findMissingUpdateReference,
  parseTransactionUpdatePayload,
  updateTransaction,
} from "@/lib/transactions/write";
import { formatPayloadErrorMessage } from "../payload-error-message";

type RouteParams = {
  params: Promise<unknown>;
};

async function parseTransactionId(params: Promise<unknown>) {
  const routeParams = await params;
  return typeof routeParams === "object" &&
    routeParams !== null &&
    "transactionId" in routeParams &&
    typeof routeParams.transactionId === "string"
    ? routeParams.transactionId
    : null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const transactionId = await parseTransactionId(params);

  if (!transactionId) {
    return NextResponse.json(
      { error: "INVALID_TRANSACTION_ID", message: "Ugyldig transaksjons-ID." },
      { status: 400 },
    );
  }
  const payload = await request.json().catch(() => null);
  const parsed = parseTransactionUpdatePayload(payload);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();

    return NextResponse.json(
      {
        error: "INVALID_TRANSACTION_UPDATE_PAYLOAD",
        message: formatPayloadErrorMessage(
          "Ugyldige data for oppdatering av transaksjon.",
          flattened,
        ),
        details: flattened,
      },
      { status: 400 },
    );
  }

  try {
    const transaction = await updateTransaction(prisma, {
      transactionId,
      updates: parsed.data,
    });

    return NextResponse.json({ id: transaction.id });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error: "TRANSACTION_NOT_FOUND",
          message: "Fant ikke transaksjonen.",
        },
        { status: 404 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      if ((await findMissingUpdateReference(prisma, parsed.data)) === "trip") {
        return NextResponse.json(
          { error: "TRIP_NOT_FOUND", message: "Fant ikke den valgte turen." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          error: "CATEGORY_NOT_FOUND",
          message: "Fant ikke den valgte kategorien.",
        },
        { status: 404 },
      );
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const transactionId = await parseTransactionId(params);

  if (!transactionId) {
    return NextResponse.json(
      { error: "INVALID_TRANSACTION_ID", message: "Ugyldig transaksjons-ID." },
      { status: 400 },
    );
  }

  try {
    await deleteTransaction(prisma, transactionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error: "TRANSACTION_NOT_FOUND",
          message: "Fant ikke transaksjonen.",
        },
        { status: 404 },
      );
    }

    throw error;
  }
}
