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
  const [newCategoryScope, setNewCategoryScope] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editCategoryName, setEditCategoryName] = useState("");

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
      setError("Could not load category management data.");
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
      setError("Category name is required.");
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
        accountId: newCategoryScope || null,
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
    setNewCategoryScope("");
    setBusyKey(null);
    toast.success("Category added.");
    await loadData();
  }

  async function deleteCategory(categoryId: string) {
    if (!window.confirm("Delete this category?")) {
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
    toast.success("Category removed.");
    await loadData();
  }

  function startRenameCategory(category: Category) {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setError(null);
  }

  function cancelRenameCategory() {
    setEditingCategoryId(null);
    setEditCategoryName("");
  }

  async function renameCategory(categoryId: string) {
    if (!editCategoryName.trim()) {
      setError("Category name is required.");
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
    toast.success("Category renamed.");
    await loadData();
  }

  async function createRule() {
    if (!ruleCategoryId) {
      setError("Select a category for the rule.");
      return;
    }

    if (!ruleMerchantContains.trim()) {
      setError("Merchant contains is required.");
      return;
    }

    const parsedPriority = Number.parseInt(rulePriority, 10);
    if (!Number.isInteger(parsedPriority)) {
      setError("Priority must be an integer.");
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
    toast.success("Category rule added.");
    await loadData();
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm("Delete this category rule?")) {
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
    toast.success("Category rule removed.");
    await loadData();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Categories
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage categories and deterministic rules used in imports and review.
        </p>
      </div>

      <p className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-muted-foreground text-sm">
        Transfer-category transactions are excluded from spend and income
        analytics.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {error}
        </p>
      ) : null}

      <Tabs defaultValue="category-management" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="category-management">
            Category management
          </TabsTrigger>
          <TabsTrigger value="category-rules">Category rules</TabsTrigger>
        </TabsList>

        <TabsContent value="category-management">
          <CategoryManagementSection
            accounts={accounts}
            categories={categories}
            loading={loading}
            busyKey={busyKey}
            newCategoryName={newCategoryName}
            newCategoryKind={newCategoryKind}
            newCategoryScope={newCategoryScope}
            onNewCategoryNameChange={setNewCategoryName}
            onNewCategoryKindChange={setNewCategoryKind}
            onNewCategoryScopeChange={setNewCategoryScope}
            editingCategoryId={editingCategoryId}
            editCategoryName={editCategoryName}
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
