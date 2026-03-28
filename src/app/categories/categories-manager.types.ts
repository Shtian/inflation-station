import type { CategoryKind, PaymentType } from "@prisma/client";

export type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
};

export type CategoryRule = {
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
