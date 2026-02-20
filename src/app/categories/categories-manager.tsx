"use client";

import type { CategoryKind } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
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
  const [notice, setNotice] = useState<string | null>(null);
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
      setNotice(null);
      return;
    }

    setBusyKey("new-category");
    setError(null);
    setNotice(null);

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
    setNotice("Category added.");
    await loadData();
  }

  async function deleteCategory(categoryId: string) {
    if (!window.confirm("Delete this category?")) {
      return;
    }

    setBusyKey(`delete-category-${categoryId}`);
    setError(null);
    setNotice(null);

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
    setNotice("Category removed.");
    await loadData();
  }

  function startRenameCategory(category: Category) {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setError(null);
    setNotice(null);
  }

  function cancelRenameCategory() {
    setEditingCategoryId(null);
    setEditCategoryName("");
  }

  async function renameCategory(categoryId: string) {
    if (!editCategoryName.trim()) {
      setError("Category name is required.");
      setNotice(null);
      return;
    }

    setBusyKey(`rename-category-${categoryId}`);
    setError(null);
    setNotice(null);

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
    setNotice("Category renamed.");
    await loadData();
  }

  async function createRule() {
    if (!ruleCategoryId) {
      setError("Select a category for the rule.");
      setNotice(null);
      return;
    }

    if (!ruleMerchantContains.trim()) {
      setError("Merchant contains is required.");
      setNotice(null);
      return;
    }

    const parsedPriority = Number.parseInt(rulePriority, 10);
    if (!Number.isInteger(parsedPriority)) {
      setError("Priority must be an integer.");
      setNotice(null);
      return;
    }

    setBusyKey("new-rule");
    setError(null);
    setNotice(null);

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
    setNotice("Category rule added.");
    await loadData();
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm("Delete this category rule?")) {
      return;
    }

    setBusyKey(`delete-rule-${ruleId}`);
    setError(null);
    setNotice(null);

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
    setNotice("Category rule removed.");
    await loadData();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Categories
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage categories and deterministic rules used in imports and review.
        </p>
      </div>

      <Separator className="my-4" />

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

      <Separator className="my-4" />

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

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
