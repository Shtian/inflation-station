"use client";

import type { CategoryKind } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Account,
  Category,
  CategoryRule,
} from "./categories-manager.types";
import { getCategoryMutationErrorMessage } from "./categories-manager.utils";
import { CategoryManagementSection } from "./components/category-management-section";
import {
  type HintDraft,
  type HintDraftAction,
  hintDraftPayload,
  openHintDraft,
  reduceHintDraft,
} from "./components/hint-editor/hint-draft";
import { RulesManagementSection } from "./components/rules-management-section";

export function CategoriesManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] =
    useState<CategoryKind>("EXPENSE");
  const [newCategoryClassifierHint, setNewCategoryClassifierHint] =
    useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editCategoryName, setEditCategoryName] = useState("");
  const [hintDraft, setHintDraft] = useState<HintDraft | null>(null);
  const dispatchHint = useCallback((action: HintDraftAction) => {
    setHintDraft((draft) => draft && reduceHintDraft(draft, action));
  }, []);

  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleMerchantContains, setRuleMerchantContains] = useState("");
  const [rulePaymentType, setRulePaymentType] = useState("");
  const [rulePriority, setRulePriority] = useState("100");
  const [ruleScope, setRuleScope] = useState("");

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [accountsResponse, categoriesResponse, rulesResponse] =
      await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
        fetch("/api/category-rules"),
      ]);

    const accountsBody = await accountsResponse.json().catch(() => null);
    const categoriesBody = await categoriesResponse.json().catch(() => null);
    const rulesBody = await rulesResponse.json().catch(() => null);

    if (
      !accountsResponse.ok ||
      !accountsBody ||
      typeof accountsBody !== "object" ||
      !("accounts" in accountsBody) ||
      !categoriesResponse.ok ||
      !categoriesBody ||
      typeof categoriesBody !== "object" ||
      !("categories" in categoriesBody) ||
      !rulesResponse.ok ||
      !rulesBody ||
      typeof rulesBody !== "object" ||
      !("rules" in rulesBody)
    ) {
      setError("Kunne ikke laste inn kategoridata.");
      setAccounts([]);
      setCategories([]);
      setCategoryRules([]);
      setLoading(false);
      return;
    }

    const nextAccounts = Array.isArray(accountsBody.accounts)
      ? (accountsBody.accounts as Account[])
      : [];
    const nextCategories = Array.isArray(categoriesBody.categories)
      ? (categoriesBody.categories as Category[])
      : [];
    const nextRules = Array.isArray(rulesBody.rules)
      ? (rulesBody.rules as CategoryRule[])
      : [];

    setAccounts(nextAccounts);
    setCategories(nextCategories);
    setCategoryRules(nextRules);
    setRuleCategoryId((current) => {
      if (
        current &&
        nextCategories.some((category) => category.id === current)
      ) {
        return current;
      }

      return nextCategories[0]?.id ?? "";
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createCategory() {
    if (!newCategoryName.trim()) {
      setError("Kategorinavn er påkrevd.");
      return;
    }

    setBusyKey("new-category");
    setError(null);

    const response = await fetch("/api/categories", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: newCategoryName.trim(),
        kind: newCategoryKind,
        classifierHint: newCategoryClassifierHint.trim() || null,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(getCategoryMutationErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setNewCategoryName("");
    setNewCategoryKind("EXPENSE");
    setNewCategoryClassifierHint("");
    setBusyKey(null);
    toast.success("Kategori lagt til.");
    await loadData();
  }

  async function deleteCategory(categoryId: string) {
    if (!window.confirm("Vil du slette denne kategorien?")) {
      return;
    }

    setBusyKey(`delete-category-${categoryId}`);
    setError(null);

    const response = await fetch(`/api/categories/${categoryId}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => null);

    if (!response.ok && response.status !== 204) {
      setError(getCategoryMutationErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setBusyKey(null);
    toast.success("Kategori fjernet.");
    await loadData();
  }

  function startRenameCategory(category: Category) {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setHintDraft(openHintDraft(category));
    setError(null);
  }

  function cancelRenameCategory() {
    setEditingCategoryId(null);
    setEditCategoryName("");
    setHintDraft(null);
  }

  async function renameCategory(categoryId: string) {
    if (!editCategoryName.trim()) {
      setError("Kategorinavn er påkrevd.");
      return;
    }

    setBusyKey(`rename-category-${categoryId}`);
    setError(null);

    const response = await fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: editCategoryName.trim(),
        classifierHint: hintDraft ? hintDraftPayload(hintDraft) : undefined,
      }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(getCategoryMutationErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setBusyKey(null);
    cancelRenameCategory();
    toast.success("Kategori oppdatert.");
    await loadData();
  }

  async function createRule() {
    if (!ruleCategoryId) {
      setError("Velg en kategori for regelen.");
      return;
    }

    if (!ruleMerchantContains.trim()) {
      setError("Brukersted inneholder er påkrevd.");
      return;
    }

    const parsedPriority = Number.parseInt(rulePriority, 10);
    if (!Number.isInteger(parsedPriority)) {
      setError("Prioritet må være et heltall.");
      return;
    }

    setBusyKey("new-rule");
    setError(null);

    const response = await fetch("/api/category-rules", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        categoryId: ruleCategoryId,
        merchantContains: ruleMerchantContains.trim(),
        paymentType: rulePaymentType || null,
        priority: parsedPriority,
        accountId: ruleScope || null,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(getCategoryMutationErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setRuleMerchantContains("");
    setRulePaymentType("");
    setRulePriority("100");
    setRuleScope("");
    setBusyKey(null);
    toast.success("Kategoriregel lagt til.");
    await loadData();
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm("Vil du slette denne kategoriregelen?")) {
      return;
    }

    setBusyKey(`delete-rule-${ruleId}`);
    setError(null);

    const response = await fetch(`/api/category-rules/${ruleId}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => null);

    if (!response.ok && response.status !== 204) {
      setError(getCategoryMutationErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setBusyKey(null);
    toast.success("Kategoriregel fjernet.");
    await loadData();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Kategorier
        </h1>
        <p className="text-sm text-muted-foreground">
          Administrer kategorier og faste regler som brukes ved import og
          gjennomgang.
        </p>
      </div>

      <p className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-muted-foreground">
        Transaksjoner i overføringskategorier holdes utenfor analyser av forbruk
        og inntekt.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Tabs defaultValue="category-management" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="category-management">
            Kategoriadministrasjon
          </TabsTrigger>
          <TabsTrigger value="category-rules">Kategoriregler</TabsTrigger>
        </TabsList>

        <TabsContent value="category-management">
          <CategoryManagementSection
            categories={categories}
            loading={loading}
            busyKey={busyKey}
            newCategoryName={newCategoryName}
            newCategoryKind={newCategoryKind}
            newCategoryClassifierHint={newCategoryClassifierHint}
            onNewCategoryNameChange={setNewCategoryName}
            onNewCategoryKindChange={setNewCategoryKind}
            onNewCategoryClassifierHintChange={setNewCategoryClassifierHint}
            editingCategoryId={editingCategoryId}
            editCategoryName={editCategoryName}
            hintDraft={hintDraft}
            onHintAction={dispatchHint}
            onCreateCategory={createCategory}
            onDeleteCategory={deleteCategory}
            onStartRenameCategory={startRenameCategory}
            onCancelRenameCategory={cancelRenameCategory}
            onEditCategoryNameChange={setEditCategoryName}
            onRenameCategory={renameCategory}
          />
        </TabsContent>

        <TabsContent value="category-rules">
          <RulesManagementSection
            accounts={accounts}
            activeAccounts={activeAccounts}
            categories={categories}
            categoryRules={categoryRules}
            loading={loading}
            busyKey={busyKey}
            ruleCategoryId={ruleCategoryId}
            ruleMerchantContains={ruleMerchantContains}
            rulePaymentType={rulePaymentType}
            rulePriority={rulePriority}
            ruleScope={ruleScope}
            onRuleCategoryIdChange={setRuleCategoryId}
            onRuleMerchantContainsChange={setRuleMerchantContains}
            onRulePaymentTypeChange={setRulePaymentType}
            onRulePriorityChange={setRulePriority}
            onRuleScopeChange={setRuleScope}
            onCreateRule={createRule}
            onDeleteRule={deleteRule}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
