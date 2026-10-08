"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveAccountCsvColumnMappingAction } from "@/app/actions/save-account-csv-column-mapping";
import {
  type ColumnMapping,
  type ColumnMappingDraft,
  type ColumnMappingField,
  type ColumnMappingGuess,
  type ColumnMappingSource,
  completeColumnMapping,
} from "@/lib/import/csv/column-mapping";
import type { TokenizedCsvRow } from "@/lib/import/csv/csv-statement";
import type { CleanupPlan } from "@/lib/import/message-cleanup/plan";
import type { CleanupChunkResponse } from "@/lib/import/message-cleanup/wire";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "@/lib/transactions/note";
import type { ReviewRow } from "./import-review-table";
import {
  applyChunkResult,
  type SuggestionsByRowId,
} from "./message-cleanup/apply-chunk-result";
import {
  type CleanupRunController,
  createCleanupRunController,
} from "./message-cleanup/cleanup-run-controller";
import {
  type MessageSource,
  type MessageSuggestion,
  type ResolvedRowMessage,
  resolveRowMessage,
} from "./message-cleanup/resolve-row-message";
import { runCleanupChunks } from "./message-cleanup/run-cleanup-chunks";
import {
  fetchCleanupChunk,
  useMessageCleanupStream,
} from "./message-cleanup/use-message-cleanup-stream";

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

export type Category = {
  id: string;
  name: string;
};

type ImportSummary = {
  imported: number;
  duplicates: number;
  ignoredReserved: number;
  invalid: number;
};

type ImportError = {
  rowNumber: number;
  code: string;
  message: string;
};

/** Only PDF imports report a detected statement issuer. */
type PdfDetection = {
  providerName: string;
};

export type ColumnMappingProposal = {
  headers: string[];
  sampleRows: TokenizedCsvRow[];
  guess: ColumnMappingGuess;
};

/** Where each field's current value came from; "manual" once the user changes it. */
export type ColumnMappingDraftSources = Record<
  ColumnMappingField,
  ColumnMappingSource | "manual"
>;

export type ParseResponse = {
  detection?: PdfDetection;
  columnMapping?: ColumnMappingProposal;
  summary: ImportSummary;
  errors: ImportError[];
  cleanup?: CleanupPlan;
  review?: {
    sessionId: string | null;
    potentialDuplicates: number;
    rows: ReviewRow[];
  };
};

type SubmitResponse = {
  summary: {
    imported: number;
    invalid: number;
  };
};

function getRequestErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const value = (body as { message: unknown }).message;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  if (typeof body === "object" && body && "error" in body) {
    const value = (body as { error: unknown }).error;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "Request failed. Please try again.";
}

function deriveOriginalMessage(row: { name?: string; title?: string }): string {
  if (typeof row.title === "string" && row.title.trim().length > 0) {
    return row.title;
  }

  if (typeof row.name === "string" && row.name.trim().length > 0) {
    return row.name;
  }

  return "No original message";
}

