"use client";

import type { CategoryKind, PaymentType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";

type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  accountId: string | null;
};

type CategoryRule = {
  id: string;
  accountId: string | null;
  categoryId: string;
  merchantContains: string;
  paymentType: PaymentType | null;
  priority: number;
  category: {
    id: string;
    name: string;
  };
};

function getErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);

    if (status === 404 && code === "CATEGORY_NOT_FOUND") {
      return "Selected category was not found.";
    }

    if (status === 404 && code === "CATEGORY_RULE_NOT_FOUND") {
      return "Selected category rule was not found.";
    }

    if (status === 409 && code === "CATEGORY_NAME_MUST_BE_UNIQUE") {
      return "A category with this name already exists for this scope.";
    }

    if (status === 400 && code === "INVALID_CATEGORY_PAYLOAD") {
      return "Invalid category payload.";
    }

    if (status === 400 && code === "INVALID_CATEGORY_RULE_PAYLOAD") {
      return "Invalid category rule payload.";
    }

    if (status === 404 && code === "CATEGORY_OR_ACCOUNT_NOT_FOUND") {
      return "Selected category or account was not found.";
    }
  }

  return "Request failed. Please try again.";
}

function getScopeLabel(accountId: string | null, accounts: Account[]) {
  if (!accountId) {
    return "Global";
  }

  return (
    accounts.find((account) => account.id === accountId)?.name ?? "Unknown"
  );
}

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
      setError(getErrorMessage(response.status, body));
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
      setError(getErrorMessage(response.status, body));
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
      setError(getErrorMessage(response.status, body));
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
      setError(getErrorMessage(response.status, body));
      setBusyKey(null);
      return;
    }

    setBusyKey(null);
    setNotice("Category rule removed.");
    await loadData();
  }

  return (
    <Card>
      <div className="space-y-1">
        <CardTitle>Categories</CardTitle>
        <CardDescription>
          Manage categories and deterministic rules used in imports and review.
        </CardDescription>
      </div>

      <Separator className="my-4" />

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Category Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Create and remove categories used in review and analytics.
          </p>
        </div>

        <div className="grid gap-3">
          <label
            htmlFor="new-category-name"
            className="text-sm font-medium text-foreground"
          >
            Category name
          </label>
          <Input
            id="new-category-name"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Groceries"
          />
          <label
            htmlFor="new-category-kind"
            className="text-sm font-medium text-foreground"
          >
            Kind
          </label>
          <Select
            id="new-category-kind"
            value={newCategoryKind}
            onChange={(event) =>
              setNewCategoryKind(event.target.value as CategoryKind)
            }
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="TRANSFER">Transfer</option>
          </Select>
          <label
            htmlFor="new-category-scope"
            className="text-sm font-medium text-foreground"
          >
            Scope
          </label>
          <Select
            id="new-category-scope"
            value={newCategoryScope}
            onChange={(event) => setNewCategoryScope(event.target.value)}
          >
            <option value="">Global</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            onClick={createCategory}
            disabled={busyKey === "new-category"}
          >
            {busyKey === "new-category" ? "Saving..." : "Add category"}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Kind</TH>
                <TH>Scope</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {loading ? (
                <tr>
                  <TD colSpan={4}>Loading categories...</TD>
                </tr>
              ) : null}
              {!loading && categories.length === 0 ? (
                <tr>
                  <TD colSpan={4}>No categories yet.</TD>
                </tr>
              ) : null}
              {!loading
                ? categories.map((category) => (
                    <tr key={category.id}>
                      <TD>{category.name}</TD>
                      <TD>{category.kind}</TD>
                      <TD>{getScopeLabel(category.accountId, accounts)}</TD>
                      <TD className="text-right">
                        <Button
                          variant="outline"
                          onClick={() => deleteCategory(category.id)}
                          disabled={
                            busyKey !== null &&
                            busyKey !== `delete-category-${category.id}`
                          }
                        >
                          {busyKey === `delete-category-${category.id}`
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                      </TD>
                    </tr>
                  ))
                : null}
            </TBody>
          </Table>
        </div>
      </section>

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
            id="rule-category"
            value={ruleCategoryId}
            onChange={(event) => setRuleCategoryId(event.target.value)}
            disabled={categories.length === 0}
          >
            {categories.length === 0 ? (
              <option value="">No categories available</option>
            ) : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
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
            id="rule-payment-type"
            value={rulePaymentType}
            onChange={(event) => setRulePaymentType(event.target.value)}
          >
            <option value="">Any</option>
            <option value="CARD">CARD</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="EFT">EFT</option>
            <option value="CASH">CASH</option>
            <option value="OTHER">OTHER</option>
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
            id="rule-scope"
            value={ruleScope}
            onChange={(event) => setRuleScope(event.target.value)}
          >
            <option value="">Global</option>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>

          <Button onClick={createRule} disabled={busyKey === "new-rule"}>
            {busyKey === "new-rule" ? "Saving..." : "Add rule"}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <THead>
              <tr>
                <TH>Merchant contains</TH>
                <TH>Category</TH>
                <TH>Payment type</TH>
                <TH>Priority</TH>
                <TH>Scope</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {loading ? (
                <tr>
                  <TD colSpan={6}>Loading category rules...</TD>
                </tr>
              ) : null}
              {!loading && categoryRules.length === 0 ? (
                <tr>
                  <TD colSpan={6}>No category rules yet.</TD>
                </tr>
              ) : null}
              {!loading
                ? categoryRules.map((rule) => (
                    <tr key={rule.id}>
                      <TD>{rule.merchantContains}</TD>
                      <TD>{rule.category.name}</TD>
                      <TD>{rule.paymentType ?? "ANY"}</TD>
                      <TD>{rule.priority}</TD>
                      <TD>{getScopeLabel(rule.accountId, accounts)}</TD>
                      <TD className="text-right">
                        <Button
                          variant="outline"
                          onClick={() => deleteRule(rule.id)}
                          disabled={
                            busyKey !== null &&
                            busyKey !== `delete-rule-${rule.id}`
                          }
                        >
                          {busyKey === `delete-rule-${rule.id}`
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                      </TD>
                    </tr>
                  ))
                : null}
            </TBody>
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
    </Card>
  );
}
