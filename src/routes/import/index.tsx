import { createFileRoute } from "@tanstack/react-router";
import { ImportUploader } from "@/app/import/import-uploader";
import { ImportError, ImportPending } from "./-components/import-route-states";

export const Route = createFileRoute("/import/")({
  head: () => ({ meta: [{ title: "Import · Inflation Station" }] }),
  pendingComponent: ImportPending,
  errorComponent: ImportError,
  component: ImportUploader,
});
