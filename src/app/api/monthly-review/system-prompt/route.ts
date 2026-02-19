import { NextResponse } from "next/server";
import {
  getMonthlyReviewSystemPromptSettings,
  updateMonthlyReviewSystemPromptSettings,
} from "@/lib/monthly-review/system-prompt";
import { prisma } from "@/lib/prisma";

type MonthlyReviewSystemPromptPayload = {
  promptText: string;
};

type MonthlyReviewSystemPromptResponse = {
  promptText: string;
  resolvedPrompt: string;
  usesDefaultPrompt: boolean;
};

function toResponse(
  result: Awaited<ReturnType<typeof getMonthlyReviewSystemPromptSettings>>,
): MonthlyReviewSystemPromptResponse {
  return {
    promptText: result.storedPromptText ?? "",
    resolvedPrompt: result.resolvedPrompt,
    usesDefaultPrompt: result.isDefault,
  };
}

function parsePayload(
  payload: unknown,
): MonthlyReviewSystemPromptPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (!("promptText" in payload) || typeof payload.promptText !== "string") {
    return null;
  }

  return { promptText: payload.promptText };
}

export async function GET() {
  try {
    const result = await getMonthlyReviewSystemPromptSettings(prisma);
    return NextResponse.json(toResponse(result));
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MONTHLY_REVIEW_SYSTEM_PROMPT_FETCH_FAILED",
        message: "Could not load monthly review system prompt.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json(
      {
        error: "INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD",
        message: "Expected promptText in request body.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await updateMonthlyReviewSystemPromptSettings(
      prisma,
      payload.promptText,
    );

    return NextResponse.json(toResponse(result));
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED",
        message: "Could not update monthly review system prompt.",
      },
      { status: 500 },
    );
  }
}
