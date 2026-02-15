import { AccountsManager } from "./accounts-manager";

export default function AccountsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-zinc-600">
          Add, rename, and remove accounts used in imports.
        </p>
      </div>
      <div className="mt-6">
        <AccountsManager />
      </div>
    </main>
  );
}
