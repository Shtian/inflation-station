import { useCallback, useEffect, useState } from "react";
import type { SetupSnapshot } from "@/lib/onboarding/progress";

type SetupSnapshotState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: SetupSnapshot };

async function fetchList<T>(url: string, key: string): Promise<T[]> {
  const response = await fetch(url);
  const body: unknown = await response.json().catch(() => null);
  const list =
    body && typeof body === "object" && key in body
      ? (body as Record<string, unknown>)[key]
      : null;
  if (!response.ok || !Array.isArray(list)) {
    throw new Error(`Could not load ${key}.`);
  }
  return list as T[];
}

export function useSetupSnapshot() {
  const [state, setState] = useState<SetupSnapshotState>({
    status: "loading",
  });

  const reload = useCallback(async () => {
    try {
      const [accounts, categories] = await Promise.all([
        fetchList<SetupSnapshot["accounts"][number]>(
          "/api/accounts",
          "accounts",
        ),
        fetchList<SetupSnapshot["categories"][number]>(
          "/api/categories",
          "categories",
        ),
      ]);
      setState({
        status: "ready",
        snapshot: {
          accounts: accounts.map(({ name, institution }) => ({
            name,
            institution: institution ?? null,
          })),
          categories: categories.map(({ name, kind, classifierHint }) => ({
            name,
            kind,
            classifierHint: classifierHint ?? null,
          })),
        },
      });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
