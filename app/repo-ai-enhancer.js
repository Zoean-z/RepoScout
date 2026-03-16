(function initRepoAiEnhancer(globalScope) {
  const DEFAULT_BASE_URL = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-4.1-mini";
  const DEFAULT_TIMEOUT_MS = 9000;
  const MOONSHOT_MIN_TIMEOUT_MS = 30000;

  function normalizeString(value) {
    return (value || "").toString().trim();
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clampLanguage(value) {
    const lowered = normalizeString(value).toLowerCase();
    if (lowered === "zh" || lowered === "en" || lowered === "auto") {
      return lowered;
    }
    return "auto";
  }

  function sanitizeResolvedSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const timeoutMs = Number(source.timeoutMs);
    const provider = normalizeString(source.provider) || "openai";
    const normalizedTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : DEFAULT_TIMEOUT_MS;
    const resolvedTimeout = provider === "moonshot" ? Math.max(normalizedTimeout, MOONSHOT_MIN_TIMEOUT_MS) : normalizedTimeout;
    return {
      aiEnabled: typeof source.aiEnabled === "boolean" ? source.aiEnabled : true,
      provider,
      providerCompatibility: normalizeString(source.providerCompatibility) || "native",
      apiKey: normalizeString(source.apiKey),
      baseUrl: (normalizeString(source.baseUrl) || DEFAULT_BASE_URL).replace(/\/+$/, ""),
      model: normalizeString(source.model) || DEFAULT_MODEL,
      language: clampLanguage(source.language),
      timeoutMs: resolvedTimeout
    };
  }

  function takeNonEmptyStrings(list, min, max) {
    const items = asArray(list)
      .map((item) => normalizeString(item))
      .filter(Boolean);
    if (items.length < min) {
      return [];
    }
    return items.slice(0, max);
  }

  function buildLanguageRule(language) {
    if (language === "zh") {
      return "Write output in Simplified Chinese.";
    }
    if (language === "en") {
      return "Write output in English.";
    }
    return "Use the most natural language based on provided facts, default to English when unclear.";
  }

  function buildPrompt(facts, language) {
    const systemPrompt = [
      "You are a careful repository analyst.",
      "Only use provided facts. Do not invent missing information.",
      "If information is insufficient, stay conservative and keep the field empty.",
      "Respond with JSON only and no markdown.",
      buildLanguageRule(language)
    ].join(" ");

    const userPrompt = [
      "Generate natural-language fields for a GitHub repository from structured facts.",
      "Output JSON with exact keys:",
      "{",
      '  "whatThisRepoIs": "string, exactly one sentence",',
      '  "readmeTldr": ["3-5 concise bullets, one idea each"],',
      '  "bestFor": ["2-4 concise bullets about audience/scenarios"],',
      '  "problemSolved": "one sentence, user-value oriented"',
      "}",
      "Rules:",
      "- Do not repeat raw keywords mechanically.",
      "- Do not copy README lines directly unless needed.",
      "- Do not claim capabilities not present in facts.",
      "- Keep text practical and specific.",
      "- If repoType is runnable_project, problemSolved may be an empty string.",
      "Facts JSON:",
      JSON.stringify(facts || {})
    ].join("\n");

    return { systemPrompt, userPrompt };
  }

  async function loadResolvedSettings() {
    const store = globalScope.AiSettingsStore;
    if (store && typeof store.getResolvedConfig === "function") {
      return sanitizeResolvedSettings(await store.getResolvedConfig());
    }
    return sanitizeResolvedSettings({});
  }

  function isReservedCompatibilityProvider(providerId) {
    return providerId === "zhipu";
  }

  function validateProviderModel(settings, originalConfig) {
    const store = globalScope.AiSettingsStore;
    if (!store || typeof store.getProviderPreset !== "function") {
      return { ok: true };
    }

    const preset = store.getProviderPreset(settings.provider);
    if (!preset) {
      return { ok: true };
    }

    if (isReservedCompatibilityProvider(settings.provider)) {
      return {
        ok: false,
        reason: "PROVIDER_COMPATIBILITY_LIMITED",
        details: preset.notes || "This provider may require provider-specific compatibility."
      };
    }

    const usingCustomModel = !!originalConfig?.useCustomModel || settings.provider === "custom";
    if (!usingCustomModel && typeof store.modelExistsInProvider === "function") {
      const inPreset = store.modelExistsInProvider(settings.provider, settings.model);
      if (!inPreset) {
        return { ok: false, reason: "MODEL_NOT_SUPPORTED" };
      }
    }

    return { ok: true };
  }

  function isValidHttpUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch (_error) {
      return false;
    }
  }

  async function readHttpErrorDetails(response) {
    try {
      const text = await response.text();
      if (!text) {
        return "";
      }
      try {
        const parsed = JSON.parse(text);
        return normalizeString(parsed?.error?.message || parsed?.message || text).slice(0, 400);
      } catch (_error) {
        return normalizeString(text).slice(0, 400);
      }
    } catch (_error) {
      return "";
    }
  }

  async function callResponsesApi(settings, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), settings.timeoutMs);

    try {
      const response = await fetch(`${settings.baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        return { ok: false, reason: `HTTP_${response.status}`, details: await readHttpErrorDetails(response) };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { ok: false, reason: "AI_TIMEOUT" };
      }
      return { ok: false, reason: "AI_REQUEST_FAILED" };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function callChatCompletionsApi(settings, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), settings.timeoutMs);

    try {
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        return { ok: false, reason: `HTTP_${response.status}`, details: await readHttpErrorDetails(response) };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { ok: false, reason: "AI_TIMEOUT" };
      }
      return { ok: false, reason: "AI_REQUEST_FAILED" };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function shouldPreferChatCompletions(settings) {
    if (settings.provider === "moonshot") {
      return true;
    }

    // Providers marked as compatibility-mode are more likely to support chat/completions first.
    return settings.providerCompatibility === "may_require_compatibility";
  }

  function mapChatBodyFromPrompts(systemPrompt, userPrompt, options) {
    const body = {
      model: options.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: options.temperature
    };

    if (Number.isFinite(Number(options.maxOutputTokens))) {
      body.max_tokens = Math.max(1, Math.round(Number(options.maxOutputTokens)));
    }
    if (options.expectJson) {
      body.response_format = { type: "json_object" };
    }

    return body;
  }

  function mapResponsesBodyFromPrompts(systemPrompt, userPrompt, options) {
    const body = {
      model: options.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] }
      ],
      temperature: options.temperature
    };

    if (Number.isFinite(Number(options.maxOutputTokens))) {
      body.max_output_tokens = Math.max(1, Math.round(Number(options.maxOutputTokens)));
    }

    return body;
  }

  function shouldFallbackToAlternateEndpoint(reason) {
    if (!reason || typeof reason !== "string") {
      return false;
    }

    // Retry on endpoint/protocol mismatch class errors.
    return reason === "INVALID_RESPONSE_FORMAT" || /^HTTP_(400|404|405|415|422)$/.test(reason);
  }

  async function callModelApi(settings, params) {
    const systemPrompt = normalizeString(params.systemPrompt);
    const userPrompt = normalizeString(params.userPrompt);
    const temperature = Number.isFinite(Number(params.temperature)) ? Number(params.temperature) : 0;
    const expectJson = !!params.expectJson;

    async function callWithModel(modelId) {
      const requestOptions = {
        model: modelId,
        temperature,
        maxOutputTokens: params.maxOutputTokens,
        expectJson
      };

      const useChatFirst = shouldPreferChatCompletions(settings);
      if (useChatFirst) {
        let chatResponse = await callChatCompletionsApi(
          settings,
          mapChatBodyFromPrompts(systemPrompt, userPrompt, requestOptions)
        );
        if (requestOptions.expectJson && /^HTTP_(400|422)$/.test(chatResponse.reason || "")) {
          chatResponse = await callChatCompletionsApi(
            settings,
            mapChatBodyFromPrompts(systemPrompt, userPrompt, {
              ...requestOptions,
              expectJson: false
            })
          );
        }
        if (chatResponse.ok || !shouldFallbackToAlternateEndpoint(chatResponse.reason)) {
          return { ...chatResponse, apiMode: "chat_completions" };
        }

        const responsesResponse = await callResponsesApi(
          settings,
          mapResponsesBodyFromPrompts(systemPrompt, userPrompt, requestOptions)
        );
        return { ...responsesResponse, apiMode: "responses" };
      }

      const responsesResponse = await callResponsesApi(
        settings,
        mapResponsesBodyFromPrompts(systemPrompt, userPrompt, requestOptions)
      );
      if (responsesResponse.ok || !shouldFallbackToAlternateEndpoint(responsesResponse.reason)) {
        return { ...responsesResponse, apiMode: "responses" };
      }

      let chatResponse = await callChatCompletionsApi(
        settings,
        mapChatBodyFromPrompts(systemPrompt, userPrompt, requestOptions)
      );
      if (requestOptions.expectJson && /^HTTP_(400|422)$/.test(chatResponse.reason || "")) {
        chatResponse = await callChatCompletionsApi(
          settings,
          mapChatBodyFromPrompts(systemPrompt, userPrompt, {
            ...requestOptions,
            expectJson: false
          })
        );
      }
      return { ...chatResponse, apiMode: "chat_completions" };
    }

    const primaryResponse = await callWithModel(settings.model);
    if (primaryResponse.ok || primaryResponse.reason !== "HTTP_404") {
      return primaryResponse;
    }

    const store = globalScope.AiSettingsStore;
    const recommendedModel =
      store && typeof store.getRecommendedModel === "function" ? normalizeString(store.getRecommendedModel(settings.provider)) : "";
    if (!recommendedModel || recommendedModel === settings.model) {
      return primaryResponse;
    }

    const retryResponse = await callWithModel(recommendedModel);
    if (retryResponse.ok) {
      return {
        ...retryResponse,
        details: `Retried with recommended model: ${recommendedModel}`
      };
    }

    return primaryResponse;
  }

  function extractResponseText(data) {
    if (!data || typeof data !== "object") {
      return "";
    }

    if (typeof data.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
    }

    const output = Array.isArray(data.output) ? data.output : [];
    const textParts = [];
    output.forEach((item) => {
      const content = Array.isArray(item?.content) ? item.content : [];
      content.forEach((part) => {
        const text = normalizeString(part?.text || part?.output_text);
        if (text) {
          textParts.push(text);
        }
      });
    });

    return textParts.join("\n").trim();
  }

  function extractChatCompletionText(data) {
    const choices = Array.isArray(data?.choices) ? data.choices : [];
    for (const choice of choices) {
      const content = choice?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }

      if (Array.isArray(content)) {
        const text = content
          .map((part) => normalizeString(part?.text || part?.content))
          .filter(Boolean)
          .join("\n")
          .trim();
        if (text) {
          return text;
        }
      }
    }
    return "";
  }

  function parseAiJson(text) {
    const raw = normalizeString(text);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) {
        return null;
      }
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (_innerError) {
        return null;
      }
    }
  }

  function parseAiJsonLoose(text) {
    const raw = normalizeString(text);
    if (!raw) {
      return null;
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    let candidate = raw.slice(start, end + 1).trim();
    candidate = candidate.replace(/```json\s*|```/gi, "");
    candidate = candidate.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":');
    candidate = candidate.replace(/,\s*([}\]])/g, "$1");

    try {
      return JSON.parse(candidate);
    } catch (_error) {
      return null;
    }
  }

  function firstSentence(text) {
    const normalized = normalizeString(text).replace(/\s+/g, " ");
    if (!normalized) {
      return "";
    }
    const parts = normalized.split(/(?<=[.!?。！？])\s+/);
    return normalizeString(parts[0] || normalized).slice(0, 220);
  }

  function extractBulletsFromText(text, min, max) {
    const lines = normalizeString(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const items = [];
    for (const line of lines) {
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (!bulletMatch) {
        continue;
      }
      const value = normalizeString(bulletMatch[1]);
      if (!value) {
        continue;
      }
      items.push(value);
      if (items.length >= max) {
        break;
      }
    }

    return items.length >= min ? items : [];
  }

  function buildAiPayloadFromText(text) {
    const normalized = normalizeString(text);
    if (!normalized) {
      return null;
    }

    return {
      whatThisRepoIs: firstSentence(normalized),
      readmeTldr: extractBulletsFromText(normalized, 3, 5),
      bestFor: extractBulletsFromText(normalized, 2, 4),
      problemSolved: ""
    };
  }

  async function repairAiJsonPayload(settings, rawText) {
    const sourceText = normalizeString(rawText).slice(0, 3500);
    if (!sourceText) {
      return null;
    }

    const response = await callModelApi(settings, {
      systemPrompt: "You are a strict JSON normalizer.",
      userPrompt: [
        "Convert the following content into strict JSON only.",
        "Required keys:",
        '{ "whatThisRepoIs": "string", "readmeTldr": ["string"], "bestFor": ["string"], "problemSolved": "string" }',
        "Rules:",
        "- No markdown, no code fence, no explanations.",
        "- Keep readmeTldr to 3-5 items.",
        "- Keep bestFor to 2-4 items.",
        "- If unknown, use empty string or empty arrays.",
        "Content:",
        sourceText
      ].join("\n"),
      temperature: 0,
      maxOutputTokens: 500,
      expectJson: false
    });

    if (!response.ok) {
      return null;
    }

    const repairedText =
      response.apiMode === "chat_completions"
        ? extractChatCompletionText(response.data)
        : extractResponseText(response.data);
    return parseAiJson(repairedText);
  }

  function validateAiPayload(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      whatThisRepoIs: normalizeString(parsed.whatThisRepoIs),
      readmeTldr: takeNonEmptyStrings(parsed.readmeTldr, 3, 5),
      bestFor: takeNonEmptyStrings(parsed.bestFor, 2, 4),
      problemSolved: normalizeString(parsed.problemSolved)
    };
  }

  async function enhanceRepoText(facts, options) {
    const store = globalScope.AiSettingsStore;
    const rawConfig = store && typeof store.getConfig === "function" ? await store.getConfig() : {};
    const settings = sanitizeResolvedSettings(store && typeof store.resolveConnectionConfig === "function" ? store.resolveConnectionConfig(rawConfig) : await loadResolvedSettings());
    if (!settings.aiEnabled) {
      return { ok: false, reason: "AI_DISABLED" };
    }
    if (!settings.apiKey) {
      return { ok: false, reason: "MISSING_API_KEY" };
    }
    if (!settings.baseUrl) {
      return { ok: false, reason: "MISSING_BASE_URL" };
    }
    if (!isValidHttpUrl(settings.baseUrl)) {
      return { ok: false, reason: "BASE_URL_INVALID" };
    }
    if (!settings.model) {
      return { ok: false, reason: "MISSING_MODEL" };
    }

    const validation = validateProviderModel(settings, rawConfig);
    if (!validation.ok) {
      return validation;
    }

    const requestedLanguage = clampLanguage(options?.language);
    const effectiveLanguage = requestedLanguage === "auto" ? settings.language : requestedLanguage;
    const { systemPrompt, userPrompt } = buildPrompt(facts, effectiveLanguage);
    const response = await callModelApi(settings, {
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      expectJson: true
    });
    if (!response.ok) {
      return response;
    }

    const text =
      response.apiMode === "chat_completions"
        ? extractChatCompletionText(response.data)
        : extractResponseText(response.data);
    let parsed = parseAiJson(text);
    if (!parsed) {
      parsed = parseAiJsonLoose(text);
    }
    if (!parsed) {
      parsed = await repairAiJsonPayload(settings, text);
    }
    if (!parsed) {
      parsed = buildAiPayloadFromText(text);
    }
    const validated = validateAiPayload(parsed);
    if (!validated) {
      return { ok: false, reason: "INVALID_AI_FORMAT" };
    }
    return { ok: true, data: validated };
  }

  async function testConnection(overrideConfig) {
    const store = globalScope.AiSettingsStore;
    const resolved = store && typeof store.resolveConnectionConfig === "function" ? store.resolveConnectionConfig(overrideConfig || {}) : overrideConfig || {};
    const settings = sanitizeResolvedSettings(resolved);

    if (!settings.apiKey) {
      return { ok: false, reason: "MISSING_API_KEY" };
    }
    if (!settings.baseUrl) {
      return { ok: false, reason: "MISSING_BASE_URL" };
    }
    if (!isValidHttpUrl(settings.baseUrl)) {
      return { ok: false, reason: "BASE_URL_INVALID" };
    }
    if (!settings.model) {
      return { ok: false, reason: "MISSING_MODEL" };
    }

    const validation = validateProviderModel(settings, overrideConfig || {});
    if (!validation.ok) {
      return validation;
    }

    const response = await callModelApi(settings, {
      systemPrompt: "You are a connectivity checker.",
      userPrompt: "Reply with: OK",
      maxOutputTokens: 16,
      temperature: 0
    });

    if (!response.ok) {
      return response;
    }

    const text =
      response.apiMode === "chat_completions"
        ? extractChatCompletionText(response.data)
        : extractResponseText(response.data);
    if (!text) {
      return { ok: false, reason: "INVALID_RESPONSE_FORMAT" };
    }
    return { ok: true };
  }

  globalScope.RepoAiEnhancer = {
    buildPrompt,
    enhanceRepoText,
    testConnection
  };
})(self);
