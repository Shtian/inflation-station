import { CategoryKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  kind: z.nativeEnum(CategoryKind).default(CategoryKind.EXPENSE),
  accountId: z.string().trim().min(1).nullable().optional(),
});

export async function GET() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      accountId: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_CATEGORY_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        kind: parsed.data.kind,
        accountId: parsed.data.accountId ?? null,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "CATEGORY_NAME_MUST_BE_UNIQUE" },
        { status: 409 },
      );
    }

    throw error;
  }
}
