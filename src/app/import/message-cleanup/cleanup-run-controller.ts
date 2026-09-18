export function createCleanupRunController() {
  let current: AbortController | null = null;

  function start(): AbortSignal {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    return controller.signal;
  }

  function cancel(): void {
    current?.abort();
  }

  return { start, cancel };
}

export type CleanupRunController = ReturnType<
  typeof createCleanupRunController
>;
