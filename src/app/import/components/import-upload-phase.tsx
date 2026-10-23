"use client";

import {
  ArrowLeft,
  Check,
  FileText,
  Landmark,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Account } from "../use-import-workflow";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ImportUploadPhaseProps = {
  accountError: string | null;
  activeAccounts: Account[];
  categoryError: string | null;
  clearSelectedFile: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  hasActiveAccounts: boolean;
  importError: string | null;
  importLoading: boolean;
  isDraggingOver: boolean;
  onFileSelected: (file: File | null) => void;
  parseCsv: () => void;
  selectedAccountId: string;
  selectedFile: File | null;
  setIsDraggingOver: (value: boolean) => void;
  setSelectedAccountId: (value: string) => void;
};

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ImportUploadPhase({
  accountError,
  activeAccounts,
  categoryError,
  clearSelectedFile,
  fileInputRef,
  hasActiveAccounts,
  importError,
  importLoading,
  isDraggingOver,
  onFileSelected,
  parseCsv,
  selectedAccountId,
  selectedFile,
  setIsDraggingOver,
  setSelectedAccountId,
}: ImportUploadPhaseProps) {
  const selectedAccount = activeAccounts.find(
    (a) => a.id === selectedAccountId,
  );

  // Step 1: no account selected — show selectable account cards
  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center">
        <FadeIn className="mb-6 space-y-1 text-center">
          <p className="text-sm text-foreground">
            Hvilken konto gjelder dette?
          </p>
          <p className="text-xs text-muted-foreground">
            Velg kontoen disse transaksjonene hører til.
          </p>
        </FadeIn>

        {!hasActiveAccounts ? (
          <FadeIn delay={60}>
            <p className="text-sm text-muted-foreground">
              Ingen aktive kontoer tilgjengelig.
            </p>
          </FadeIn>
        ) : (
          <FadeIn delay={60} className="w-full max-w-xl">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {activeAccounts.map((account, i) => (
                <FadeIn key={account.id} delay={80 + i * 40}>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className="group flex w-full cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-muted-foreground/40 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Landmark className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                    <div>
                      <p className="text-sm leading-tight font-medium text-foreground">
                        {account.name}
                      </p>
                      {account.institution ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {account.institution}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        )}

        {accountError ? (
          <FadeIn delay={120} className="mt-4 w-full max-w-xl">
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {accountError}
            </p>
          </FadeIn>
        ) : null}
      </div>
    );
  }

  // Step 2: account selected — show selected account + upload zone
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-lg space-y-4">
        <FadeIn>
          <button
            type="button"
            onClick={() => {
              setSelectedAccountId("");
              clearSelectedFile();
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Tilbake til kontoer
          </button>
        </FadeIn>

        <FadeIn delay={40}>
          <div className="flex items-center gap-3 rounded-lg border border-primary/50 bg-card px-4 py-3">
            <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {selectedAccount.name}
              </p>
              {selectedAccount.institution ? (
                <p className="text-xs text-muted-foreground">
                  {selectedAccount.institution}
                </p>
              ) : null}
            </div>
            <Check className="h-4 w-4 shrink-0 text-primary" />
          </div>
        </FadeIn>

        <FadeIn delay={80} className="flex justify-center">
          <div className="h-4 w-px bg-border" />
        </FadeIn>

        <FadeIn delay={120} className="-mt-2 space-y-3">
          <input
            name="statement-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.pdf,application/pdf"
            aria-label="Kontoutskrift"
            id="statement-file"
            className="sr-only"
            onChange={(event) => {
              onFileSelected(event.target.files?.[0] ?? null);
            }}
          />

          {selectedFile ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <FileText className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-foreground"
                  title={selectedFile.name}
                >
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label="Fjern valgt fil"
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
                "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center transition-colors",
                isDraggingOver
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-muted-foreground/40 hover:bg-muted/20",
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
                onFileSelected(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <p className="text-sm text-foreground">
                  Slipp kontoutskriften her
                </p>
                <p className="text-xs text-muted-foreground">
                  eller klikk for å velge fil · .csv eller .pdf opptil 10 MB
                </p>
              </div>
            </button>
          )}

          {importError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {importError}
            </p>
          ) : null}
          {categoryError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {categoryError}
            </p>
          ) : null}

          <Button
            onClick={parseCsv}
            disabled={!selectedFile || importLoading}
            className="w-full gap-2"
          >
            {importLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Leser inn…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Les inn og forhåndsvis
              </>
            )}
          </Button>
        </FadeIn>
      </div>
    </div>
  );
}
