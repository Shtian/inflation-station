"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { ImportReviewPhase } from "./components/import-review-phase";
import { ImportUploadPhase } from "./components/import-upload-phase";
import { ProviderSelectionDialog } from "./components/provider-selection-dialog";
import { useImportWorkflow } from "./use-import-workflow";

export function ImportUploader() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const {
    accountError,
    activeAccounts,
    allProviders,
    categoryDecisions,
    noteDecisions,
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
    noteValidationErrors,
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
    setNoteDecision,
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
          noteDecisions={noteDecisions}
          categoryError={categoryError}
          importError={importError}
          importLoading={importLoading}
          messageDecisions={messageDecisions}
          noteValidationErrors={noteValidationErrors}
          openProviderDialog={openProviderDialog}
          parseResult={parseResult}
          providerDetection={providerDetection}
          resetImport={resetImport}
          reviewCategoryOptions={reviewCategoryOptions}
          selectedAccountId={selectedAccountId}
          setCategoryDecisions={setCategoryDecisions}
          setMessageDecisions={setMessageDecisions}
          setNoteDecision={setNoteDecision}
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

      <ProviderSelectionDialog
        open={isProviderDialogOpen}
        onOpenChange={setIsProviderDialogOpen}
        providerOptions={dialogProviderOptions}
        selectedProviderId={dialogSelectedProviderId}
        onSelectProvider={setDialogSelectedProviderId}
        onCancel={() => setIsProviderDialogOpen(false)}
        onConfirm={handleProviderConfirm}
      />
    </main>
  );
}
