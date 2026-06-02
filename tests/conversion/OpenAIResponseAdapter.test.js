const {
  adaptOpenAIResponse,
} = require("../../src/conversion/OpenAIResponseAdapter");

describe("OpenAIResponseAdapter", () => {
  test("basic response", () => {
    const result = adaptOpenAIResponse({
      text: "Hello!",
      finishReason: "STOP",
      model: "gemini-3.1-flash-lite",
      requestId: "req-abc",
    });

    expect(result.id).toBe("chatcmpl-req-abc");
    expect(result.object).toBe("chat.completion");
    expect(result.model).toBe("gemini-3.1-flash-lite");
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe("Hello!");
    expect(result.choices[0].finish_reason).toBe("stop");
  });

  test("usage is zeroed", () => {
    const result = adaptOpenAIResponse({
      text: "Test",
      finishReason: "STOP",
      model: "gemini-3.1-flash-lite",
      requestId: "req-1",
    });

    expect(result.usage.prompt_tokens).toBe(0);
    expect(result.usage.completion_tokens).toBe(0);
    expect(result.usage.total_tokens).toBe(0);
  });

  test("unknown finishReason maps to stop", () => {
    const result = adaptOpenAIResponse({
      text: "Test",
      finishReason: "UNKNOWN_REASON",
      model: "gemini-3.1-flash-lite",
      requestId: "req-2",
    });

    expect(result.choices[0].finish_reason).toBe("stop");
  });

  test("missing requestId", () => {
    const result = adaptOpenAIResponse({
      text: "Test",
      finishReason: "STOP",
      model: "gemini-3.1-flash-lite",
    });

    expect(result.id).toBe("chatcmpl-unknown");
  });
});
