import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteTransaction } from "@/lib/transactions/delete";
import {
  parseTransactionUpdatePayload,
  updateTransaction,
} from "@/lib/transactions/update";

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
      { error: "INVALID_TRANSACTION_ID" },
      { status: 400 },
    );
  }
  const payload = await request.json().catch(() => null);
  const parsed = parseTransactionUpdatePayload(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_TRANSACTION_UPDATE_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const transaction = await updateTransaction(prisma, {
      transactionId,
      updates: parsed.data,
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "TRANSACTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "TRANSACTION_DUPLICATE_FIELDS" },
        { status: 409 },
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "CATEGORY_NOT_FOUND" },
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
      { error: "INVALID_TRANSACTION_ID" },
      { status: 400 },
    );
  }

  try {
    await deleteTransaction(prisma, transactionId);
    return NextResponse.json(null, { status: 204 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "TRANSACTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    throw error;
  }
}
