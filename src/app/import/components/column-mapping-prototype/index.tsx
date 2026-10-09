"use client";

// PROTOTYPE — throwaway. Lives on branch prototype/column-mapping-layouts only.
// Four layouts of the column-mapping step, switchable via ?variant= on the
// existing /import route. A is the current form on PR #147, as the baseline.

import { useState } from "react";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { ImportColumnMappingPhase } from "../import-column-mapping-phase";
import type { MappingVariantProps } from "./shared";
import { VariantChecklist } from "./variant-checklist";
import { VariantSentence } from "./variant-sentence";
import { VariantSpreadsheet } from "./variant-spreadsheet";

const VARIANTS = [
  { key: "A", name: "Current form" },
  { key: "B", name: "Tag the spreadsheet" },
  { key: "C", name: "Read it as a sentence" },
  { key: "D", name: "Confirm-first checklist" },
];

export function ColumnMappingPrototype({
  variant,
  ...props
}: MappingVariantProps & { variant: string }) {
  const [current, setCurrent] = useState(
    VARIANTS.some((v) => v.key === variant) ? variant : "A",
  );
  return (
    <>
      {current === "A" && <ImportColumnMappingPhase key="A" {...props} />}
      {current === "B" && <VariantSpreadsheet key="B" {...props} />}
      {current === "C" && <VariantSentence key="C" {...props} />}
      {current === "D" && <VariantChecklist key="D" {...props} />}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={current}
        onChange={setCurrent}
      />
    </>
  );
}
