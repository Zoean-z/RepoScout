const popupTitleEl = document.getElementById("popupTitle");
const aiPanelTitleEl = document.getElementById("aiPanelTitle");
const aiEnableLabelEl = document.getElementById("aiEnableLabel");
const aiEnabledToggleEl = document.getElementById("aiEnabledToggle");
const aiStatusTextEl = document.getElementById("aiStatusText");
const aiSettingsBtnEl = document.getElementById("aiSettingsBtn");

const statusEl = document.getElementById("status");
const lastAnalyzedAtEl = document.getElementById("lastAnalyzedAt");
const reanalyzeBtnEl = document.getElementById("reanalyzeBtn");
const resultEl = document.getElementById("result");

const repoTypeTitleEl = document.getElementById("repoTypeTitle");
const whatThisRepoIsTitleEl = document.getElementById("whatThisRepoIsTitle");
const readmeTldrTitleEl = document.getElementById("readmeTldrTitle");
const repoInsightTitleEl = document.getElementById("repoInsightTitle");
const quickStartTitleEl = document.getElementById("quickStartTitle");
const problemTitleEl = document.getElementById("problemTitle");
const projectStatusTitleEl = document.getElementById("projectStatusTitle");
const popularityTitleEl = document.getElementById("popularityTitle");
const techStackTitleEl = document.getElementById("techStackTitle");
const bestForTitleEl = document.getElementById("bestForTitle");
const quickStartStepsTitleEl = document.getElementById("quickStartStepsTitle");
const quickStartRequirementsTitleEl = document.getElementById("quickStartRequirementsTitle");
const quickStartNotesTitleEl = document.getElementById("quickStartNotesTitle");

const repoTypeEl = document.getElementById("repoType");
const whatThisRepoIsEl = document.getElementById("whatThisRepoIs");
const readmeTldrSectionEl = document.getElementById("readmeTldrSection");
const readmeTldrListEl = document.getElementById("readmeTldrList");
const repoInsightSectionEl = document.getElementById("repoInsightSection");
const projectStatusLabelEl = document.getElementById("projectStatusLabel");
const projectStatusDescriptionEl = document.getElementById("projectStatusDescription");
const popularityStarsEl = document.getElementById("popularityStars");
const popularityForksEl = document.getElementById("popularityForks");
const popularityLevelEl = document.getElementById("popularityLevel");
const techStackTagsEl = document.getElementById("techStackTags");
const bestForListEl = document.getElementById("bestForList");
const quickStartSectionEl = document.getElementById("quickStartSection");
const quickStartStepsEl = document.getElementById("quickStartSteps");
const quickStartRequirementsEl = document.getElementById("quickStartRequirements");
const quickStartNotesEl = document.getElementById("quickStartNotes");
const problemSectionEl = document.getElementById("problemSection");
const problemTextEl = document.getElementById("problemText");
const repoTypeSourceBadgeEl = document.getElementById("repoTypeSourceBadge");
const whatThisRepoIsSourceBadgeEl = document.getElementById("whatThisRepoIsSourceBadge");
const readmeTldrSourceBadgeEl = document.getElementById("readmeTldrSourceBadge");
const repoInsightSourceBadgeEl = document.getElementById("repoInsightSourceBadge");
const quickStartSourceBadgeEl = document.getElementById("quickStartSourceBadge");
const problemSourceBadgeEl = document.getElementById("problemSourceBadge");

const CACHE_KEY = "repoAnalysisCacheByRepoV1";
const MAX_CACHE_ENTRIES = 80;
const SOURCE_BADGE_META = {
  rule_based: { labelKey: "source_rule_based", titleKey: "source_rule_based_title" },
  ai_generated: { labelKey: "source_ai_generated", titleKey: "source_ai_generated_title" },
  ai_enhanced: { labelKey: "source_ai_enhanced", titleKey: "source_ai_enhanced_title" },
  fallback: { labelKey: "source_fallback", titleKey: "source_fallback_title" }
};

