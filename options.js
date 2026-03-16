const enabledInput = document.getElementById("enabledInput");
const providerInput = document.getElementById("providerInput");
const modelInput = document.getElementById("modelInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const languageInput = document.getElementById("languageInput");
const baseUrlInput = document.getElementById("baseUrlInput");
const useCustomModelInput = document.getElementById("useCustomModelInput");
const customModelInput = document.getElementById("customModelInput");
const outputLanguageLabelEl = document.getElementById("outputLanguageLabel");
const languageOptionAutoEl = document.getElementById("languageOptionAuto");
const languageOptionZhEl = document.getElementById("languageOptionZh");
const languageOptionEnEl = document.getElementById("languageOptionEn");
const speedWarningEl = document.getElementById("speedWarning");

const providerNote = document.getElementById("providerNote");
const modelSelectRow = document.getElementById("modelSelectRow");
const customModelToggleRow = document.getElementById("customModelToggleRow");
const customModelRow = document.getElementById("customModelRow");
const debugInfo = document.getElementById("debugInfo");
const advancedDetails = document.getElementById("advancedDetails");
const customModelSettingsSummary = document.getElementById("customModelSettingsSummary");

const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const saveReminder = document.getElementById("saveReminder");
const statusText = document.getElementById("statusText");

let currentConfig = null;
const optionsUiLanguage = "zh";

function t(key, params) {
  if (self.RepoScoutI18n && typeof self.RepoScoutI18n.t === "function") {
    return self.RepoScoutI18n.t(optionsUiLanguage, key, params);
  }
  return key;
}

function applyOptionsI18n() {
  if (outputLanguageLabelEl) outputLanguageLabelEl.textContent = t("options_output_language");
  if (languageOptionAutoEl) languageOptionAutoEl.textContent = t("options_lang_auto");
  if (languageOptionZhEl) languageOptionZhEl.textContent = t("options_lang_zh");
  if (languageOptionEnEl) languageOptionEnEl.textContent = t("options_lang_en");
  if (speedWarningEl) speedWarningEl.textContent = t("options_speed_warning");
  if (saveReminder) saveReminder.textContent = t("options_unsaved_changes");
}

function setStatus(message, type) {
  statusText.textContent = message || "";
  statusText.classList.remove("success", "error");
  if (type) {
    statusText.classList.add(type);
  }
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

function getProviderPreset(provider) {
  return AiSettingsStore.getProviderPreset(provider);
}

function formatModelLabel(model) {
  if (!model || !model.id) {
    return "";
  }
  if (model.tier === "recommended") {
    return `${model.label}（推荐）`;
  }
  if (model.tier === "preview") {
    return `${model.label}（预览）`;
  }
  return model.label;
}

function populateProviderOptions(selectedProvider) {
  providerInput.innerHTML = "";
  const options = AiSettingsStore.getProviderOptions();

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    providerInput.appendChild(option);
  });

  providerInput.value = AiSettingsStore.normalizeProvider(selectedProvider);
}

function setProviderNote(provider) {
  const preset = getProviderPreset(provider);
  providerNote.textContent = preset.notes || "";
}

function populateModelOptions(provider, selectedModel) {
  modelInput.innerHTML = "";
  const models = AiSettingsStore.getModelsByProvider(provider);
  const recommended = AiSettingsStore.getRecommendedModel(provider);

  if (!models.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无预设模型";
    modelInput.appendChild(option);
    modelInput.value = "";
    return "";
  }

  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = formatModelLabel(model);
    modelInput.appendChild(option);
  });

  const nextModel = models.some((item) => item.id === selectedModel) ? selectedModel : recommended || models[0].id;
  modelInput.value = nextModel;
  return nextModel;
}

function syncAdvancedDetailsState(provider) {
  const isCustomProvider = provider === "custom";
  advancedDetails.classList.toggle("advanced-locked", !isCustomProvider);
  if (!isCustomProvider) {
    advancedDetails.open = false;
  }
}

