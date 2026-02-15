import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  institution: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_ACCOUNT_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const account = await prisma.account.create({
      data: {
        name: parsed.data.name,
        institution: parsed.data.institution,
        isActive: parsed.data.isActive ?? true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
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