let isAnalyzing = false;
let resolvedLanguage = "en";
let languageChoice = "auto";
let lastAiStatusCode = "off";

function t(key, params) {
  if (self.RepoScoutI18n && typeof self.RepoScoutI18n.t === "function") {
    return self.RepoScoutI18n.t(resolvedLanguage, key, params);
  }
  return key;
}

function normalizeLanguageChoice(value) {
  if (self.RepoScoutI18n && typeof self.RepoScoutI18n.normalizeLanguageChoice === "function") {
    return self.RepoScoutI18n.normalizeLanguageChoice(value);
  }
  const lowered = (value || "").toString().trim().toLowerCase();
  return lowered === "zh" || lowered === "en" || lowered === "auto" ? lowered : "auto";
}

function normalizeResolvedLanguage(value) {
  if (self.RepoScoutI18n && typeof self.RepoScoutI18n.normalizeResolvedLanguage === "function") {
    return self.RepoScoutI18n.normalizeResolvedLanguage(value);
  }
  return (value || "").toString().toLowerCase() === "zh" ? "zh" : "en";
}

function localizeValue(value) {
  if (self.RepoScoutI18n && typeof self.RepoScoutI18n.localizeValue === "function") {
    return self.RepoScoutI18n.localizeValue(value, resolvedLanguage);
  }
  return value;
}

function localizeText(value) {
  const localized = localizeValue(value);
  if (typeof localized === "string") {
    return localized;
  }
  if (localized === undefined || localized === null) {
    return "";
  }
  return typeof localized === "number" || typeof localized === "boolean" ? String(localized) : "";
}

function localizeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((item) => localizeText(item)).filter(Boolean);
}

function applyPopupI18n() {
  popupTitleEl.textContent = t("popup_main_title");
  aiPanelTitleEl.textContent = t("popup_ai_enhancement");
  aiEnableLabelEl.textContent = t("popup_enable");
  aiSettingsBtnEl.textContent = t("popup_settings");

  repoTypeTitleEl.textContent = t("popup_repo_type");
  whatThisRepoIsTitleEl.textContent = t("popup_what_this_repo_is");
  readmeTldrTitleEl.textContent = t("popup_readme_tldr");
  repoInsightTitleEl.textContent = t("popup_repo_insight");
  quickStartTitleEl.textContent = t("popup_quick_start");
  problemTitleEl.textContent = t("popup_solves_problem");
  projectStatusTitleEl.textContent = t("popup_project_status");
  popularityTitleEl.textContent = t("popup_popularity");
  techStackTitleEl.textContent = t("popup_tech_stack");
  bestForTitleEl.textContent = t("popup_best_for");
  quickStartStepsTitleEl.textContent = t("popup_steps");
  quickStartRequirementsTitleEl.textContent = t("popup_requirements");
  quickStartNotesTitleEl.textContent = t("popup_notes");
  renderAiStatus();

  refreshVisibleSourceBadges();
  setAnalyzingState(isAnalyzing);
}

function renderAiStatus() {
  aiStatusTextEl.textContent = `${t("popup_status_prefix")}: ${t(`popup_status_${lastAiStatusCode}`)}`;
}

function refreshVisibleSourceBadges() {
  [repoTypeSourceBadgeEl, whatThisRepoIsSourceBadgeEl, readmeTldrSourceBadgeEl, repoInsightSourceBadgeEl, quickStartSourceBadgeEl, problemSourceBadgeEl].forEach(
    (el) => {
      if (!el || el.classList.contains("hidden")) {
        return;
      }
      setSourceBadge(el, el.dataset.source || "rule_based");
    }
  );
}

function setResolvedLanguage(language) {
  resolvedLanguage = normalizeResolvedLanguage(language);
  applyPopupI18n();
}