function applyProviderUiRules(provider) {
  const preset = getProviderPreset(provider);
  const isCustomProvider = provider === "custom";

  if (isCustomProvider) {
    modelSelectRow.classList.add("hidden");
    customModelToggleRow.classList.add("hidden");
    customModelRow.classList.remove("hidden");
    useCustomModelInput.checked = true;
    useCustomModelInput.disabled = true;
    baseUrlInput.readOnly = false;
    baseUrlInput.placeholder = "https://your-compatible-api/v1";
  } else {
    modelSelectRow.classList.remove("hidden");
    customModelToggleRow.classList.remove("hidden");
    useCustomModelInput.disabled = !preset.supportsCustomModel;
    if (!preset.supportsCustomModel) {
      useCustomModelInput.checked = false;
    }
    customModelRow.classList.toggle("hidden", !useCustomModelInput.checked);
    baseUrlInput.readOnly = true;
    baseUrlInput.value = preset.baseUrl;
    baseUrlInput.placeholder = preset.baseUrl;
  }

  syncAdvancedDetailsState(provider);
  setProviderNote(provider);
}

function updateDebugSummary() {
  const provider = providerInput.value;
  const model = provider === "custom" || useCustomModelInput.checked ? customModelInput.value.trim() || "（自定义模型）" : modelInput.value;
  const baseUrl = baseUrlInput.value.trim() || "（缺失）";
  debugInfo.textContent = `当前目标：${provider} / ${model} / ${baseUrl}`;
}

function toConfigSnapshot(config) {
  const normalized = AiSettingsStore.sanitizeConfig(config || {});
  return JSON.stringify({
    aiEnabled: normalized.aiEnabled,
    provider: normalized.provider,
    apiKey: normalized.apiKey,
    language: normalized.language,
    baseUrl: normalized.baseUrl,
    model: normalized.model,
    customModel: normalized.customModel,
    useCustomModel: normalized.useCustomModel,
    timeoutMs: normalized.timeoutMs
  });
}

function hasUnsavedChanges() {
  if (!currentConfig) {
    return false;
  }
  const previewConfig = AiSettingsStore.sanitizeConfig({
    ...currentConfig,
    ...readFormConfig()
  });
  return toConfigSnapshot(previewConfig) !== toConfigSnapshot(currentConfig);
}

function setSaveReminderVisible(visible) {
  saveReminder.classList.toggle("hidden", !visible);
}

function handleFormMutation(updateDebug = true) {
  if (updateDebug) {
    updateDebugSummary();
  }
  setSaveReminderVisible(hasUnsavedChanges());
}

function applyConfigToForm(config) {
  const normalized = AiSettingsStore.sanitizeConfig(config);
  currentConfig = normalized;

  populateProviderOptions(normalized.provider);
  enabledInput.checked = !!normalized.aiEnabled;
  apiKeyInput.value = normalized.apiKey || "";
  languageInput.value = normalized.language || "auto";
  useCustomModelInput.checked = !!normalized.useCustomModel;
  customModelInput.value = normalized.customModel || "";

  const provider = providerInput.value;
  populateModelOptions(provider, normalized.model);

  if (provider === "custom") {
    baseUrlInput.value = normalized.baseUrl || "";
  } else {
    baseUrlInput.value = getProviderPreset(provider).baseUrl;
  }

  applyProviderUiRules(provider);
  handleFormMutation(true);
}

function readFormConfig() {
  const provider = providerInput.value;
  const preset = getProviderPreset(provider);
  const isCustomProvider = provider === "custom";
  const useCustomModel = isCustomProvider ? true : !!useCustomModelInput.checked;

  return {
    aiEnabled: enabledInput.checked,
    provider,
    apiKey: apiKeyInput.value.trim(),
    language: languageInput.value,
    baseUrl: isCustomProvider ? baseUrlInput.value.trim() : preset.baseUrl,
    model: useCustomModel ? "" : modelInput.value,
    customModel: useCustomModel ? customModelInput.value.trim() : "",
    useCustomModel,
    timeoutMs: currentConfig?.timeoutMs
  };
}

function toFriendlyReason(reason, details) {
  if (!reason) return "未知错误";
  if (reason === "MISSING_API_KEY") return "缺少 API Key";
  if (reason === "MISSING_BASE_URL") return "缺少 Base URL";
  if (reason === "BASE_URL_INVALID") return "Base URL 无效";
  if (reason === "MISSING_MODEL") return "缺少模型";
  if (reason === "MODEL_NOT_SUPPORTED") return "所选模型不在当前 Provider 预设列表中";
  if (reason === "PROVIDER_COMPATIBILITY_LIMITED") {
    return details || "当前 Provider 可能需要专用兼容适配";
  }
  if (reason === "AI_REQUEST_FAILED") return "请求失败";
  if (reason === "AI_TIMEOUT") return "请求超时";
  if (reason === "INVALID_RESPONSE_FORMAT") return "响应格式无效";
  if (reason.startsWith("HTTP_")) {
    return details ? `请求失败（${reason}）：${details}` : `请求失败（${reason}）`;
  }
  return reason;
}

