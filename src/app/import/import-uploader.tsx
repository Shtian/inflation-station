"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ImportReviewPhase } from "./components/import-review-phase";
import { ImportUploadPhase } from "./components/import-upload-phase";
import { useImportWorkflow } from "./use-import-workflow";

export function ImportUploader() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const {
    accountError,
    activeAccounts,
    allProviders,
    categoryDecisions,
    categoryError,
    clearSelectedFile,
    dialogProviderOptions,
    dialogSelectedProviderId,
    fileInputRef,
    hasActiveAccounts,
    importError,
    importLoading,
    isProviderDialogOpen,
    messageDecisions,
    onFileSelected,
    openProviderDialog,
    handleProviderConfirm,
    parseCsv,
    parseResult,
    providerDetection,
    resetImport,
    reviewCategoryOptions,
    selectedAccountId,
    selectedFile,
    setCategoryDecisions,
    setDialogSelectedProviderId,
    setIsProviderDialogOpen,
    setMessageDecisions,
    setSelectedAccountId,
    submitError,
    submitLoading,
    submitNotice,
    submitReviewRows,
  } = useImportWorkflow();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="mb-4 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose an account and CSV file to start the parse and validation flow.
        </p>
      </div>

      <Separator className="my-4" />

      {importLoading || parseResult ? (
        <ImportReviewPhase
          accountError={accountError}
          activeAccounts={activeAccounts}
          categoryDecisions={categoryDecisions}
          categoryError={categoryError}
          importError={importError}
          importLoading={importLoading}
          messageDecisions={messageDecisions}
          openProviderDialog={openProviderDialog}
          parseResult={parseResult}
          providerDetection={providerDetection}
          resetImport={resetImport}
          reviewCategoryOptions={reviewCategoryOptions}
          selectedAccountId={selectedAccountId}
          setCategoryDecisions={setCategoryDecisions}
          setMessageDecisions={setMessageDecisions}
          submitError={submitError}
          submitLoading={submitLoading}
          submitNotice={submitNotice}
          submitReviewRows={submitReviewRows}
        />
      ) : (
        <ImportUploadPhase
          accountError={accountError}
          activeAccounts={activeAccounts}
          allProviders={allProviders}
          categoryError={categoryError}
          clearSelectedFile={clearSelectedFile}
          fileInputRef={fileInputRef}
          hasActiveAccounts={hasActiveAccounts}
          importError={importError}
          importLoading={importLoading}
          isDraggingOver={isDraggingOver}
          onFileSelected={onFileSelected}
          openProviderDialog={openProviderDialog}
          parseCsv={parseCsv}
          providerDetection={providerDetection}
          selectedAccountId={selectedAccountId}
          selectedFile={selectedFile}
          setIsDraggingOver={setIsDraggingOver}
          setSelectedAccountId={setSelectedAccountId}
          submitNotice={submitNotice}
        />
      )}

      <Dialog
        open={isProviderDialogOpen}
        onOpenChange={setIsProviderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select provider</DialogTitle>
            <DialogDescription>
              Choose the provider that matches your CSV file format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dialogProviderOptions.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setDialogSelectedProviderId(provider.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                  dialogSelectedProviderId === provider.id
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    dialogSelectedProviderId === provider.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  )}
                >
                  {dialogSelectedProviderId === provider.id ? (
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  ) : null}
                </div>
                <span className="text-sm font-medium">{provider.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProviderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleProviderConfirm}
              disabled={!dialogSelectedProviderId}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