export function useImportWorkflow() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [mappingProposal, setMappingProposal] =
    useState<ColumnMappingProposal | null>(null);
  const [mappingDraft, setMappingDraft] = useState<ColumnMappingDraft | null>(
    null,
  );
  const [mappingDraftSources, setMappingDraftSources] =
    useState<ColumnMappingDraftSources | null>(null);
  const [isMappingStepOpen, setIsMappingStepOpen] = useState(false);
  const [categoryDecisions, setCategoryDecisions] = useState<
    Record<string, string>
  >({});
  const [messageOverrides, setMessageOverrides] = useState<
    Record<string, MessageSource>
  >({});
  const [suggestions, setSuggestions] = useState<SuggestionsByRowId>({});
  const [failedChunkIndexes, setFailedChunkIndexes] = useState<Set<number>>(
    new Set(),
  );
  const [noteDecisions, setNoteDecisions] = useState<Record<string, string>>(
    {},
  );
  const [noteValidationErrors, setNoteValidationErrors] = useState<
    Record<string, string>
  >({});
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cleanupRunControllerRef = useRef<CleanupRunController | null>(null);
  if (!cleanupRunControllerRef.current) {
    cleanupRunControllerRef.current = createCleanupRunController();
  }

  const loadAccounts = useCallback(async () => {
    setAccountError(null);

    const response = await fetch("/api/accounts");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("accounts" in body)
    ) {
      setAccountError("Could not load accounts.");
      setAccounts([]);
      return;
    }

    const nextAccounts = Array.isArray(body.accounts)
      ? (body.accounts as Account[])
      : [];
    setAccounts(nextAccounts);

    setSelectedAccountId((current) => {
      if (current && nextAccounts.some((account) => account.id === current)) {
        return current;
      }

      return "";
    });
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoryError(null);

    const response = await fetch("/api/categories");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("categories" in body)
    ) {
      setCategoryError("Could not load categories for review.");
      setCategories([]);
      return;
    }

    setCategories(
      Array.isArray(body.categories) ? (body.categories as Category[]) : [],
    );
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadCategories();
  }, [loadAccounts, loadCategories]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  const hasActiveAccounts = activeAccounts.length > 0;

  const reviewCategoryOptions = useMemo(() => categories, [categories]);

  const resolvedMessages = useMemo(() => {
    const rows = parseResult?.review?.rows ?? [];
    const cleanupPlanned = parseResult?.cleanup?.status === "planned";
    const defaultSuggestion: MessageSuggestion = cleanupPlanned
      ? { status: "pending" }
      : { status: "none" };

    return rows.reduce<Record<string, ResolvedRowMessage>>((acc, row) => {
      acc[row.id] = resolveRowMessage({
        originalMessage: deriveOriginalMessage(row),
        suggestion: suggestions[row.id] ?? defaultSuggestion,
        override: messageOverrides[row.id],
      });
      return acc;
    }, {});
  }, [parseResult, suggestions, messageOverrides]);

  const onChunkResult = useCallback(
    (rowIds: string[], result: CleanupChunkResponse) => {
      setSuggestions((current) => applyChunkResult(current, rowIds, result));
      setFailedChunkIndexes((current) => {
        const next = new Set(current);
        if (result.status === "failed") {
          next.add(result.index);
        } else {
          next.delete(result.index);
        }
        return next;
      });
    },
    [],
  );

  useMessageCleanupStream(
    parseResult?.cleanup ?? null,
    onChunkResult,
    cleanupRunControllerRef.current,
  );

  const retryFailed = useCallback(() => {
    const plan = parseResult?.cleanup;
    if (!plan || plan.status !== "planned" || failedChunkIndexes.size === 0) {
      return;
    }

    const retryChunks = plan.chunks.filter((chunk) =>
      failedChunkIndexes.has(chunk.index),
    );
    if (retryChunks.length === 0) {
      return;
    }

    const signal = cleanupRunControllerRef.current?.start();
    void runCleanupChunks({
      plan: {
        status: "planned",
        sessionId: plan.sessionId,
        chunks: retryChunks,
      },
      fetchChunk: fetchCleanupChunk,
      onChunkResult,
      signal,
    });
  }, [parseResult, failedChunkIndexes, onChunkResult]);

  const cancelCleanup = useCallback(() => {
    cleanupRunControllerRef.current?.cancel();
  }, []);

  const selectMessageSource = useCallback(
    (rowId: string, source: MessageSource) => {
      setMessageOverrides((current) => ({ ...current, [rowId]: source }));
    },
    [],
  );

  const resetReviewState = useCallback(() => {
    cancelCleanup();
    setParseResult(null);
    setCategoryDecisions({});
    setMessageOverrides({});
    setSuggestions({});
    setFailedChunkIndexes(new Set());
    setNoteDecisions({});
    setNoteValidationErrors({});
    setSelectedRowIds(new Set());
    setMappingProposal(null);
    setMappingDraft(null);
    setMappingDraftSources(null);
    setIsMappingStepOpen(false);
    setImportError(null);
  }, [cancelCleanup]);

  const onFileSelected = useCallback(
    (file: File | null) => {
      setSelectedFile(file);
      resetReviewState();
    },
    [resetReviewState],
  );

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const openMappingStep = useCallback((proposal: ColumnMappingProposal) => {
    setMappingProposal(proposal);
    setMappingDraft(proposal.guess.mapping);
    setMappingDraftSources(proposal.guess.sources);
    setIsMappingStepOpen(true);
  }, []);

  const updateMappingDraft = useCallback(
    (field: ColumnMappingField, next: ColumnMappingDraft) => {
      setMappingDraft(next);
      setMappingDraftSources((current) =>
        current ? { ...current, [field]: "manual" } : current,
      );
    },
    [],
  );

  const parseCsv = useCallback(
    async (columnMapping?: ColumnMapping) => {
      if (!selectedAccountId) {
        setImportError("Select an account before parsing.");
        return;
      }

      if (!selectedFile) {
        setImportError("Choose a statement file to parse.");
        return;
      }

      setImportLoading(true);
      setImportError(null);
      setSubmitError(null);
      setParseResult(null);
      setCategoryDecisions({});
      setMessageOverrides({});
      setSuggestions({});
      setFailedChunkIndexes(new Set());
      setNoteDecisions({});
      setNoteValidationErrors({});

      const formData = new FormData();
      formData.set("accountId", selectedAccountId);
      formData.set("file", selectedFile);
      if (columnMapping) {
        formData.set("columnMapping", JSON.stringify(columnMapping));
      }

      const response = await fetch("/api/imports/parse", {
        method: "POST",
        body: formData,
      });

      const body = await response.json().catch(() => null);

      if (
        response.ok &&
        body &&
        typeof body === "object" &&
        "mappingRequired" in body &&
        "columnMapping" in body
      ) {
        openMappingStep(
          (body as { columnMapping: ColumnMappingProposal }).columnMapping,
        );
        setImportLoading(false);
        return;
      }

      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("summary" in body)
      ) {
        setImportError(getRequestErrorMessage(body));
        setImportLoading(false);
        return;
      }

      const parseResponse = body as ParseResponse;
      setParseResult(parseResponse);
      setIsMappingStepOpen(false);
      setMappingProposal(parseResponse.columnMapping ?? null);

      const reviewRows = Array.isArray(parseResponse.review?.rows)
        ? parseResponse.review.rows
        : [];

      setCategoryDecisions(
        reviewRows.reduce<Record<string, string>>((acc, row) => {
          if (row.categoryId) {
            acc[row.id] = row.categoryId;
          }
          return acc;
        }, {}),
      );

      setNoteDecisions({});
      setNoteValidationErrors({});
      setSelectedRowIds(new Set(reviewRows.map((row) => row.id)));

      setImportLoading(false);
    },
    [selectedAccountId, selectedFile, openMappingStep],
  );

  const confirmColumnMapping = useCallback(async () => {
    const mapping = mappingDraft ? completeColumnMapping(mappingDraft) : null;
    if (!mapping || !mappingProposal) {
      setImportError(
        "Choose a date column, an amount and at least one description column.",
      );
      return;
    }

    setImportLoading(true);
    let saveError: string | null = null;
    try {
      const saved = await saveAccountCsvColumnMappingAction({
        accountId: selectedAccountId,
        headers: mappingProposal.headers,
        mapping,
      });
      saveError = saved.ok ? null : saved.error.message;
    } catch {
      saveError = "Could not save the column mapping for this account.";
    }

    // Remembering the mapping is a convenience for the next import; failing to
    // save it must not block this one.
    if (saveError) {
      toast.warning(`Column mapping not saved for next time. ${saveError}`);
    }

    await parseCsv(mapping);
  }, [mappingDraft, mappingProposal, selectedAccountId, parseCsv]);

  const editColumnMapping = useCallback(() => {
    if (parseResult?.columnMapping) {
      openMappingStep(parseResult.columnMapping);
    }
  }, [parseResult, openMappingStep]);

  const closeMappingStep = useCallback(() => {
    setIsMappingStepOpen(false);
    setImportError(null);
    if (!parseResult) {
      setMappingProposal(null);
      setMappingDraft(null);
      setMappingDraftSources(null);
    }
  }, [parseResult]);

  const resetImport = useCallback(() => {
    cancelCleanup();
    setParseResult(null);
    setMappingProposal(null);
    setMappingDraft(null);
    setMappingDraftSources(null);
    setIsMappingStepOpen(false);
    setCategoryDecisions({});
    setMessageOverrides({});
    setSuggestions({});
    setFailedChunkIndexes(new Set());
    setNoteDecisions({});
    setNoteValidationErrors({});
    setSelectedRowIds(new Set());
    setImportError(null);
    setSubmitError(null);
  }, [cancelCleanup]);

  const setNoteDecision = useCallback((rowId: string, note: string) => {
    setNoteDecisions((current) => ({
      ...current,
      [rowId]: note,
    }));
    setNoteValidationErrors((current) => {
      if (!(rowId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }, []);

  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const toggleAllRows = useCallback((rowIds: string[]) => {
    setSelectedRowIds((current) =>
      current.size === rowIds.length ? new Set() : new Set(rowIds),
    );
  }, []);

  const submitReviewRows = useCallback(async () => {
    if (!parseResult?.review?.sessionId) {
      setSubmitError("No review session is available to submit.");
      return;
    }

    const rows = parseResult.review.rows
      .filter((row) => selectedRowIds.has(row.id))
      .map((row) => ({
        selectedMessage:
          resolvedMessages[row.id]?.display ?? deriveOriginalMessage(row),
        rowId: row.id,
        categoryId: (categoryDecisions[row.id] ?? row.categoryId) || null,
        note: noteDecisions[row.id] ?? null,
      }));

    const rowNoteErrors = rows.reduce<Record<string, string>>((acc, row) => {
      if (
        typeof row.note === "string" &&
        row.note.length > MAX_TRANSACTION_NOTE_LENGTH
      ) {
        acc[row.rowId] = MAX_TRANSACTION_NOTE_LENGTH_MESSAGE;
      }
      return acc;
    }, {});

    if (Object.keys(rowNoteErrors).length > 0) {
      setNoteValidationErrors(rowNoteErrors);
      setSubmitError("Fix note validation errors before confirming import.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setNoteValidationErrors({});

    cancelCleanup();

    const response = await fetch("/api/imports/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessionId: parseResult.review.sessionId,
        rows,
      }),
    });

    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("summary" in body)
    ) {
      setSubmitError(getRequestErrorMessage(body));
      setSubmitLoading(false);
      return;
    }

    const submitResult = body as SubmitResponse;
    toast.success(
      `Import complete. Imported ${submitResult.summary.imported}, invalid ${submitResult.summary.invalid}.`,
    );
    setParseResult(null);
    setCategoryDecisions({});
    setMessageOverrides({});
    setSuggestions({});
    setFailedChunkIndexes(new Set());
    setNoteDecisions({});
    setNoteValidationErrors({});
    setMappingProposal(null);
    setMappingDraft(null);
    setMappingDraftSources(null);
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSubmitLoading(false);
  }, [
    parseResult,
    resolvedMessages,
    categoryDecisions,
    noteDecisions,
    selectedRowIds,
    cancelCleanup,
  ]);

  return {
    accountError,
    activeAccounts,
    categoryDecisions,
    categoryError,
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
    messageOverrides,
    noteValidationErrors,
    noteDecisions,
    onFileSelected,
    clearSelectedFile,
    parseCsv,
    parseResult,
    resetImport,
    resolvedMessages,
    retryFailed,
    reviewCategoryOptions,
    selectMessageSource,
    selectedAccountId,
    selectedFile,
    selectedRowIds,
    setCategoryDecisions,
    setNoteDecision,
    setNoteDecisions,
    setSelectedAccountId,
    toggleAllRows,
    toggleRowSelection,
    updateMappingDraft,
    submitError,
    submitLoading,
    submitReviewRows,
  };
}
