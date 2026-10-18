import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSubscriptionDecisionAction,
  setSubscriptionDecisionAction,
} from "./subscription-decisions";

const { setMock, clearMock, revalidatePathMock } = vi.hoisted(() => ({
  setMock: vi.fn(),
  clearMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { _tag: "prisma-mock" } }));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

vi.mock("@/lib/subscriptions/decisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subscriptions/decisions")>()),
  setSubscriptionDecision: setMock,
  clearSubscriptionDecision: clearMock,
}));

beforeEach(() => {
  setMock.mockReset().mockResolvedValue(undefined);
  clearMock.mockReset().mockResolvedValue(undefined);
  revalidatePathMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setSubscriptionDecisionAction", () => {
  it("stores the decision and refreshes the subscriptions page", async () => {
    const result = await setSubscriptionDecisionAction({
      normalizedMerchant: "netflix",
      status: "CONFIRMED",
    });

    expect(result).toEqual({
      ok: true,
      data: { normalizedMerchant: "netflix", status: "CONFIRMED" },
    });
    expect(setMock.mock.calls[0].slice(1)).toEqual(["netflix", "CONFIRMED"]);
    expect(revalidatePathMock.mock.calls).toEqual([["/subscriptions"]]);
  });

  it.each([
    ["an unknown status", { normalizedMerchant: "netflix", status: "MAYBE" }],
    ["an empty merchant", { normalizedMerchant: "", status: "CONFIRMED" }],
  ])("rejects %s without saving", async (_label, input) => {
    const result = await setSubscriptionDecisionAction(input);

    expect(result.ok ? null : result.error.code).toBe(
      "INVALID_SUBSCRIPTION_DECISION_PAYLOAD",
    );
    expect(setMock).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    setMock.mockRejectedValue(new Error("database is locked"));

    const result = await setSubscriptionDecisionAction({
      normalizedMerchant: "netflix",
      status: "DISMISSED",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SUBSCRIPTION_DECISION_SAVE_FAILED",
        message: "Kunne ikke lagre valget. Prøv igjen.",
      },
    });
  });
});

describe("clearSubscriptionDecisionAction", () => {
  it("clears the decision and refreshes the subscriptions page", async () => {
    const result = await clearSubscriptionDecisionAction({
      normalizedMerchant: "spotify",
    });

    expect(result).toEqual({
      ok: true,
      data: { normalizedMerchant: "spotify" },
    });
    expect(clearMock.mock.calls[0].slice(1)).toEqual(["spotify"]);
    expect(revalidatePathMock.mock.calls).toEqual([["/subscriptions"]]);
  });

  it("rejects a missing merchant without clearing", async () => {
    const result = await clearSubscriptionDecisionAction({});

    expect(result.ok ? null : result.error.code).toBe(
      "INVALID_SUBSCRIPTION_DECISION_PAYLOAD",
    );
    expect(clearMock).not.toHaveBeenCalled();
  });
});
