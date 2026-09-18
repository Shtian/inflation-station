import { describe, expect, it } from "vitest";
import { createCleanupRunController } from "./cleanup-run-controller";

describe("createCleanupRunController", () => {
  it("returns a new signal on each start, aborting the previous one", () => {
    const controller = createCleanupRunController();

    const firstSignal = controller.start();
    const secondSignal = controller.start();

    expect(firstSignal).not.toBe(secondSignal);
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
  });

  it("does not throw when cancel is called before any run has started", () => {
    const controller = createCleanupRunController();

    expect(() => controller.cancel()).not.toThrow();
  });

  it("aborts the active run's signal when cancel is called", () => {
    const controller = createCleanupRunController();

    const signal = controller.start();
    expect(signal.aborted).toBe(false);

    controller.cancel();

    expect(signal.aborted).toBe(true);
  });
});