function resolveDisplayLanguage(payload, result) {
  const resultLanguage = normalizeResolvedLanguage(result?.language?.resolved);
  if (result?.language?.resolved) {
    return resultLanguage;
  }

  if (self.RepoScoutI18n && typeof self.RepoScoutI18n.resolveLanguage === "function") {
    return normalizeResolvedLanguage(
      self.RepoScoutI18n.resolveLanguage(languageChoice, payload, typeof navigator !== "undefined" ? navigator.language : "")
    );
  }

  return languageChoice === "zh" ? "zh" : "en";
}

function isGithubRepoHome(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname !== "github.com") {
      return false;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 2;
  } catch (_error) {
    return false;
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
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

function getStorageValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result?.[key]);
    });
  });
}

function setStorageValue(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.set(payload, () => {
      resolve(true);
    });
  });
}

function getRepoCacheKey(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname !== "github.com") {
      return "";
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) {
      return "";
    }
    return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
  } catch (_error) {
    return "";
  }
}

async function getCacheMap() {
  const data = await getStorageValue(CACHE_KEY);
  return data && typeof data === "object" ? data : {};
}

function pruneCacheMap(map) {
  const entries = Object.entries(map || {});
  entries.sort((left, right) => (Number(right[1]?.savedAt) || 0) - (Number(left[1]?.savedAt) || 0));
  return Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
}

async function loadCachedAnalysis(repoKey) {
  if (!repoKey) {
    return null;
  }

  const map = await getCacheMap();
  const entry = map[repoKey];
  if (!entry || typeof entry !== "object" || !entry.result) {
    return null;
  }

  return {
    result: entry.result,
    savedAt: Number(entry.savedAt) || 0
  };
}

async function saveCachedAnalysis(repoKey, result) {
  if (!repoKey || !result) {
    return null;
  }

  const map = await getCacheMap();
  map[repoKey] = {
    result,
    savedAt: Date.now()
  };
  const pruned = pruneCacheMap(map);
  await setStorageValue({ [CACHE_KEY]: pruned });
  return pruned[repoKey];
}

function formatSavedAt(timestamp) {
  if (!Number.isFinite(Number(timestamp)) || Number(timestamp) <= 0) {
    return "";
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  return formatter.format(new Date(Number(timestamp)));
}

function showSavedAt(timestamp) {
  const formatted = formatSavedAt(timestamp);
  if (!formatted) {
    lastAnalyzedAtEl.textContent = "";
    lastAnalyzedAtEl.classList.add("hidden");
    return;
  }
  lastAnalyzedAtEl.textContent = t("popup_last_analyzed_at", { time: formatted });
  lastAnalyzedAtEl.classList.remove("hidden");
}

function clearSavedAt() {
  lastAnalyzedAtEl.textContent = "";
  lastAnalyzedAtEl.classList.add("hidden");
}

function setAnalyzingState(busy) {
  isAnalyzing = !!busy;
  reanalyzeBtnEl.disabled = isAnalyzing;
  reanalyzeBtnEl.textContent = isAnalyzing ? t("popup_reanalyze_busy") : t("popup_reanalyze");
}

function showError(message, options = {}) {
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
  if (!options.keepResult) {
    resultEl.classList.add("hidden");
  }
}

function renderList(listEl, items, fallbackText) {
  listEl.innerHTML = "";
  const values = Array.isArray(items) && items.length ? items : [fallbackText];

  values.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    listEl.appendChild(li);
  });
}

function renderTagList(container, items, fallbackText) {
  container.innerHTML = "";
  const values = Array.isArray(items) && items.length ? items : [fallbackText];

  values.forEach((item) => {
    const tag = document.createElement("span");
    tag.className = "tag-item";
    tag.textContent = item;
    container.appendChild(tag);
  });
}

function normalizeSource(source) {
  const key = (source || "").toString().trim().toLowerCase();
  return SOURCE_BADGE_META[key] ? key : "rule_based";
}

function clearSourceBadge(badgeEl) {
  badgeEl.textContent = "";
  badgeEl.removeAttribute("title");
  badgeEl.removeAttribute("data-source");
  badgeEl.classList.add("hidden");
}

