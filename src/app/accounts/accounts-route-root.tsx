"use client";

import { AccountsManager } from "./accounts-manager";

export function AccountsRouteRoot() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <AccountsManager />
    </main>
  );
}
