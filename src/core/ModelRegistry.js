const DEFAULT_MODELS = [
  {
    id: "gemini-3.1-flash-lite",
    version: "web",
    displayName: "Gemini 3.1 Flash-Lite",
    description: "Gemini 3.1 Flash-Lite through Gemini Web browser automation",
    webModelLabel: "3.1 Flash-Lite",
    aliases: ["models/gemini-3.1-flash-lite"],
  },
  {
    id: "gemini-3.5-flash",
    version: "web",
    displayName: "Gemini 3.5 Flash",
    description: "Gemini 3.5 Flash through Gemini Web browser automation",
    webModelLabel: "3.5 Flash",
    aliases: ["models/gemini-3.5-flash"],
  },
  {
    id: "gemini-3.1-pro-preview",
    version: "web",
    displayName: "Gemini 3.1 Pro Preview",
    description: "Gemini 3.1 Pro Preview through Gemini Web browser automation",
    webModelLabel: "3.1 Pro",
    aliases: [
      "models/gemini-3.1-pro-preview",
      "gemini-3.1-pro",
      "models/gemini-3.1-pro",
    ],
  },
];

function createModelRegistry({
  models = DEFAULT_MODELS,
  defaultModel = "gemini-3.1-flash-lite",
} = {}) {
  const normalizedModels = models.map(normalizeModelDefinition);
  const byName = new Map();

  for (const model of normalizedModels) {
    for (const name of [
      model.id,
      `models/${model.id}`,
      ...(model.aliases || []),
    ]) {
      byName.set(normalizeModelName(name), model);
    }
  }

  const defaultModelDefinition =
    byName.get(normalizeModelName(defaultModel)) || normalizedModels[0];

  return {
    defaultModel: defaultModelDefinition.id,
    models: normalizedModels,

    resolve(modelName) {
      if (!modelName) return defaultModelDefinition;
      return byName.get(normalizeModelName(modelName)) || null;
    },

    listGeminiModels() {
      return {
        models: normalizedModels.map((model) => ({
          name: `models/${model.id}`,
          version: model.version,
          displayName: model.displayName,
          description: model.description,
          supportedGenerationMethods: ["generateContent"],
        })),
      };
    },

    listOpenAIModels() {
      return {
        object: "list",
        data: normalizedModels.map((model) => ({
          id: model.id,
          object: "model",
          created: 0,
          owned_by: "gemini-web2api",
        })),
      };
    },
  };
}

function normalizeModelDefinition(model) {
  return {
    id: model.id,
    version: model.version || "web",
    displayName: model.displayName || model.id,
    description:
      model.description || `${model.id} through Gemini Web browser automation`,
    webModelLabel: model.webModelLabel || "",
    aliases: model.aliases || [],
  };
}

function normalizeModelName(modelName) {
  return String(modelName || "")
    .trim()
    .replace(/^models\//, "");
}

function parseModelsEnv(raw) {
  if (!raw || !raw.trim()) return DEFAULT_MODELS;

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [idPart, labelPart, displayPart] = entry
        .split(":")
        .map((part) => part.trim());
      const id = normalizeModelName(idPart);
      return {
        id,
        version: "web",
        displayName: displayPart || toDisplayName(id),
        description: `${displayPart || toDisplayName(id)} through Gemini Web browser automation`,
        webModelLabel: labelPart || inferWebModelLabel(id),
        aliases: [],
      };
    });
}

function inferWebModelLabel(id) {
  const withoutSuffix = id.replace(/-web$/, "");
  if (withoutSuffix.includes("3.5-flash")) return "3.5 Flash";
  if (withoutSuffix.includes("3.1-pro")) return "3.1 Pro";
  if (withoutSuffix.includes("3.1-flash-lite")) return "3.1 Flash-Lite";
  return toDisplayName(withoutSuffix).replace(/^Gemini\s+/i, "");
}

function toDisplayName(id) {
  return id
    .replace(/-web$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

module.exports = {
  DEFAULT_MODELS,
  createModelRegistry,
  parseModelsEnv,
  normalizeModelName,
};
