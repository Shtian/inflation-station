import { createFileRoute } from "@tanstack/react-router";
import {
  generateCategoryHintGuess,
  resolveHintGuessDisabledReason,
} from "@/lib/categorization/hint-guess";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "Cache-Control": "no-store" };

export const Route = createFileRoute("/api/categories/$categoryId/hint-guess")({
  server: {
    handlers: {
      // Flag off and provider failures answer 200 with a reason: the editor then
      // behaves like it has no guess, and the console stays quiet on every open.
      GET: async ({ params }) => {
        const disabledReason = resolveHintGuessDisabledReason();
        if (disabledReason) {
          return Response.json(
            { guess: null, reason: disabledReason },
            { headers: NO_STORE },
          );
        }

        const { categoryId } = params;
        const result = await generateCategoryHintGuess({
          db: prisma,
          categoryId,
          apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
        });

        switch (result.status) {
          case "not_found":
            return Response.json(
              { error: "CATEGORY_NOT_FOUND" },
              { status: 404, headers: NO_STORE },
            );
          case "failed":
            return Response.json(
              { guess: null, reason: result.reason },
              { headers: NO_STORE },
            );
          case "ok":
            return Response.json(
              { guess: result.guess },
              { headers: NO_STORE },
            );
        }
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
