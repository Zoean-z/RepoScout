(function initAiSettingsStore(globalScope) {
  const STORAGE_AREA = chrome?.storage?.local;
  const CONFIG_KEY = "aiConfig";
  const RUNTIME_KEY = "aiRuntimeState";
  const LEGACY_KEYS = ["repoAiEnabled", "repoAiApiKey", "repoAiModel", "repoAiBaseUrl", "repoAiTimeoutMs"];

  const fallbackProviders = Object.freeze({
    openai: Object.freeze({
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      models: Object.freeze([{ id: "gpt-5.4", label: "GPT-5.4", tier: "recommended" }]),
      recommendedModel: "gpt-5.4",
      supportsCustomModel: true,
      compatibility: "native",
      notes: ""
    }),
    custom: Object.freeze({
      id: "custom",
      label: "Custom Compatible API",
      baseUrl: "",
      models: Object.freeze([]),
      recommendedModel: "",
      supportsCustomModel: true,
      compatibility: "custom",
      notes: ""
    })
  });

  const PROVIDER_PRESETS = Object.freeze(globalScope.AI_PROVIDER_PRESETS || fallbackProviders);
  const PROVIDER_PRESET_LIST = Object.freeze(
    Array.isArray(globalScope.AI_PROVIDER_PRESET_LIST) && globalScope.AI_PROVIDER_PRESET_LIST.length
      ? globalScope.AI_PROVIDER_PRESET_LIST
      : Object.values(PROVIDER_PRESETS)
  );

  const DEFAULT_PROVIDER_ID = PROVIDER_PRESETS.openai ? "openai" : PROVIDER_PRESET_LIST[0].id;

  const DEFAULT_CONFIG = Object.freeze({
    aiEnabled: true,
    provider: DEFAULT_PROVIDER_ID,
    apiKey: "",
    baseUrl: "",
    model: "",
    customModel: "",
    useCustomModel: false,
    language: "auto",
    timeoutMs: 9000
  });

  const DEFAULT_RUNTIME = Object.freeze({
    lastError: "",
    lastErrorAt: 0,
    lastSuccessAt: 0
  });

  function normalizeText(value) {
    return (value || "").toString().trim();
  }

  function normalizeLanguage(value) {
    const lowered = normalizeText(value).toLowerCase();
    if (lowered === "zh" || lowered === "en" || lowered === "auto") {
      return lowered;
    }
    return DEFAULT_CONFIG.language;
  }

  function normalizeTimeoutMs(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return DEFAULT_CONFIG.timeoutMs;
    }
    return Math.round(number);
  }

  function getProviderKeys() {
    return PROVIDER_PRESET_LIST.map((provider) => provider.id);
  }

  function normalizeProvider(value) {
    const provider = normalizeText(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, provider) ? provider : DEFAULT_PROVIDER_ID;
  }

  function getProviderPreset(provider) {
    return PROVIDER_PRESETS[normalizeProvider(provider)];
  }

  function getModelsByProvider(provider) {
    const preset = getProviderPreset(provider);
    return Array.isArray(preset.models) ? preset.models.slice() : [];
  }

  function getModelIdsByProvider(provider) {
    return getModelsByProvider(provider).map((item) => item.id);
  }

  function getRecommendedModel(provider) {
    const preset = getProviderPreset(provider);
    const modelIds = getModelIdsByProvider(provider);
    if (preset.recommendedModel && modelIds.includes(preset.recommendedModel)) {
      return preset.recommendedModel;
    }
    return modelIds[0] || "";
  }

  function modelExistsInProvider(provider, modelId) {
    if (!modelId) {
      return false;
    }
    return getModelIdsByProvider(provider).includes(modelId);
  }

  function isReservedCompatibilityProvider(provider) {
    return provider === "zhipu";
  }

  function inferProviderFromBaseUrl(baseUrl) {
    const lowered = normalizeText(baseUrl).toLowerCase();
    if (!lowered) {
      return DEFAULT_PROVIDER_ID;
    }

    if (lowered.includes("openai.com")) return "openai";
    if (lowered.includes("anthropic.com")) return "anthropic";
    if (lowered.includes("generativelanguage.googleapis.com") || lowered.includes("googleapis.com")) return "google";
    if (lowered.includes("deepseek.com")) return "deepseek";
    if (lowered.includes("dashscope.aliyuncs.com")) return "qwen";
    if (lowered.includes("bigmodel.cn")) return "zhipu";
    if (lowered.includes("moonshot.cn")) return "moonshot";
    return "custom";
  }

  function inferProviderFromModel(modelId) {
    const model = normalizeText(modelId);
    if (!model) {
      return "";
    }

    for (const providerId of getProviderKeys()) {
      if (modelExistsInProvider(providerId, model)) {
        return providerId;
      }
    }
    return "";
  }

  function sanitizeConfig(rawConfig) {
    const source = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    const aiEnabled =
      typeof source.aiEnabled === "boolean"
        ? source.aiEnabled
        : typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_CONFIG.aiEnabled;

    const rawProvider = normalizeText(source.provider);
    const rawModel = normalizeText(source.model);
    const rawCustomModel = normalizeText(source.customModel);
    const rawBaseUrl = normalizeText(source.baseUrl);

    const inferredProvider = rawProvider
      ? normalizeProvider(rawProvider)
      : inferProviderFromModel(rawModel) || inferProviderFromBaseUrl(rawBaseUrl);
    const provider = normalizeProvider(inferredProvider);
    const preset = getProviderPreset(provider);

    const explicitUseCustomModel = typeof source.useCustomModel === "boolean" ? source.useCustomModel : null;
    const modelInPreset = modelExistsInProvider(provider, rawModel);
    const useCustomModel =
      provider === "custom"
        ? true
        : explicitUseCustomModel !== null
        ? explicitUseCustomModel
        : rawModel
        ? !modelInPreset
        : false;

    const recommendedModel = getRecommendedModel(provider);
    const model = useCustomModel
      ? ""
      : modelInPreset
      ? rawModel
      : rawModel && provider !== "custom"
      ? recommendedModel
      : rawModel || recommendedModel;

    const customModel = useCustomModel ? rawCustomModel || (modelInPreset ? "" : rawModel) : "";
    const baseUrl = provider === "custom" ? rawBaseUrl : preset.baseUrl;

    return {
      aiEnabled,
      provider,
      apiKey: normalizeText(source.apiKey),
      baseUrl,
      model,
      customModel,
      useCustomModel,
      language: normalizeLanguage(source.language),
      timeoutMs: normalizeTimeoutMs(source.timeoutMs)
    };
  }

  function sanitizeRuntime(rawRuntime) {
    const source = rawRuntime && typeof rawRuntime === "object" ? rawRuntime : {};
    return {
      lastError: normalizeText(source.lastError),
      lastErrorAt: Number.isFinite(Number(source.lastErrorAt)) ? Number(source.lastErrorAt) : 0,
      lastSuccessAt: Number.isFinite(Number(source.lastSuccessAt)) ? Number(source.lastSuccessAt) : 0
    };
  }

  function resolveConnectionConfig(config) {
    const normalized = sanitizeConfig(config);
    const preset = getProviderPreset(normalized.provider);
    const resolvedModel = normalized.useCustomModel
      ? normalizeText(normalized.customModel)
      : normalizeText(normalized.model) || getRecommendedModel(normalized.provider);
    const resolvedBaseUrl = normalized.provider === "custom" ? normalizeText(normalized.baseUrl) : preset.baseUrl;

    return {
      aiEnabled: normalized.aiEnabled,
      provider: normalized.provider,
      providerLabel: preset.label,
      providerNotes: preset.notes || "",
      providerCompatibility: preset.compatibility || "native",
      apiKey: normalized.apiKey,
      baseUrl: resolvedBaseUrl,
      model: resolvedModel,
      language: normalized.language,
      timeoutMs: normalized.timeoutMs,
      useCustomModel: normalized.useCustomModel
    };
  }

  function toLegacyShape(config) {
    const normalized = sanitizeConfig(config);
    const resolved = resolveConnectionConfig(normalized);
    return {
      enabled: normalized.aiEnabled,
      apiKey: normalized.apiKey,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
      language: normalized.language,
      timeoutMs: normalized.timeoutMs
    };
  }

  async function getConfig() {
    if (!STORAGE_AREA) {
      return { ...DEFAULT_CONFIG };
    }

    const stored = await STORAGE_AREA.get([CONFIG_KEY, ...LEGACY_KEYS]);
    if (stored[CONFIG_KEY] && typeof stored[CONFIG_KEY] === "object") {
      const normalized = sanitizeConfig(stored[CONFIG_KEY]);
      await STORAGE_AREA.set({ [CONFIG_KEY]: normalized });
      return normalized;
    }

    const hasLegacyData = LEGACY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(stored, key));
    if (!hasLegacyData) {
      return { ...DEFAULT_CONFIG };
    }

    const migrated = sanitizeConfig({
      aiEnabled: stored.repoAiEnabled,
      apiKey: stored.repoAiApiKey,
      baseUrl: stored.repoAiBaseUrl,
      model: stored.repoAiModel,
      timeoutMs: stored.repoAiTimeoutMs
    });
    await STORAGE_AREA.set({ [CONFIG_KEY]: migrated });
    return migrated;
  }

  async function getResolvedConfig() {
    const config = await getConfig();
    return resolveConnectionConfig(config);
  }

  async function setConfig(nextConfig) {
    const sanitized = sanitizeConfig(nextConfig);
    if (STORAGE_AREA) {
      await STORAGE_AREA.set({ [CONFIG_KEY]: sanitized });
    }
    return sanitized;
  }

  async function updateConfig(configPatch) {
    const current = await getConfig();
    return setConfig({ ...current, ...(configPatch || {}) });
  }

  async function getRuntimeState() {
    if (!STORAGE_AREA) {
      return { ...DEFAULT_RUNTIME };
    }

    const stored = await STORAGE_AREA.get(RUNTIME_KEY);
    return sanitizeRuntime(stored[RUNTIME_KEY]);
  }

  async function setRuntimeState(nextRuntime) {
    const sanitized = sanitizeRuntime(nextRuntime);
    if (STORAGE_AREA) {
      await STORAGE_AREA.set({ [RUNTIME_KEY]: sanitized });
    }
    return sanitized;
  }

  async function updateRuntimeState(runtimePatch) {
    const current = await getRuntimeState();
    return setRuntimeState({ ...current, ...(runtimePatch || {}) });
  }

  function isConfigComplete(config) {
    const resolved = resolveConnectionConfig(config);
    return !!(resolved.apiKey && resolved.baseUrl && resolved.model);
  }

  function computeStatus(config, runtimeState) {
    const normalizedConfig = sanitizeConfig(config);
    const normalizedRuntime = sanitizeRuntime(runtimeState);
    const resolved = resolveConnectionConfig(normalizedConfig);

    if (!normalizedConfig.aiEnabled) {
      return { code: "off", label: "Off" };
    }
    if (isReservedCompatibilityProvider(resolved.provider)) {
      return { code: "not_configured", label: "Not Configured" };
    }
    if (!isConfigComplete(normalizedConfig)) {
      return { code: "not_configured", label: "Not Configured" };
    }
    if (normalizedRuntime.lastError) {
      return { code: "error", label: "Error" };
    }
    return { code: "ready", label: "Ready" };
  }

  function getProviderOptions() {
    return PROVIDER_PRESET_LIST.map((provider) => ({
      value: provider.id,
      label: provider.label,
      notes: provider.notes || ""
    }));
  }

  globalScope.AiSettingsStore = {
    PROVIDER_PRESETS,
    PROVIDER_PRESET_LIST,
    DEFAULT_CONFIG,
    DEFAULT_RUNTIME,
    sanitizeConfig,
    sanitizeRuntime,
    resolveConnectionConfig,
    toLegacyShape,
    getConfig,
    getResolvedConfig,
    setConfig,
    updateConfig,
    getRuntimeState,
    setRuntimeState,
    updateRuntimeState,
    isConfigComplete,
    computeStatus,
    normalizeProvider,
    getProviderPreset,
    getProviderOptions,
    getModelsByProvider,
    getModelIdsByProvider,
    getRecommendedModel,
    modelExistsInProvider
  };
})(self);
