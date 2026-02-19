"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "@/lib/transactions/note";
import type { MessageSource, ReviewRow } from "./import-review-table";
import {
  MESSAGE_SOURCE_CLEANED,
  MESSAGE_SOURCE_ORIGINAL,
} from "./import-review-table";

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

export type Category = {
  id: string;
  name: string;
  accountId: string | null;
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

type ProviderDetectionState = "certain" | "uncertain" | "missing";

export type ProviderDetection = {
  state: ProviderDetectionState;
  providerId: string | null;
  providerName: string | null;
  score: number;
  matchedHeaders: string[];
  candidates: Array<{
    providerId: string;
    providerName: string;
    requiredMatches: number;
    requiredTotal: number;
    patternMatches: number;
    score: number;
  }>;
};

export type ParseResponse = {
  detection: ProviderDetection;
  summary: ImportSummary;
  errors: ImportError[];
  review?: {
    sessionId: string | null;
    potentialDuplicates: number;
    messageCleanupUnavailableReason:
      | "disabled"
      | "key_missing"
      | "timeout"
      | "provider_error"
      | null;
    rows: ReviewRow[];
  };
};

type SubmitResponse = {
  summary: {
    imported: number;
    potentialDuplicates: number;
    invalid: number;
    skipped: number;
  };
};

const AUTO_PROVIDER_SELECT_VALUE = "__auto_provider__";

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
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [providerDetection, setProviderDetection] =
    useState<ProviderDetection | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState(
    AUTO_PROVIDER_SELECT_VALUE,
  );
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [dialogSelectedProviderId, setDialogSelectedProviderId] = useState("");
  const [allProviders, setAllProviders] = useState<
    { id: string; name: string }[]
  >([]);
  const [categoryDecisions, setCategoryDecisions] = useState<
    Record<string, string>
  >({});
  const [messageDecisions, setMessageDecisions] = useState<
    Record<string, MessageSource>
  >({});
  const [noteDecisions, setNoteDecisions] = useState<Record<string, string>>(
    {},
  );
  const [noteValidationErrors, setNoteValidationErrors] = useState<
    Record<string, string>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

      return nextAccounts[0]?.id ?? "";
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

  const loadAllProviders = useCallback(async () => {
    if (allProviders.length > 0) {
      return;
    }

    const response = await fetch("/api/import-provider-mappings");
    const body = await response.json().catch(() => null);

    if (
      body &&
      typeof body === "object" &&
      "mappings" in body &&
      Array.isArray(body.mappings)
    ) {
      setAllProviders(
        (body.mappings as Array<{ id: string; providerName: string }>).map(
          (mapping) => ({ id: mapping.id, name: mapping.providerName }),
        ),
      );
    }
  }, [allProviders.length]);

  useEffect(() => {
    void loadAccounts();
    void loadCategories();
    void loadAllProviders();
  }, [loadAccounts, loadCategories, loadAllProviders]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  const hasActiveAccounts = activeAccounts.length > 0;

  const reviewCategoryOptions = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.accountId === null ||
          category.accountId === selectedAccountId,
      ),
    [categories, selectedAccountId],
  );

  const dialogProviderOptions = useMemo(() => {
    if (
      providerDetection?.candidates &&
      providerDetection.candidates.length > 0
    ) {
      return providerDetection.candidates.map((candidate) => ({
        id: candidate.providerId,
        name: candidate.providerName,
      }));
    }

    return allProviders;
  }, [providerDetection, allProviders]);

  const resetReviewState = useCallback(() => {
    setParseResult(null);
    setCategoryDecisions({});
    setMessageDecisions({});
    setNoteDecisions({});
    setNoteValidationErrors({});
    setProviderDetection(null);
    setSelectedProviderId(AUTO_PROVIDER_SELECT_VALUE);
    setImportError(null);
  }, []);

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

  const openProviderDialog = useCallback(() => {
    const currentId =
      selectedProviderId !== AUTO_PROVIDER_SELECT_VALUE
        ? selectedProviderId
        : (providerDetection?.providerId ?? "");

    setDialogSelectedProviderId(currentId);
    if ((providerDetection?.candidates ?? []).length === 0) {
      void loadAllProviders();
    }
    setIsProviderDialogOpen(true);
  }, [selectedProviderId, providerDetection, loadAllProviders]);

  const handleProviderConfirm = useCallback(() => {
    if (!dialogSelectedProviderId) {
      setIsProviderDialogOpen(false);
      return;
    }

    const chosen = dialogProviderOptions.find(
      (provider) => provider.id === dialogSelectedProviderId,
    );

    if (chosen) {
      setSelectedProviderId(chosen.id);
      if (providerDetection) {
        setProviderDetection({
          ...providerDetection,
          state: "certain",
          providerId: chosen.id,
          providerName: chosen.name,
        });
      }
    }

    setIsProviderDialogOpen(false);
  }, [dialogProviderOptions, dialogSelectedProviderId, providerDetection]);

  const parseCsv = useCallback(async () => {
    if (!selectedAccountId) {
      setImportError("Select an account before parsing.");
      return;
    }

    if (!selectedFile) {
      setImportError("Choose a CSV file to parse.");
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setSubmitError(null);
    setSubmitNotice(null);
    setParseResult(null);
    setCategoryDecisions({});
    setMessageDecisions({});
    setNoteDecisions({});
    setNoteValidationErrors({});

    const formData = new FormData();
    formData.set("accountId", selectedAccountId);
    formData.set("file", selectedFile);
    if (selectedProviderId !== AUTO_PROVIDER_SELECT_VALUE) {
      formData.set("providerId", selectedProviderId);
    }

    const response = await fetch("/api/imports/parse", {
      method: "POST",
      body: formData,
    });

    const body = await response.json().catch(() => null);

    if (
      response.status === 409 &&
      body &&
      typeof body === "object" &&
      "error" in body &&
      (body as { error: unknown }).error === "PROVIDER_SELECTION_REQUIRED"
    ) {
      const detection =
        "detection" in body
          ? ((body as { detection: ProviderDetection }).detection ?? null)
          : null;
      setProviderDetection(detection);
      setImportError(getRequestErrorMessage(body));
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
    setProviderDetection(parseResponse.detection);

    if (parseResponse.detection.providerId) {
      setSelectedProviderId(parseResponse.detection.providerId);
    }

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

    setMessageDecisions(
      reviewRows.reduce<Record<string, MessageSource>>((acc, row) => {
        acc[row.id] =
          typeof row.cleanedMessage === "string" &&
          row.cleanedMessage.length > 0
            ? MESSAGE_SOURCE_CLEANED
            : MESSAGE_SOURCE_ORIGINAL;
        return acc;
      }, {}),
    );

    setNoteDecisions({});
    setNoteValidationErrors({});

    setImportLoading(false);
  }, [selectedAccountId, selectedFile, selectedProviderId]);

  const resetImport = useCallback(() => {
    setParseResult(null);
    setProviderDetection(null);
    setSelectedProviderId(AUTO_PROVIDER_SELECT_VALUE);
    setCategoryDecisions({});
    setMessageDecisions({});
    setNoteDecisions({});
    setNoteValidationErrors({});
    setImportError(null);
    setSubmitError(null);
    setSubmitNotice(null);
  }, []);

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

  const submitReviewRows = useCallback(async () => {
    if (!parseResult?.review?.sessionId) {
      setSubmitError("No review session is available to submit.");
      return;
    }

    const rows = parseResult.review.rows.map((row) => ({
      selectedMessage:
        messageDecisions[row.id] === MESSAGE_SOURCE_CLEANED &&
        typeof row.cleanedMessage === "string" &&
        row.cleanedMessage.trim().length > 0
          ? row.cleanedMessage
          : row.title,
      rowId: row.id,
      categoryId: categoryDecisions[row.id] ?? row.categoryId,
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
    setSubmitNotice(null);
    setNoteValidationErrors({});

    const response = await fetch("/api/imports/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessionId: parseResult.review.sessionId,
        invalidCount: parseResult.summary.invalid,
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
    setSubmitNotice(
      `Import complete. Imported ${submitResult.summary.imported}, skipped ${submitResult.summary.skipped}, potential duplicates ${submitResult.summary.potentialDuplicates}, invalid ${submitResult.summary.invalid}.`,
    );
    setParseResult(null);
    setCategoryDecisions({});
    setMessageDecisions({});
    setNoteDecisions({});
    setNoteValidationErrors({});
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSubmitLoading(false);
  }, [parseResult, messageDecisions, categoryDecisions, noteDecisions]);

  return {
    accountError,
    activeAccounts,
    allProviders,
    categoryDecisions,
    categoryError,
    dialogProviderOptions,
    dialogSelectedProviderId,
    fileInputRef,
    hasActiveAccounts,
    importError,
    importLoading,
    isProviderDialogOpen,
    messageDecisions,
    noteValidationErrors,
    noteDecisions,
    onFileSelected,
    clearSelectedFile,
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
    setNoteDecisions,
    setSelectedAccountId,
    submitError,
    submitLoading,
    submitNotice,
    submitReviewRows,
  };
}
