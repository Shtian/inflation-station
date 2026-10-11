import { NextResponse } from "next/server";
import {
  generateCategoryHintGuess,
  resolveHintGuessDisabledReason,
} from "@/lib/categorization/hint-guess";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    categoryId: string;
  }>;
};

const NO_STORE = { "Cache-Control": "no-store" };

// Flag off and provider failures answer 200 with a reason: the editor then
// behaves like it has no guess, and the console stays quiet on every open.
export async function GET(_request: Request, { params }: RouteParams) {
  const disabledReason = resolveHintGuessDisabledReason();
  if (disabledReason) {
    return NextResponse.json(
      { guess: null, reason: disabledReason },
      { headers: NO_STORE },
    );
  }

  const { categoryId } = await params;
  const result = await generateCategoryHintGuess({
    db: prisma,
    categoryId,
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  });

  switch (result.status) {
    case "not_found":
      return NextResponse.json(
        { error: "CATEGORY_NOT_FOUND" },
        { status: 404, headers: NO_STORE },
      );
    case "failed":
      return NextResponse.json(
        { guess: null, reason: result.reason },
        { headers: NO_STORE },
      );
    case "ok":
      return NextResponse.json({ guess: result.guess }, { headers: NO_STORE });
  }
}
