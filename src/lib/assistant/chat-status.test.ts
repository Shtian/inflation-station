import { describe, expect, it } from "vitest";
import { getAssistantChatStatus } from "./chat-status";
import type { AssistantUIMessage } from "./contract";

type Part = AssistantUIMessage["parts"][number];

const question: AssistantUIMessage = {
  id: "user-1",
  role: "user",
  parts: [{ type: "text", text: "Hvor mye brukte jeg på dagligvarer?" }],
};

function reply(...parts: Part[]): AssistantUIMessage[] {
  return [question, { id: "assistant-1", role: "assistant", parts }];
}

const toolStreaming: Part = {
  type: "tool-listCategories",
  toolCallId: "call-1",
  state: "input-streaming",
  input: undefined,
};

const toolRunning: Part = {
  type: "tool-listCategories",
  toolCallId: "call-1",
  state: "input-available",
  input: {},
};

const toolDone: Part = {
  type: "tool-listCategories",
  toolCallId: "call-1",
  state: "output-available",
  input: {},
  output: [],
};

function text(value: string): Part {
  return { type: "text", text: value, state: "streaming" };
}

describe("getAssistantChatStatus", () => {
  it("thinks while submitted before any assistant message exists", () => {
    expect(getAssistantChatStatus("submitted", [question])).toBe("Tenker…");
  });

  it("thinks once the stream has started but nothing is in the message yet", () => {
    expect(
      getAssistantChatStatus("streaming", reply({ type: "step-start" })),
    ).toBe("Tenker…");
  });

  it("fetches numbers while a tool call is streaming or running", () => {
    expect(getAssistantChatStatus("streaming", reply(toolStreaming))).toBe(
      "Henter tall…",
    );
    expect(getAssistantChatStatus("streaming", reply(toolRunning))).toBe(
      "Henter tall…",
    );
  });

  it("thinks after tool output arrives and before any answer text", () => {
    expect(
      getAssistantChatStatus(
        "streaming",
        reply({ type: "step-start" }, toolDone, { type: "step-start" }),
      ),
    ).toBe("Tenker…");
  });

  it("thinks while the answer text part is still empty", () => {
    expect(getAssistantChatStatus("streaming", reply(toolDone, text("")))).toBe(
      "Tenker…",
    );
  });

  it("shows nothing once answer text streams after the tool", () => {
    expect(
      getAssistantChatStatus("streaming", reply(toolDone, text("Du brukte"))),
    ).toBeNull();
    expect(getAssistantChatStatus("streaming", reply(text("Hei")))).toBe(null);
  });

  it("follows each step when text is followed by another tool call", () => {
    const preamble = text("La meg sjekke.");
    expect(
      getAssistantChatStatus("streaming", reply(preamble, toolRunning)),
    ).toBe("Henter tall…");
    expect(getAssistantChatStatus("streaming", reply(preamble, toolDone))).toBe(
      "Tenker…",
    );
    expect(
      getAssistantChatStatus(
        "streaming",
        reply(preamble, toolDone, text("Du brukte 4 250 kr.")),
      ),
    ).toBeNull();
  });

  it("shows nothing when the chat is ready or errored, even mid-tool", () => {
    expect(getAssistantChatStatus("ready", reply(toolRunning))).toBeNull();
    expect(getAssistantChatStatus("error", reply(toolDone))).toBeNull();
    expect(getAssistantChatStatus("ready", [question])).toBeNull();
    expect(getAssistantChatStatus("submitted", [question])).toBe("Tenker…");
  });
});