function setSourceBadge(badgeEl, source) {
  const normalized = normalizeSource(source);
  const meta = SOURCE_BADGE_META[normalized];
  badgeEl.textContent = t(meta.labelKey);
  badgeEl.title = t(meta.titleKey);
  badgeEl.dataset.source = normalized;
  badgeEl.classList.remove("hidden");
}

function normalizeResult(rawResult) {
  const repoTypeRaw = rawResult.repoType;
  const whatThisRepoIsRaw = rawResult.whatThisRepoIs;
  const readmeTldrRaw = rawResult.readmeTldr;
  const quickStartRaw = rawResult.quickStart || {};
  const problemSolvedRaw = rawResult.problemSolved || {};
  const repoInsightRaw = rawResult.repoInsight || null;
  const languageRaw = rawResult.language || {};

  return {
    repoType: {
      value:
        repoTypeRaw && typeof repoTypeRaw === "object" && typeof repoTypeRaw.value === "string"
          ? repoTypeRaw.value
          : (repoTypeRaw || "").toString(),
      source: repoTypeRaw && typeof repoTypeRaw === "object" ? repoTypeRaw.source : "rule_based"
    },
    whatThisRepoIs: {
      text:
        whatThisRepoIsRaw && typeof whatThisRepoIsRaw === "object"
          ? localizeText(whatThisRepoIsRaw.text)
          : localizeText(whatThisRepoIsRaw || ""),
      source: whatThisRepoIsRaw && typeof whatThisRepoIsRaw === "object" ? whatThisRepoIsRaw.source : "rule_based"
    },
    readmeTldr: {
      items:
        readmeTldrRaw && typeof readmeTldrRaw === "object"
          ? localizeList(Array.isArray(readmeTldrRaw.items) ? readmeTldrRaw.items : [])
          : localizeList(Array.isArray(readmeTldrRaw) ? readmeTldrRaw : []),
      source: readmeTldrRaw && typeof readmeTldrRaw === "object" ? readmeTldrRaw.source : "rule_based"
    },
    quickStart: {
      available: !!quickStartRaw.available,
      steps: localizeList(Array.isArray(quickStartRaw.steps) ? quickStartRaw.steps : []),
      requirements: localizeList(Array.isArray(quickStartRaw.requirements) ? quickStartRaw.requirements : []),
      notes: localizeList(Array.isArray(quickStartRaw.notes) ? quickStartRaw.notes : []),
      source: quickStartRaw.source || "rule_based"
    },
    problemSolved: {
      available: !!problemSolvedRaw.available,
      text: localizeText(problemSolvedRaw.text || ""),
      source: problemSolvedRaw.source || "rule_based"
    },
    repoInsight: repoInsightRaw
      ? {
          projectStatus: {
            label: (repoInsightRaw.projectStatus?.label || "").toString(),
            description: localizeText(repoInsightRaw.projectStatus?.description || "")
          },
          popularity: repoInsightRaw.popularity || {},
          techStack: localizeList(Array.isArray(repoInsightRaw.techStack) ? repoInsightRaw.techStack : []),
          bestFor: localizeList(Array.isArray(repoInsightRaw.bestFor) ? repoInsightRaw.bestFor : []),
          source: repoInsightRaw.source || "rule_based"
        }
      : null,
    language: {
      configured: normalizeLanguageChoice(languageRaw.configured),
      resolved: normalizeResolvedLanguage(languageRaw.resolved || "")
    }
  };
}

