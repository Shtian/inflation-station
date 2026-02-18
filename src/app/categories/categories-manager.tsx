"use client";

import type { CategoryKind } from "@prisma/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Account,
  Category,
  CategoryRule,
} from "./categories-manager.types";
import {
  ANY_PAYMENT_TYPE_VALUE,
  GLOBAL_SCOPE_VALUE,
  getCategoryMutationErrorMessage,
  getScopeLabel,
} from "./categories-manager.utils";
import { CategoryManagementSection } from "./components/category-management-section";

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
        onCreateCategory={createCategory}
        onDeleteCategory={deleteCategory}
      />

      <Separator className="my-4" />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Category Rules
          </h3>
          <p className="text-sm text-muted-foreground">
            Define deterministic category suggestions by merchant text and
            optional payment type.
          </p>
        </div>

        <div className="grid gap-3">
          <label
            htmlFor="rule-category"
            className="text-sm font-medium text-foreground"
          >
            Category
          </label>
          <Select
            value={ruleCategoryId}
            onValueChange={setRuleCategoryId}
            disabled={categories.length === 0}
          >
            <SelectTrigger id="rule-category" className="w-full">
              <SelectValue
                placeholder={
                  categories.length === 0
                    ? "No categories available"
                    : "Select category"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label
            htmlFor="rule-merchant"
            className="text-sm font-medium text-foreground"
          >
            Merchant contains
          </label>
          <Input
            id="rule-merchant"
            value={ruleMerchantContains}
            onChange={(event) => setRuleMerchantContains(event.target.value)}
            placeholder="joker"
          />

          <label
            htmlFor="rule-payment-type"
            className="text-sm font-medium text-foreground"
          >
            Payment type (optional)
          </label>
          <Select
            value={rulePaymentType || ANY_PAYMENT_TYPE_VALUE}
            onValueChange={(value) =>
              setRulePaymentType(value === ANY_PAYMENT_TYPE_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="rule-payment-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_PAYMENT_TYPE_VALUE}>Any</SelectItem>
              <SelectItem value="CARD">CARD</SelectItem>
              <SelectItem value="TRANSFER">TRANSFER</SelectItem>
              <SelectItem value="EFT">EFT</SelectItem>
              <SelectItem value="CASH">CASH</SelectItem>
              <SelectItem value="OTHER">OTHER</SelectItem>
            </SelectContent>
          </Select>

          <label
            htmlFor="rule-priority"
            className="text-sm font-medium text-foreground"
          >
            Priority
          </label>
          <Input
            id="rule-priority"
            type="number"
            value={rulePriority}
            onChange={(event) => setRulePriority(event.target.value)}
            min={0}
          />

          <label
            htmlFor="rule-scope"
            className="text-sm font-medium text-foreground"
          >
            Scope
          </label>
          <Select
            value={ruleScope || GLOBAL_SCOPE_VALUE}
            onValueChange={(value) =>
              setRuleScope(value === GLOBAL_SCOPE_VALUE ? "" : value)
            }
          >
            <SelectTrigger id="rule-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GLOBAL_SCOPE_VALUE}>Global</SelectItem>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={createRule}
            disabled={busyKey === "new-rule"}
            className="gap-2"
          >
            {busyKey === "new-rule" ? (
              "Saving..."
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add rule
              </>
            )}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant contains</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payment type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>Loading category rules...</TableCell>
                </TableRow>
              ) : null}
              {!loading && categoryRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>No category rules yet.</TableCell>
                </TableRow>
              ) : null}
              {!loading
                ? categoryRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{rule.merchantContains}</TableCell>
                      <TableCell>
                        <CategoryBadge label={rule.category.name} />
                      </TableCell>
                      <TableCell>{rule.paymentType ?? "ANY"}</TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        {getScopeLabel(rule.accountId, accounts)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          onClick={() => deleteRule(rule.id)}
                          disabled={
                            busyKey !== null &&
                            busyKey !== `delete-rule-${rule.id}`
                          }
                          className="h-8 w-8 px-0"
                          aria-label={`Delete rule for ${rule.merchantContains}`}
                          title={`Delete rule for ${rule.merchantContains}`}
                        >
                          {busyKey === `delete-rule-${rule.id}` ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </div>
      </section>

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
