import {
  FileText,
  Landmark,
  Loader2,
  Pencil,
  UploadCloud,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Account, ProviderDetection } from "../use-import-workflow";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Provider = {
  id: string;
  name: string;
};

type ImportUploadPhaseProps = {
  accountError: string | null;
  activeAccounts: Account[];
  allProviders: Provider[];
  categoryError: string | null;
  clearSelectedFile: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  hasActiveAccounts: boolean;
  importError: string | null;
  importLoading: boolean;
  isDraggingOver: boolean;
  onFileSelected: (file: File | null) => void;
  openProviderDialog: () => void;
  parseCsv: () => void;
  providerDetection: ProviderDetection | null;
  selectedAccountId: string;
  selectedFile: File | null;
  setIsDraggingOver: (value: boolean) => void;
  setSelectedAccountId: (value: string) => void;
  submitNotice: string | null;
};

export function ImportUploadPhase({
  accountError,
  activeAccounts,
  allProviders,
  categoryError,
  clearSelectedFile,
  fileInputRef,
  hasActiveAccounts,
  importError,
  importLoading,
  isDraggingOver,
  onFileSelected,
  openProviderDialog,
  parseCsv,
  providerDetection,
  selectedAccountId,
  selectedFile,
  setIsDraggingOver,
  setSelectedAccountId,
  submitNotice,
}: ImportUploadPhaseProps) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="font-semibold text-foreground text-lg">
            Import Configuration
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Select the target bank account and upload your CSV file to begin.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="account-select"
              className="font-medium text-foreground text-sm"
            >
              Bank Account
            </Label>
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
              disabled={!hasActiveAccounts}
            >
              <SelectTrigger id="account-select" className="w-full">
                <div className="flex items-center gap-2">
                  <Landmark
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <SelectValue
                    placeholder={
                      hasActiveAccounts
                        ? "Select a bank account"
                        : "No active accounts available"
                    }
                  />
                </div>
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Choose the account this CSV data belongs to.
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label
              htmlFor="csv-file"
              className="font-medium text-foreground text-sm"
            >
              CSV File
            </Label>

            <input
              name="csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              id="csv-file"
              className="sr-only"
              onChange={(event) => {
                onFileSelected(event.target.files?.[0] ?? null);
              }}
            />

            {selectedFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <FileText className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-foreground"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </p>
                  <p className="text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  aria-label="Clear selected file"
                  onClick={clearSelectedFile}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 text-center transition-colors",
                  isDraggingOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (!file) return;
                  if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
                    return;
                  }
                  onFileSelected(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="rounded-full bg-muted p-3">
                  <UploadCloud
                    className="h-6 w-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground text-sm">
                    Drag &amp; drop your CSV file
                  </p>
                  <p className="text-muted-foreground text-xs">
                    or click to browse from your computer
                  </p>
                </div>
                <span className="pointer-events-none inline-flex items-center rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm">
                  Browse Files
                </span>
                <p className="text-muted-foreground text-xs">
                  Supports .csv files up to 10MB
                </p>
              </button>
            )}
          </div>

          {providerDetection ? (
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-xs">
                Provider
              </p>
              <div className="flex items-center gap-2">
                {providerDetection.state === "certain" ? (
                  <>
                    <Badge className="border-green-200 bg-green-100 text-green-800">
                      {providerDetection.providerName}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-xs"
                      onClick={openProviderDialog}
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Change
                    </Button>
                  </>
                ) : providerDetection.state === "uncertain" ? (
                  <>
                    <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                      {providerDetection.providerName ?? "Unknown"}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-xs"
                      onClick={openProviderDialog}
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Change
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="destructive">No provider detected</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-xs"
                      onClick={openProviderDialog}
                    >
                      Select provider
                    </Button>
                  </>
                )}
              </div>
              {providerDetection.state === "uncertain" ? (
                <p className="text-muted-foreground text-xs">
                  Detection was uncertain — please confirm
                </p>
              ) : null}
            </div>
          ) : null}

          {accountError ? (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
            >
              {accountError}
            </p>
          ) : null}
          {importError ? (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
            >
              {importError}
            </p>
          ) : null}
          {categoryError ? (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
            >
              {categoryError}
            </p>
          ) : null}
        </div>

        <Button
          onClick={parseCsv}
          disabled={!hasActiveAccounts || importLoading}
          className="mt-6 w-full gap-2"
        >
          {importLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Parsing…
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Parse &amp; Preview
            </>
          )}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2.5 font-medium text-foreground text-sm">
          Supported bank formats
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(allProviders.length > 0
            ? allProviders.slice(0, 5)
            : [
                { id: "_chase", name: "Chase Bank" },
                { id: "_boa", name: "Bank of America" },
                { id: "_wells", name: "Wells Fargo" },
                { id: "_citi", name: "Citi Bank" },
              ]
          ).map((provider) => (
            <Badge key={provider.id} variant="outline">
              {provider.name}
            </Badge>
          ))}
          {allProviders.length > 5 ? (
            <Badge variant="outline">+ {allProviders.length - 5} more</Badge>
          ) : null}
        </div>
        <p className="mt-2 text-muted-foreground text-xs">
          The parser automatically detects the bank based on the CSV column
          headers.
        </p>
      </div>

      {submitNotice ? (
        <output className="block rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm">
          {submitNotice}
        </output>
      ) : null}
    </div>
  );
}
