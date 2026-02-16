import { PaymentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createCategoryRuleSchema = z.object({
  accountId: z.string().trim().min(1).nullable().optional(),
  categoryId: z.string().trim().min(1),
  merchantContains: z.string().trim().min(1),
  paymentType: z.nativeEnum(PaymentType).nullable().optional(),
  priority: z.number().int().default(100),
});

export async function GET() {
  const rules = await prisma.categoryRule.findMany({
    select: {
      id: true,
      accountId: true,
      categoryId: true,
      merchantContains: true,
      paymentType: true,
      priority: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createCategoryRuleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_CATEGORY_RULE_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const rule = await prisma.categoryRule.create({
      data: {
        accountId: parsed.data.accountId ?? null,
        categoryId: parsed.data.categoryId,
        merchantContains: parsed.data.merchantContains,
        paymentType: parsed.data.paymentType ?? null,
        priority: parsed.data.priority,
      },
      select: {
        id: true,
        accountId: true,
        categoryId: true,
        merchantContains: true,
        paymentType: true,
        priority: true,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "CATEGORY_OR_ACCOUNT_NOT_FOUND" },
        { status: 404 },
      );
    }

    throw error;
  }
}