function handleProviderChange() {
  const provider = providerInput.value;
  const isCustom = provider === "custom";
  const previousCustomModel = customModelInput.value.trim();

  if (isCustom) {
    if (!previousCustomModel) {
      customModelInput.value = currentConfig?.customModel || "";
    }
    if (!baseUrlInput.value.trim()) {
      baseUrlInput.value = currentConfig?.provider === "custom" ? currentConfig.baseUrl : "";
    }
  } else {
    const currentModel = modelInput.value;
    populateModelOptions(provider, currentModel);
    baseUrlInput.value = getProviderPreset(provider).baseUrl;
  }

  applyProviderUiRules(provider);
  handleFormMutation(true);
}

function handleCustomModelToggleChange() {
  const provider = providerInput.value;
  if (provider === "custom") {
    useCustomModelInput.checked = true;
    customModelRow.classList.remove("hidden");
  } else {
    customModelRow.classList.toggle("hidden", !useCustomModelInput.checked);
    if (!useCustomModelInput.checked && !modelInput.value) {
      populateModelOptions(provider, AiSettingsStore.getRecommendedModel(provider));
    }
  }
  handleFormMutation(true);
}

async function loadSettings() {
  const config = await AiSettingsStore.getConfig();
  applyConfigToForm(config);
}

async function saveSettings() {
  saveBtn.disabled = true;
  setStatus("保存中...");

  try {
    const nextConfig = AiSettingsStore.sanitizeConfig({
      ...(currentConfig || {}),
      ...readFormConfig()
    });
    await AiSettingsStore.setConfig(nextConfig);
    currentConfig = nextConfig;
    await AiSettingsStore.updateRuntimeState({ lastError: "", lastErrorAt: 0 });
    applyConfigToForm(nextConfig);
    setStatus("设置已保存。", "success");
    setSaveReminderVisible(false);
  } catch (_error) {
    setStatus("保存失败。", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

async function testConnection() {
  testBtn.disabled = true;
  const previewConfig = AiSettingsStore.sanitizeConfig({
    ...(currentConfig || {}),
    ...readFormConfig()
  });
  const resolved = AiSettingsStore.resolveConnectionConfig(previewConfig);
  setStatus(`正在测试 ${resolved.providerLabel || resolved.provider} / ${resolved.model || "（缺少模型）"}...`);

  try {
    const response = await sendRuntimeMessage({ type: "AI_TEST_CONNECTION", config: previewConfig });
    if (response?.ok) {
      if (hasUnsavedChanges()) {
        setStatus(t("options_test_success_need_save"), "success");
      } else {
        setStatus("连接成功。", "success");
      }
      return;
    }

    setStatus(`连接失败：${toFriendlyReason(response?.reason, response?.details)}`, "error");
  } catch (_error) {
    setStatus("连接测试失败。", "error");
  } finally {
    testBtn.disabled = false;
  }
}

saveBtn.addEventListener("click", saveSettings);
testBtn.addEventListener("click", testConnection);
providerInput.addEventListener("change", handleProviderChange);
modelInput.addEventListener("change", () => handleFormMutation(true));
useCustomModelInput.addEventListener("change", handleCustomModelToggleChange);
customModelInput.addEventListener("input", () => handleFormMutation(true));
baseUrlInput.addEventListener("input", () => handleFormMutation(true));
enabledInput.addEventListener("change", () => handleFormMutation(false));
apiKeyInput.addEventListener("input", () => handleFormMutation(false));
languageInput.addEventListener("change", () => handleFormMutation(false));

if (advancedDetails) {
  advancedDetails.addEventListener("toggle", () => {
    if (providerInput.value !== "custom" && advancedDetails.open) {
      advancedDetails.open = false;
    }
  });
}

if (customModelSettingsSummary) {
  customModelSettingsSummary.addEventListener("click", (event) => {
    if (providerInput.value === "custom") {
      return;
    }
    event.preventDefault();
    setStatus("仅当 Provider 选择 Custom Compatible API 时，才可展开“自定义模型设置”。", "error");
  });
}

applyOptionsI18n();

loadSettings().catch(() => {
  setStatus("无法加载设置。", "error");
});

