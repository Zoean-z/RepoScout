(function initProviderPresets(globalScope) {
  const providerList = [
    {
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      models: [
        { id: "gpt-5.4", label: "GPT-5.4", tier: "recommended" },

        { id: "gpt-5.3", label: "GPT-5.3", tier: "standard" },

      ],
      recommendedModel: "gpt-5.4",
      supportsCustomModel: true,
      compatibility: "native",
      notes: "Best default for quality; GPT-5 Mini is faster and lower cost."
    },
    {
      id: "anthropic",
      label: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      models: [
        { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "recommended" },
        { id: "claude-opus-4-6", label: "Claude Opus 4.6", tier: "standard" }
      ],
      recommendedModel: "claude-sonnet-4-6",
      supportsCustomModel: true,
      compatibility: "may_require_compatibility",
      notes: "May require compatibility routing when using OpenAI-style endpoints."
    },
    {
      id: "google",
      label: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      models: [
        { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "recommended" },
        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "standard" },
        { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", tier: "standard" }
      ],
      recommendedModel: "gemini-2.5-pro",
      supportsCustomModel: true,
      compatibility: "openai_compatible",
      notes: "Pro is default quality mode; Flash variants are lower-latency options."
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      models: [
        { id: "deepseek-chat", label: "DeepSeek Chat", tier: "recommended" },
        { id: "deepseek-reasoner", label: "DeepSeek Reasoner", tier: "standard" }
      ],
      recommendedModel: "deepseek-chat",
      supportsCustomModel: true,
      compatibility: "native",
      notes: "Reasoner is useful for deeper reasoning and thinking-style outputs."
    },
    {
      id: "qwen",
      label: "Qwen / DashScope",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      models: [
        { id: "qwen3.5-plus", label: "Qwen 3.5 Plus", tier: "recommended" },
        { id: "qwen-max", label: "Qwen Max", tier: "standard" },
        { id: "qwen-plus", label: "Qwen Plus", tier: "standard" },
        { id: "qwen-flash", label: "Qwen Flash", tier: "standard" }
      ],
      recommendedModel: "qwen3.5-plus",
      supportsCustomModel: true,
      compatibility: "openai_compatible",
      notes: "Uses DashScope OpenAI-compatible endpoint."
    },
    {
      id: "zhipu",
      label: "Zhipu / GLM",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      models: [
        { id: "glm-5", label: "GLM-5", tier: "recommended" },
        { id: "glm-4.6", label: "GLM-4.6", tier: "standard" }
      ],
      recommendedModel: "glm-5",
      supportsCustomModel: true,
      compatibility: "may_require_compatibility",
      notes: "May require provider-specific compatibility for stable OpenAI-style calls."
    },
    {
      id: "moonshot",
      label: "Moonshot / Kimi",
      baseUrl: "https://api.moonshot.cn/v1",
      models: [
        { id: "kimi-k2-0905-preview", label: "Kimi K2 0905 Preview", tier: "recommended" },
        { id: "kimi-k2-turbo-preview", label: "Kimi K2 Turbo Preview", tier: "preview" },
        { id: "kimi-thinking-preview", label: "Kimi Thinking Preview", tier: "preview" },
        { id: "moonshot-v1-128k", label: "Moonshot V1 128K", tier: "standard" },
        { id: "moonshot-v1-32k", label: "Moonshot V1 32K", tier: "standard" },
        { id: "moonshot-v1-8k", label: "Moonshot V1 8K", tier: "standard" }
      ],
      recommendedModel: "kimi-k2-0905-preview",
      supportsCustomModel: true,
      compatibility: "may_require_compatibility",
      notes: "Preview models are optional; may require compatibility adjustments."
    },
    {
      id: "custom",
      label: "Custom Compatible API",
      baseUrl: "",
      models: [],
      recommendedModel: "",
      supportsCustomModel: true,
      compatibility: "custom",
      notes: "Use for compatible APIs or self-hosted deployments."
    }
  ];

  function freezeProvider(provider) {
    const models = Array.isArray(provider.models)
      ? provider.models.map((model) =>
          Object.freeze({
            id: model.id,
            label: model.label,
            tier: model.tier
          })
        )
      : [];

    return Object.freeze({
      id: provider.id,
      label: provider.label,
      baseUrl: provider.baseUrl,
      models: Object.freeze(models),
      recommendedModel: provider.recommendedModel || (models[0]?.id || ""),
      supportsCustomModel: provider.supportsCustomModel !== false,
      compatibility: provider.compatibility || "native",
      notes: provider.notes || ""
    });
  }

  const frozenList = Object.freeze(providerList.map(freezeProvider));
  const map = {};
  frozenList.forEach((provider) => {
    map[provider.id] = provider;
  });

  globalScope.AI_PROVIDER_PRESETS = Object.freeze(map);
  globalScope.AI_PROVIDER_PRESET_LIST = frozenList;
})(self);
