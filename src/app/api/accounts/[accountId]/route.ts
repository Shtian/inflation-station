import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    institution: z.string().trim().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.institution !== undefined ||
      value.isActive !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

type RouteParams = {
  params: Promise<{
    accountId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { accountId } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_ACCOUNT_UPDATE_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.institution !== undefined
          ? { institution: parsed.data.institution?.trim() || null }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "ACCOUNT_NAME_MUST_BE_UNIQUE" },
        { status: 409 },
      );
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { accountId } = await params;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  }

  if (account._count.transactions > 0) {
    return NextResponse.json(
      {
        error: "ACCOUNT_HAS_TRANSACTIONS",
        message: "Cannot delete account while transactions are linked to it.",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.account.delete({
      where: { id: accountId },
    });

    return NextResponse.json(null, { status: 204 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }

    throw error;
  }
}
