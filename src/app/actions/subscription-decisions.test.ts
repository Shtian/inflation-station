import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  clearSubscriptionDecisionAction,
  setSubscriptionDecisionAction,
} from "./subscription-decisions";

const { setMock, clearMock } = vi.hoisted(() => ({
  setMock: vi.fn(),
  clearMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { _tag: "prisma-mock" } }));

vi.mock("@/lib/subscriptions/decisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/subscriptions/decisions")>()),
  setSubscriptionDecision: setMock,
  clearSubscriptionDecision: clearMock,
}));

beforeEach(() => {
  setMock.mockReset().mockResolvedValue(undefined);
  clearMock.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setSubscriptionDecisionAction", () => {
  it("stores the decision", async () => {
    const result = await setSubscriptionDecisionAction({
      normalizedMerchant: "netflix",
      status: "CONFIRMED",
    });

    expect(result).toEqual({
      ok: true,
      data: { normalizedMerchant: "netflix", status: "CONFIRMED" },
    });
    expect(setMock.mock.calls[0].slice(1)).toEqual(["netflix", "CONFIRMED"]);
  });

  it("stores an ended decision", async () => {
    const result = await setSubscriptionDecisionAction({
      normalizedMerchant: "sats",
      status: "ENDED",
    });

    expect(result).toEqual({
      ok: true,
      data: { normalizedMerchant: "sats", status: "ENDED" },
    });
    expect(setMock.mock.calls[0].slice(1)).toEqual(["sats", "ENDED"]);
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
  it("clears the decision", async () => {
    const result = await clearSubscriptionDecisionAction({
      normalizedMerchant: "spotify",
    });

    expect(result).toEqual({
      ok: true,
      data: { normalizedMerchant: "spotify" },
    });
    expect(clearMock.mock.calls[0].slice(1)).toEqual(["spotify"]);
  });

  it("rejects a missing merchant without clearing", async () => {
    const result = await clearSubscriptionDecisionAction({});

    expect(result.ok ? null : result.error.code).toBe(
      "INVALID_SUBSCRIPTION_DECISION_PAYLOAD",
    );
    expect(clearMock).not.toHaveBeenCalled();
  });
});
