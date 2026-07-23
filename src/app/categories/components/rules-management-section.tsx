import { Loader2, Plus, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/category-badge";
import { CategoryCombobox } from "@/components/category-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "../categories-manager.types";
import {
  ANY_PAYMENT_TYPE_VALUE,
  GLOBAL_SCOPE_VALUE,
  getScopeLabel,
} from "../categories-manager.utils";

type RulesManagementSectionProps = {
  accounts: Account[];
  activeAccounts: Account[];
  categories: Category[];
  categoryRules: CategoryRule[];
  loading: boolean;
  busyKey: string | null;
  ruleCategoryId: string;
  ruleMerchantContains: string;
  rulePaymentType: string;
  rulePriority: string;
  ruleScope: string;
  onRuleCategoryIdChange: (value: string) => void;
  onRuleMerchantContainsChange: (value: string) => void;
  onRulePaymentTypeChange: (value: string) => void;
  onRulePriorityChange: (value: string) => void;
  onRuleScopeChange: (value: string) => void;
  onCreateRule: () => void;
  onDeleteRule: (ruleId: string) => void;
};

export function RulesManagementSection({
  accounts,
  activeAccounts,
  categories,
  categoryRules,
  loading,
  busyKey,
  ruleCategoryId,
  ruleMerchantContains,
  rulePaymentType,
  rulePriority,
  ruleScope,
  onRuleCategoryIdChange,
  onRuleMerchantContainsChange,
  onRulePaymentTypeChange,
  onRulePriorityChange,
  onRuleScopeChange,
  onCreateRule,
  onDeleteRule,
}: RulesManagementSectionProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold text-base text-foreground">
          Category Rules
        </h3>
        <p className="text-muted-foreground text-sm">
          Define deterministic category suggestions by merchant text and
          optional payment type.
        </p>
      </div>

      <div className="grid gap-3">
        <Field>
          <FieldLabel htmlFor="rule-category">Category</FieldLabel>
          <FieldContent>
            <CategoryCombobox
              value={ruleCategoryId}
              categories={categories}
              onValueChange={onRuleCategoryIdChange}
              id="rule-category"
              placeholder={
                categories.length === 0
                  ? "No categories available"
                  : "Select category"
              }
              emptyLabel="No matching categories."
              disabled={categories.length === 0}
              showClear
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="rule-merchant">Merchant contains</FieldLabel>
          <FieldContent>
            <Input
              id="rule-merchant"
              value={ruleMerchantContains}
              onChange={(event) =>
                onRuleMerchantContainsChange(event.target.value)
              }
              placeholder="joker"
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="rule-payment-type">
            Payment type (optional)
          </FieldLabel>
          <FieldContent>
            <Select
              items={[
                { value: ANY_PAYMENT_TYPE_VALUE, label: "Any" },
                { value: "CARD", label: "CARD" },
                { value: "TRANSFER", label: "TRANSFER" },
                { value: "EFT", label: "EFT" },
                { value: "CASH", label: "CASH" },
                { value: "OTHER", label: "OTHER" },
              ]}
              value={rulePaymentType || ANY_PAYMENT_TYPE_VALUE}
              onValueChange={(value) => {
                if (value === null) return;
                onRulePaymentTypeChange(
                  value === ANY_PAYMENT_TYPE_VALUE ? "" : value,
                );
              }}
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
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="rule-priority">Priority</FieldLabel>
          <FieldContent>
            <Input
              id="rule-priority"
              type="number"
              value={rulePriority}
              onChange={(event) => onRulePriorityChange(event.target.value)}
              min={0}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="rule-scope">Scope</FieldLabel>
          <FieldContent>
            <Select
              items={[
                { value: GLOBAL_SCOPE_VALUE, label: "Global" },
                ...activeAccounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                })),
              ]}
              value={ruleScope || GLOBAL_SCOPE_VALUE}
              onValueChange={(value) => {
                if (value === null) return;
                onRuleScopeChange(value === GLOBAL_SCOPE_VALUE ? "" : value);
              }}
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
          </FieldContent>
        </Field>

        <Button
          onClick={onCreateRule}
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
                        onClick={() => onDeleteRule(rule.id)}
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
  );
}
