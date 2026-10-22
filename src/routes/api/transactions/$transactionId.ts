import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/prisma";
import { deleteTransaction } from "@/lib/transactions/delete";
import {
  findMissingUpdateReference,
  parseTransactionUpdatePayload,
  updateTransaction,
} from "@/lib/transactions/write";
import { formatPayloadErrorMessage } from "./-payload-error-message";

function parseTransactionId(routeParams: unknown) {
  return typeof routeParams === "object" &&
    routeParams !== null &&
    "transactionId" in routeParams &&
    typeof routeParams.transactionId === "string"
    ? routeParams.transactionId
    : null;
}

export const Route = createFileRoute("/api/transactions/$transactionId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const transactionId = parseTransactionId(params);

        if (!transactionId) {
          return Response.json(
            {
              error: "INVALID_TRANSACTION_ID",
              message: "Ugyldig transaksjons-ID.",
            },
            { status: 400 },
          );
        }
        const payload = await request.json().catch(() => null);
        const parsed = parseTransactionUpdatePayload(payload);

        if (!parsed.success) {
          const flattened = parsed.error.flatten();

          return Response.json(
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

          return Response.json({ id: transaction.id });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2025"
          ) {
            return Response.json(
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
            if (
              (await findMissingUpdateReference(prisma, parsed.data)) === "trip"
            ) {
              return Response.json(
                {
                  error: "TRIP_NOT_FOUND",
                  message: "Fant ikke den valgte turen.",
                },
                { status: 404 },
              );
            }

            return Response.json(
              {
                error: "CATEGORY_NOT_FOUND",
                message: "Fant ikke den valgte kategorien.",
              },
              { status: 404 },
            );
          }

          throw error;
        }
      },
      DELETE: async ({ params }) => {
        const transactionId = parseTransactionId(params);

        if (!transactionId) {
          return Response.json(
            {
              error: "INVALID_TRANSACTION_ID",
              message: "Ugyldig transaksjons-ID.",
            },
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
            return Response.json(
              {
                error: "TRANSACTION_NOT_FOUND",
                message: "Fant ikke transaksjonen.",
              },
              { status: 404 },
            );
          }

          throw error;
        }
      },
    },
  },
});
