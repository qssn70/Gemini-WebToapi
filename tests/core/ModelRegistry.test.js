const { createModelRegistry, parseModelsEnv } = require("../../src/core/ModelRegistry");

describe("ModelRegistry", () => {
  test("lists default Gemini and OpenAI models", () => {
    const registry = createModelRegistry();

    expect(registry.listGeminiModels().models.map((m) => m.name)).toEqual([
      "models/gemini-3.1-flash-lite",
      "models/gemini-3.5-flash",
      "models/gemini-3.1-pro-preview",
    ]);
    expect(registry.listOpenAIModels().data.map((m) => m.id)).toContain("gemini-3.5-flash");
  });

  test("resolves model aliases", () => {
    const registry = createModelRegistry();

    expect(registry.resolve("models/gemini-3.5-flash").id).toBe("gemini-3.5-flash");
    expect(registry.resolve("gemini-3.1-flash-lite").id).toBe("gemini-3.1-flash-lite");
    expect(registry.resolve("gemini-3.1-pro-preview").id).toBe("gemini-3.1-pro-preview");
    expect(registry.resolve("gemini-3.1-pro").id).toBe("gemini-3.1-pro-preview");
    expect(registry.resolve("missing-model")).toBeNull();
  });

  test("parses MODELS env", () => {
    const models = parseModelsEnv("custom-web:Custom Label:Custom Display,other-web::Other Display");

    expect(models).toEqual([
      expect.objectContaining({
        id: "custom-web",
        webModelLabel: "Custom Label",
        displayName: "Custom Display",
      }),
      expect.objectContaining({
        id: "other-web",
        webModelLabel: "Other",
        displayName: "Other Display",
      }),
    ]);
  });
});
