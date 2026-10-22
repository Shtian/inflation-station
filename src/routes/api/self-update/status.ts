import { createFileRoute } from "@tanstack/react-router";
import { readSelfUpdateStatus } from "@/lib/self-update/self-update";

export const Route = createFileRoute("/api/self-update/status")({
  server: {
    handlers: {
      GET: async () => {
        const root = process.env.SELF_UPDATE_ROOT;
        if (!root) {
          return Response.json(
            { error: "SELF_UPDATE_DISABLED" },
            { status: 404 },
          );
        }

        return Response.json(
          await readSelfUpdateStatus(
            root,
            import.meta.env.VITE_BUILD_SHA ?? "unknown",
          ),
        );
      },
    },
  },
});
