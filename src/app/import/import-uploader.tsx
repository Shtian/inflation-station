"use client";

import { useState } from "react";
import { ImportColumnMappingPhase } from "./components/import-column-mapping-phase";
import { ImportReviewPhase } from "./components/import-review-phase";
import { type ImportStep, ImportStepper } from "./components/import-stepper";
import { ImportUploadPhase } from "./components/import-upload-phase";
import { useImportWorkflow } from "./use-import-workflow";

export function ImportUploader() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const {
    accountError,
    activeAccounts,
    categoryDecisions,
    noteDecisions,
    categoryError,
    clearSelectedFile,
    closeMappingStep,
    confirmColumnMapping,
    editColumnMapping,
    fileInputRef,
    hasActiveAccounts,
    importError,
    importLoading,
    isMappingStepOpen,
    mappingDraft,
    mappingDraftSources,
    mappingProposal,
    resolvedMessages,
    noteValidationErrors,
    onFileSelected,
    parseCsv,
    parseResult,
    resetImport,
    retryFailed,
    reviewCategoryOptions,
    selectMessageSource,
    selectedAccountId,
    selectedFile,
    setCategoryDecisions,
    setNoteDecision,
    setSelectedAccountId,
    selectedRowIds,
    submitError,
    submitLoading,
    submitReviewRows,
    toggleAllRows,
    toggleRowSelection,
    updateMappingDraft,
  } = useImportWorkflow();

  const showMapping =
    !importLoading &&
    isMappingStepOpen &&
    mappingProposal !== null &&
    mappingDraft !== null &&
    mappingDraftSources !== null;
  const showReview = !showMapping && (importLoading || parseResult !== null);
  const currentStep: ImportStep = showReview
    ? 4
    : showMapping
      ? 3
      : selectedAccountId
        ? 2
        : 1;
  const selectedAccountName =
    activeAccounts.find((account) => account.id === selectedAccountId)?.name ??
    selectedAccountId;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <h1 className="mb-6 font-semibold text-2xl text-foreground tracking-tight">
        Import
      </h1>

      <ImportStepper currentStep={currentStep} />

      {showMapping ? (
        <ImportColumnMappingPhase
          accountName={selectedAccountName}
          proposal={mappingProposal}
          draft={mappingDraft}
          sources={mappingDraftSources}
          importError={importError}
          importLoading={importLoading}
          onChange={updateMappingDraft}
          onConfirm={() => void confirmColumnMapping()}
          onBack={closeMappingStep}
        />
      ) : showReview ? (
        <ImportReviewPhase
          accountError={accountError}
          activeAccounts={activeAccounts}
          categoryDecisions={categoryDecisions}
          noteDecisions={noteDecisions}
          categoryError={categoryError}
          editColumnMapping={editColumnMapping}
          importError={importError}
          importLoading={importLoading}
          resolvedMessages={resolvedMessages}
          noteValidationErrors={noteValidationErrors}
          parseResult={parseResult}
          resetImport={resetImport}
          retryFailed={retryFailed}
          reviewCategoryOptions={reviewCategoryOptions}
          selectedAccountId={selectedAccountId}
          selectedRowIds={selectedRowIds}
          setCategoryDecisions={setCategoryDecisions}
          selectMessageSource={selectMessageSource}
          setNoteDecision={setNoteDecision}
          submitError={submitError}
          submitLoading={submitLoading}
          submitReviewRows={submitReviewRows}
          toggleAllRows={toggleAllRows}
          toggleRowSelection={toggleRowSelection}
        />
      ) : (
        <ImportUploadPhase
          accountError={accountError}
          activeAccounts={activeAccounts}
          categoryError={categoryError}
          clearSelectedFile={clearSelectedFile}
          fileInputRef={fileInputRef}
          hasActiveAccounts={hasActiveAccounts}
          importError={importError}
          importLoading={importLoading}
          isDraggingOver={isDraggingOver}
          onFileSelected={onFileSelected}
          parseCsv={() => void parseCsv()}
          selectedAccountId={selectedAccountId}
          selectedFile={selectedFile}
          setIsDraggingOver={setIsDraggingOver}
          setSelectedAccountId={setSelectedAccountId}
        />
      )}
    </main>
  );
}
