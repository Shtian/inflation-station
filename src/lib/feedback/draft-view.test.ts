import { describe, expect, it } from "vite-plus/test";
import { draftView } from "./draft-view";

const ISSUE = {
  number: 42,
  url: "https://github.com/Shtian/inflation-station/issues/42",
};

describe("draftView", () => {
  it("awaits the user while an approval is pending", () => {
    expect(
      draftView({
        call: {},
        result: undefined,
        pending: "approval",
        streaming: false,
      }),
    ).toEqual({ kind: "awaiting", approval: "approval" });
  });

  it("shows a draft without approval or result as writing while it streams and superseded once settled", () => {
    const call = { approval: { approved: undefined } };
    expect(
      [true, false].map((streaming) =>
        draftView({ call, result: undefined, pending: undefined, streaming }),
      ),
    ).toEqual([{ kind: "writing" }, { kind: "superseded" }]);
  });

  it("reads an approved draft as creating until the issue arrives", () => {
    expect(
      [undefined, ISSUE].map((output) =>
        draftView({
          call: { approval: { approved: true }, output },
          result: undefined,
          pending: undefined,
          streaming: true,
        }),
      ),
    ).toEqual([{ kind: "creating" }, { kind: "created", issue: ISSUE }]);
  });

  it("separates a declined draft from a failed one", () => {
    expect(
      [
        { state: "error", outcome: "denied", error: "User declined" },
        {
          state: "error",
          error: "Kunne ikke opprette GitHub-saken: 401 Bad credentials",
        },
      ].map((result) =>
        draftView({
          call: { approval: { approved: true } },
          result,
          pending: undefined,
          streaming: false,
        }),
      ),
    ).toEqual([
      { kind: "declined" },
      {
        kind: "failed",
        error: "Kunne ikke opprette GitHub-saken: 401 Bad credentials",
      },
    ]);
  });
});