function formatRepoType(value) {
  const key = `repo_type_${(value || "").toString().trim().toLowerCase()}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

function formatProjectStatusLabel(label) {
  const key = `project_status_${(label || "").toString().trim().toLowerCase()}`;
  const translated = t(key);
  return translated === key ? (label || t("popup_unknown")) : translated;
}

function formatPopularityLevel(level) {
  const key = `popularity_level_${(level || "").toString().trim().toLowerCase()}`;
  const translated = t(key);
  return translated === key ? (level || t("popup_unknown")) : translated;
}

function renderRepoInsight(repoInsight) {
  if (!repoInsight) {
    repoInsightSectionEl.classList.add("hidden");
    clearSourceBadge(repoInsightSourceBadgeEl);
    return;
  }

  repoInsightSectionEl.classList.remove("hidden");
  setSourceBadge(repoInsightSourceBadgeEl, repoInsight.source);

  const status = repoInsight.projectStatus || {};
  const statusLabel = status.label || "unknown";
  projectStatusLabelEl.textContent = formatProjectStatusLabel(statusLabel);
  projectStatusDescriptionEl.textContent = status.description || t("popup_project_activity_limited");

  const popularity = repoInsight.popularity || {};
  const starsValue = (popularity.stars || "").toString().toLowerCase() === "unknown" ? t("popup_unknown") : popularity.stars || t("popup_unknown");
  const forksValue = (popularity.forks || "").toString().toLowerCase() === "unknown" ? t("popup_unknown") : popularity.forks || t("popup_unknown");
  popularityStarsEl.textContent = `${t("popup_stars")}: ${starsValue}`;
  popularityForksEl.textContent = `${t("popup_forks")}: ${forksValue}`;
  const level = (popularity.level || "unknown").toLowerCase();
  if (level === "unknown") {
    popularityLevelEl.textContent = "";
    popularityLevelEl.classList.add("hidden");
  } else {
    popularityLevelEl.classList.remove("hidden");
    popularityLevelEl.textContent = `${t("popup_level")}: ${formatPopularityLevel(level)}`;
  }

  renderTagList(techStackTagsEl, repoInsight.techStack, t("popup_unknown"));
  renderList(bestForListEl, repoInsight.bestFor, t("popup_no_audience"));
}

function renderResult(rawResult) {
  const result = normalizeResult(rawResult || {});
  repoTypeEl.textContent = formatRepoType(result.repoType.value || "-");
  whatThisRepoIsEl.textContent = result.whatThisRepoIs.text || "-";
  setSourceBadge(repoTypeSourceBadgeEl, result.repoType.source);
  setSourceBadge(whatThisRepoIsSourceBadgeEl, result.whatThisRepoIs.source);

  const tldr = Array.isArray(result.readmeTldr.items) ? result.readmeTldr.items : [];
  if (tldr.length) {
    readmeTldrSectionEl.classList.remove("hidden");
    renderList(readmeTldrListEl, tldr, t("popup_no_readme_tldr"));
    setSourceBadge(readmeTldrSourceBadgeEl, result.readmeTldr.source);
  } else {
    readmeTldrSectionEl.classList.add("hidden");
    readmeTldrListEl.innerHTML = "";
    clearSourceBadge(readmeTldrSourceBadgeEl);
  }

  renderRepoInsight(result.repoInsight);

  quickStartSectionEl.classList.add("hidden");
  problemSectionEl.classList.add("hidden");
  clearSourceBadge(quickStartSourceBadgeEl);
  clearSourceBadge(problemSourceBadgeEl);
  quickStartStepsEl.innerHTML = "";
  quickStartRequirementsEl.innerHTML = "";
  quickStartNotesEl.innerHTML = "";
  problemTextEl.textContent = "";

  if (result.repoType.value === "runnable_project" && result.quickStart.available) {
    quickStartSectionEl.classList.remove("hidden");
    renderList(quickStartStepsEl, result.quickStart.steps, t("popup_no_startup_steps"));
    renderList(quickStartRequirementsEl, result.quickStart.requirements, t("popup_no_requirements"));
    renderList(quickStartNotesEl, result.quickStart.notes, t("popup_no_notes"));
    setSourceBadge(quickStartSourceBadgeEl, result.quickStart.source);
  } else if (result.problemSolved.available) {
    problemSectionEl.classList.remove("hidden");
    problemTextEl.textContent = result.problemSolved.text || "-";
    setSourceBadge(problemSourceBadgeEl, result.problemSolved.source);
  }

  statusEl.classList.add("hidden");
  resultEl.classList.remove("hidden");
}

async function refreshAiStatus() {
  const config = await AiSettingsStore.getConfig();
  const runtime = await AiSettingsStore.getRuntimeState();
  const status = AiSettingsStore.computeStatus(config, runtime);
  aiEnabledToggleEl.checked = !!config.aiEnabled;
  languageChoice = normalizeLanguageChoice(config.language);
  lastAiStatusCode = status.code || "off";
  renderAiStatus();
}

async function runAnalysis(options = {}) {
  const forceRefresh = !!options.forceRefresh;
  setAnalyzingState(true);
  statusEl.textContent = forceRefresh ? t("popup_reanalyzing") : t("popup_analyzing");
  statusEl.classList.remove("hidden");

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id || !activeTab.url) {
      clearSavedAt();
      showError(t("popup_analyze_error"));
      return;
    }

    if (!isGithubRepoHome(activeTab.url)) {
      clearSavedAt();
      showError(t("popup_repo_home_only"));
      return;
    }

    const repoCacheKey = getRepoCacheKey(activeTab.url);
    const cachedEntry = await loadCachedAnalysis(repoCacheKey);
    const hasCached = !!cachedEntry?.result;

    if (hasCached) {
      setResolvedLanguage(resolveDisplayLanguage(null, cachedEntry.result));
      renderResult(cachedEntry.result);
      showSavedAt(cachedEntry.savedAt);
      statusEl.textContent = forceRefresh ? t("popup_reanalyzing") : t("popup_showing_cached_refreshing");
      statusEl.classList.remove("hidden");
    } else {
      clearSavedAt();
      resultEl.classList.add("hidden");
    }

    const extraction = await sendMessageToTab(activeTab.id, { type: "COLLECT_REPO_DATA" });
    if (!extraction?.ok || !extraction.data) {
      showError(hasCached ? t("popup_extract_retry_with_cache") : t("popup_extract_retry_hint"), { keepResult: hasCached });
      return;
    }

    setResolvedLanguage(resolveDisplayLanguage(extraction.data, null));
    await refreshAiStatus();

    const analysis = await sendRuntimeMessage({
      type: "ANALYZE_REPO",
      payload: extraction.data
    });
    if (!analysis?.ok || !analysis.result) {
      showError(hasCached ? t("popup_reanalysis_failed_showing_cache") : t("popup_analyze_error"), { keepResult: hasCached });
      return;
    }

    setResolvedLanguage(resolveDisplayLanguage(extraction.data, analysis.result));
    renderResult(analysis.result);
    const savedEntry = await saveCachedAnalysis(repoCacheKey, analysis.result);
    if (savedEntry?.savedAt) {
      showSavedAt(savedEntry.savedAt);
    }
  } finally {
    setAnalyzingState(false);
  }
}

async function handleAiToggleChange() {
  const nextEnabled = aiEnabledToggleEl.checked;
  await AiSettingsStore.updateConfig({ aiEnabled: nextEnabled });
  if (!nextEnabled) {
    await AiSettingsStore.updateRuntimeState({ lastError: "", lastErrorAt: 0 });
  }
  await refreshAiStatus();
  await runAnalysis();
}

function bindEvents() {
  aiEnabledToggleEl.addEventListener("change", () => {
    handleAiToggleChange().catch(() => {
      showError(t("popup_analyze_error"));
    });
  });

  aiSettingsBtnEl.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  reanalyzeBtnEl.addEventListener("click", () => {
    runAnalysis({ forceRefresh: true }).catch(() => {
      showError(t("popup_analyze_error"));
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes.aiConfig || changes.aiRuntimeState) {
      refreshAiStatus()
        .then(() => {
          setResolvedLanguage(resolveDisplayLanguage(null, null));
        })
        .catch(() => {});
    }
  });
}

async function init() {
  setResolvedLanguage("en");
  setAnalyzingState(false);
  bindEvents();
  await refreshAiStatus();
  setResolvedLanguage(resolveDisplayLanguage(null, null));
  await runAnalysis();
}

init().catch(() => {
  showError(t("popup_analyze_error"));
});
