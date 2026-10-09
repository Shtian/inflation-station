import { ImportUploader } from "./import-uploader";

// PROTOTYPE — ?variant= picks a column-mapping layout (branch-only).
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  return <ImportUploader variant={variant ?? "A"} />;
}
