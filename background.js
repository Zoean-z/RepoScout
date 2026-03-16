try {
  importScripts("i18n.js");
  importScripts("provider-presets.js");
  importScripts("ai-settings.js");
  importScripts("repo-ai-enhancer.js");
} catch (_error) {
  // Keep rule-based mode when AI helper is unavailable.
}

const REPO_TYPES = {
  RUNNABLE: "runnable_project",
  LIBRARY: "library_package",
  TEMPLATE: "template_example",
  SPECIAL: "fork_or_special"
};

const RESULT_SOURCES = {
  RULE_BASED: "rule_based",
  AI_GENERATED: "ai_generated",
  AI_ENHANCED: "ai_enhanced",
  FALLBACK: "fallback"
};

const SUPPORTED_LANGUAGE_CHOICES = new Set(["auto", "en", "zh"]);

const RUN_KEYWORDS = ["install", "setup", "run", "start", "dev"];
const RUN_COMMANDS = [
  "npm run dev",
  "npm start",
  "pnpm dev",
  "pnpm start",
  "yarn dev",
  "yarn start",
  "python app.py",
  "python main.py",
  "python manage.py runserver",
  "docker compose up",
  "docker-compose up",
  "make run",
  "go run",
  "cargo run"
];
const LIBRARY_KEYWORDS = ["usage", "api", "sdk", "library", "client", "integrate"];
const TEMPLATE_KEYWORDS = ["template", "starter", "boilerplate", "example", "scaffold"];

const INSTALL_COMMAND_CANDIDATES = [
  { needle: "pnpm install", command: "pnpm install" },
  { needle: "npm ci", command: "npm ci" },
  { needle: "npm install", command: "npm install" },
  { needle: "yarn install", command: "yarn install" },
  { needle: "\nyarn\n", command: "yarn" },
  { needle: "pip install -r requirements.txt", command: "pip install -r requirements.txt" },
  { needle: "python -m pip install -r requirements.txt", command: "python -m pip install -r requirements.txt" },
  { needle: "pip install", command: "pip install" },
  { needle: "poetry install", command: "poetry install" },
  { needle: "go mod tidy", command: "go mod tidy" },
  { needle: "go mod download", command: "go mod download" },
  { needle: "cargo build", command: "cargo build" },
  { needle: "./mvnw clean package", command: "./mvnw clean package" },
  { needle: "mvn clean package", command: "mvn clean package" },
  { needle: "make install", command: "make install" }
];

const START_COMMAND_CANDIDATES = [
  { needle: "docker compose up", command: "docker compose up" },
  { needle: "docker-compose up", command: "docker-compose up" },
  { needle: "npm run dev", command: "npm run dev" },
  { needle: "npm start", command: "npm start" },
  { needle: "pnpm dev", command: "pnpm dev" },
  { needle: "pnpm start", command: "pnpm start" },
  { needle: "yarn dev", command: "yarn dev" },
  { needle: "yarn start", command: "yarn start" },
  { needle: "python app.py", command: "python app.py" },
  { needle: "python main.py", command: "python main.py" },
  { needle: "python manage.py runserver", command: "python manage.py runserver" },
  { needle: "make run", command: "make run" },
  { needle: "go run", command: "go run ." },
  { needle: "cargo run", command: "cargo run" }
];

const ENV_COMMAND_CANDIDATES = [
  { needle: "cp .env.example .env", command: "cp .env.example .env" },
  { needle: "copy .env.example .env", command: "copy .env.example .env" },
  { needle: "cp .env .env.local", command: "cp .env .env.local" }
];

const TECH_README_KEYWORDS = [
  { needle: "next.js", stack: "Next.js" },
  { needle: "react", stack: "React" },
  { needle: "vue", stack: "Vue" },
  { needle: "express", stack: "Express" },
  { needle: "fastapi", stack: "FastAPI" },
  { needle: "flask", stack: "Flask" },
  { needle: "spring boot", stack: "Spring Boot" },
  { needle: "electron", stack: "Electron" },
  { needle: "pwa", stack: "PWA" }
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "using",
  "used",
  "project",
  "repository",
  "tool",
  "tools",
  "simple",
  "fast"
]);

function normalizeLanguageChoice(value) {
  const lowered = (value || "").toString().trim().toLowerCase();
  return SUPPORTED_LANGUAGE_CHOICES.has(lowered) ? lowered : "auto";
}

function normalizeResolvedLanguage(value) {
  const lowered = (value || "").toString().trim().toLowerCase();
  return lowered === "zh" ? "zh" : "en";
}

function isZhLanguage(language) {
  return normalizeResolvedLanguage(language) === "zh";
}

function getUiLanguageHint() {
  if (typeof chrome !== "undefined" && chrome?.i18n?.getUILanguage) {
    return chrome.i18n.getUILanguage();
  }
  return "";
}

function detectRepoLanguage(payload) {
  const i18n = self.RepoScoutI18n;
  if (i18n && typeof i18n.detectRepoLanguage === "function") {
    return i18n.detectRepoLanguage(payload);
  }

  const readmeText = (payload?.readmeText || "").slice(0, 8000);
  const zhCount = (readmeText.match(/[\u4e00-\u9fff]/g) || []).length;
  const enCount = (readmeText.match(/[A-Za-z]/g) || []).length;
  if (zhCount >= 20 && zhCount * 2 >= enCount) {
    return "zh";
  }
  if (enCount >= 120 && zhCount <= 10) {
    return "en";
  }
  return "";
}

function resolveOutputLanguage(languageChoice, payload) {
  const i18n = self.RepoScoutI18n;
  const normalizedChoice = normalizeLanguageChoice(languageChoice);

  if (i18n && typeof i18n.resolveLanguage === "function") {
    return normalizeResolvedLanguage(i18n.resolveLanguage(normalizedChoice, payload, getUiLanguageHint()));
  }

  if (normalizedChoice === "zh" || normalizedChoice === "en") {
    return normalizedChoice;
  }

  const detected = detectRepoLanguage(payload);
  if (detected === "zh" || detected === "en") {
    return detected;
  }

  const uiHint = getUiLanguageHint().toLowerCase();
  return uiHint.startsWith("zh") ? "zh" : "en";
}

async function resolveLanguageContext(payload) {
  const store = self.AiSettingsStore;
  let configured = "auto";
  if (store && typeof store.getConfig === "function") {
    try {
      const config = await store.getConfig();
      configured = normalizeLanguageChoice(config?.language);
    } catch (_error) {
      configured = "auto";
    }
  }

  return {
    configured,
    resolved: resolveOutputLanguage(configured, payload),
    detected: detectRepoLanguage(payload) || ""
  };
}

function emptyQuickStart() {
  return {
    available: false,
    steps: [],
    requirements: [],
    notes: []
  };
}

function normalizeText(text) {
  return (text || "").toLowerCase();
}

function uniquePush(target, value) {
  if (!value || target.includes(value)) {
    return;
  }
  target.push(value);
}

function hasRootFile(rootFiles, fileName) {
  const expected = fileName.toLowerCase();
  return (rootFiles || []).some((item) => normalizeText(item) === expected);
}

function hasProjectFile(payload, fileName) {
  return hasFile(payload.fileHints, fileName) || hasRootFile(payload.rootFiles, fileName);
}

function hasFile(fileHints, fileName) {
  const expected = fileName.toLowerCase();
  return (fileHints || []).some((item) => normalizeText(item) === expected);
}

function countMatches(text, keywords) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function pickEarliestCommand(searchText, candidates) {
  let best = null;

  for (const candidate of candidates) {
    const index = searchText.indexOf(candidate.needle);
    if (index === -1) {
      continue;
    }

    if (!best || index < best.index) {
      best = { index, command: candidate.command };
    }
  }

  return best ? best.command : "";
}

function detectCommandSignals(payload) {
  const readmeText = payload.readmeText || "";
  const readmeCode = (payload.readmeCodeBlocks || []).join("\n");
  const joinedText = `${readmeText}\n${readmeCode}`;
  const lower = normalizeText(joinedText);

  return {
    readmeLower: lower,
    installCommand: pickEarliestCommand(lower, INSTALL_COMMAND_CANDIDATES),
    startCommand: pickEarliestCommand(lower, START_COMMAND_CANDIDATES),
    envCommand: pickEarliestCommand(lower, ENV_COMMAND_CANDIDATES),
    hasEnvSignal:
      lower.includes(".env") ||
      lower.includes("api_key") ||
      lower.includes("apikey") ||
      lower.includes("api key") ||
      lower.includes("token")
  };
}

function detectRequirements(payload, signal) {
  const lower = signal.readmeLower;
  const requirements = [];

  const needsNode =
    hasProjectFile(payload, "package.json") ||
    lower.includes("npm ") ||
    lower.includes("pnpm ") ||
    lower.includes("yarn ") ||
    lower.includes("node.js");
  const needsPython =
    hasProjectFile(payload, "requirements.txt") ||
    hasProjectFile(payload, "pyproject.toml") ||
    lower.includes("pip install") ||
    lower.includes("python ");
  const needsDocker =
    hasProjectFile(payload, "dockerfile") ||
    hasProjectFile(payload, "docker-compose.yml") ||
    lower.includes("docker compose") ||
    lower.includes("docker-compose");
  const needsPostgres = lower.includes("postgres") || lower.includes("postgresql");
  const needsRedis = lower.includes("redis");
  const needsJava =
    hasProjectFile(payload, "pom.xml") ||
    hasProjectFile(payload, "build.gradle") ||
    lower.includes("maven") ||
    lower.includes("java ");
  const needsGo = hasProjectFile(payload, "go.mod") || lower.includes("go run") || lower.includes("go mod");

  if (needsNode) uniquePush(requirements, "Node.js");
  if (needsPython) uniquePush(requirements, "Python");
  if (needsDocker) uniquePush(requirements, "Docker");
  if (needsPostgres) uniquePush(requirements, "Postgres");
  if (needsRedis) uniquePush(requirements, "Redis");
  if (needsJava) uniquePush(requirements, "Java");
  if (needsGo) uniquePush(requirements, "Go");

  return requirements;
}

function buildQuickStartNotes(signal, requirements, language) {
  const zh = isZhLanguage(language);
  const lower = signal.readmeLower;
  const notes = [];

  if (signal.hasEnvSignal) {
    uniquePush(notes, zh ? "需要配置环境变量或 API Key。" : "Requires environment variables or API keys.");
  }
  if (requirements.includes("Postgres")) {
    uniquePush(notes, zh ? "需要可用的 Postgres 实例或连接。" : "Needs a running Postgres instance or connection.");
  }
  if (requirements.includes("Redis")) {
    uniquePush(notes, zh ? "需要可用的 Redis 实例。" : "Needs a running Redis instance.");
  }
  if (requirements.includes("Docker")) {
    uniquePush(notes, zh ? "运行依赖或完整环境可能需要 Docker。" : "Docker may be required to run dependencies or full stack.");
  }
  if (
    lower.includes("openai") ||
    lower.includes("anthropic") ||
    lower.includes("gemini") ||
    lower.includes("stripe") ||
    lower.includes("supabase") ||
    lower.includes("firebase") ||
    lower.includes("aws")
  ) {
    uniquePush(notes, zh ? "可能依赖外部服务与有效凭证。" : "May depend on external services and valid credentials.");
  }

  return notes.slice(0, 4);
}

function buildQuickStart(payload, signal, language) {
  const zh = isZhLanguage(language);
  const requirements = detectRequirements(payload, signal);
  const notes = buildQuickStartNotes(signal, requirements, language);
  const steps = [];

  if (signal.installCommand) {
    uniquePush(steps, zh ? `安装依赖：${signal.installCommand}` : `Install dependencies: ${signal.installCommand}`);
  } else if (requirements.includes("Node.js")) {
    uniquePush(steps, zh ? "使用 npm、pnpm 或 yarn 安装依赖。" : "Install dependencies with npm, pnpm, or yarn.");
  } else if (requirements.includes("Python")) {
    uniquePush(steps, zh ? "从 requirements 或 pyproject 安装 Python 依赖。" : "Install Python dependencies from requirements or pyproject.");
  } else if (requirements.includes("Java")) {
    uniquePush(steps, zh ? "使用 Maven 构建并安装依赖。" : "Build dependencies with Maven.");
  } else if (requirements.includes("Go")) {
    uniquePush(steps, zh ? "使用 go mod tidy 下载依赖。" : "Download dependencies with go mod tidy.");
  }

  if (signal.hasEnvSignal) {
    if (signal.envCommand) {
      uniquePush(steps, zh ? `创建环境文件：${signal.envCommand}` : `Create environment file: ${signal.envCommand}`);
    } else {
      uniquePush(steps, zh ? "配置必需的环境变量（.env/API Key）。" : "Configure required environment variables (.env/API keys).");
    }
  }

  if (requirements.includes("Postgres") || requirements.includes("Redis")) {
    uniquePush(steps, zh ? "启动应用前先启动必需的数据服务。" : "Start required data services before launching the app.");
  }

  if (signal.startCommand) {
    uniquePush(steps, zh ? `启动开发环境：${signal.startCommand}` : `Start development environment: ${signal.startCommand}`);
  } else {
    uniquePush(steps, zh ? "执行 README 中给出的启动命令。" : "Run the startup command documented in README.");
  }

  return {
    available: true,
    steps: steps.slice(0, 4),
    requirements,
    notes
  };
}

function extractDomainWords(payload) {
  const topics = (payload.topics || []).map((item) => item.trim()).filter(Boolean);
  if (topics.length) {
    return topics.slice(0, 3).join(", ");
  }

  const description = normalizeText(payload.description).replace(/[^a-z0-9\s-]/g, " ");
  const words = description
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const unique = [];

  for (const word of words) {
    if (unique.includes(word)) {
      continue;
    }
    unique.push(word);
    if (unique.length === 3) {
      break;
    }
  }

  return unique.join(", ");
}

function buildWhatThisRepoIs(payload, repoType, requirements, language) {
  const zh = isZhLanguage(language);
  const domain = extractDomainWords(payload);
  const runtimeHint = requirements.length
    ? zh
      ? `，常见依赖 ${requirements.slice(0, 2).join(" + ")}`
      : ` and commonly uses ${requirements.slice(0, 2).join(" + ")}`
    : "";

  if (repoType === REPO_TYPES.RUNNABLE) {
    return zh
      ? `这是一个可运行的应用/服务仓库${domain ? `，聚焦于 ${domain}` : ""}${runtimeHint}。`
      : `A runnable application/service repository${domain ? ` focused on ${domain}` : ""}${runtimeHint}.`;
  }
  if (repoType === REPO_TYPES.LIBRARY) {
    return zh
      ? `这是一个可复用的库/包仓库${domain ? `，聚焦于 ${domain}` : ""}${runtimeHint}。`
      : `A reusable library/package repository${domain ? ` focused on ${domain}` : ""}${runtimeHint}.`;
  }
  if (repoType === REPO_TYPES.TEMPLATE) {
    return zh
      ? `这是一个用于 ${domain || "项目初始化"} 的模板/脚手架仓库，可加快项目搭建。`
      : `A starter/template repository${domain ? ` for ${domain}` : ""} that speeds up project scaffolding.`;
  }
  return zh
    ? `这是一个 fork 或特殊用途仓库${domain ? `，主题与 ${domain} 相关` : ""}，主要用于同步或参考。`
    : `A forked or special-purpose repository${domain ? ` around ${domain}` : ""}, mainly for sync or reference.`;
}

function shortenLine(line, maxLength) {
  const trimmed = line.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function isLikelyNarrativeLine(line) {
  const text = line.trim();
  if (!text || text.length < 24 || text.length > 180) {
    return false;
  }
  if (
    text.startsWith("#") ||
    text.startsWith("|") ||
    text.startsWith("```") ||
    /^[-*]\s/.test(text) ||
    /^\d+\.\s/.test(text) ||
    /^https?:\/\//i.test(text)
  ) {
    return false;
  }

  const lower = text.toLowerCase();
  const commandStarts = ["npm ", "pnpm ", "yarn ", "pip ", "python ", "docker ", "make ", "go ", "cargo ", "mvn "];
  return !commandStarts.some((prefix) => lower.startsWith(prefix));
}

function buildReadmeTldr(payload, repoType, signal, requirements, language) {
  const zh = isZhLanguage(language);
  const bullets = [];
  const lines = (payload.readmeText || "").split(/\r?\n/);

  for (const line of lines) {
    if (!isLikelyNarrativeLine(line)) {
      continue;
    }
    uniquePush(bullets, shortenLine(line, 120));
    if (bullets.length >= 2) {
      break;
    }
  }

  if (requirements.length) {
    uniquePush(
      bullets,
      zh ? `运行依赖包括：${requirements.join("、")}。` : `Runtime requirements include: ${requirements.join(", ")}.`
    );
  }
  if (signal.startCommand) {
    uniquePush(
      bullets,
      zh ? `README 中的主要启动命令：${signal.startCommand}。` : `Primary startup command in README: ${signal.startCommand}.`
    );
  }
  if (signal.hasEnvSignal) {
    uniquePush(
      bullets,
      zh
        ? "README 显示需要环境配置（如 .env / API Key）。"
        : "README indicates environment configuration (.env/API keys) is needed."
    );
  }

  if (bullets.length < 3 && repoType === REPO_TYPES.TEMPLATE) {
    uniquePush(bullets, zh ? "README 将该仓库定位为模板/示例基线。" : "README positions this repository as a starter/example baseline.");
  }
  if (bullets.length < 3 && repoType === REPO_TYPES.LIBRARY) {
    uniquePush(
      bullets,
      zh ? "README 更偏向集成/使用说明，而不是完整应用运行流程。" : "README is oriented around integration/usage rather than running a full app."
    );
  }
  if (bullets.length < 3 && repoType === REPO_TYPES.RUNNABLE) {
    uniquePush(bullets, zh ? "README 强调本地环境搭建和项目运行。" : "README emphasizes local setup and project execution.");
  }
  if (bullets.length < 3 && repoType === REPO_TYPES.SPECIAL) {
    uniquePush(
      bullets,
      zh
        ? "README 语境显示该仓库多用于 fork/归档或特殊工作流维护。"
        : "README context suggests this is maintained for fork/archive or special workflows."
    );
  }

  while (bullets.length < 3) {
    uniquePush(
      bullets,
      zh ? "README 包含项目背景、安装配置与使用说明。" : "README contains project context, setup instructions, and usage guidance."
    );
  }

  return bullets.slice(0, 5);
}

function buildProblemSolved(repoType, payload, language) {
  const zh = isZhLanguage(language);
  if (repoType === REPO_TYPES.SPECIAL) {
    if (payload.isArchived) {
      return {
        available: true,
        text: zh ? "保留历史实现与项目上下文，便于持续查阅。" : "Keeps historical implementation and project context accessible."
      };
    }
    if (payload.isFork) {
      return {
        available: true,
        text: zh
          ? "在不修改源仓库的前提下，支持上游同步与自定义改造。"
          : "Supports upstream sync plus custom modifications without changing the source repository."
      };
    }
    return {
      available: true,
      text: zh
        ? "支持镜像、子模块等特殊维护/集成流程。"
        : "Supports special maintenance/integration workflows such as mirror or submodule usage."
    };
  }

  if (repoType === REPO_TYPES.TEMPLATE) {
    return {
      available: true,
      text: zh ? "通过提供可复用起点，降低项目冷启动成本。" : "Reduces project bootstrapping cost by providing a reusable starting point."
    };
  }

  if (repoType === REPO_TYPES.LIBRARY) {
    return {
      available: true,
      text: zh ? "将可复用能力封装成模块，便于其他项目直接集成。" : "Packages reusable capability so other projects can integrate it directly."
    };
  }

  return { available: false, text: "" };
}

function parseCountValue(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  const text = normalizeText(String(raw)).replace(/\s+/g, "");
  if (!text) {
    return null;
  }

  const suffix = text.endsWith("k") ? "k" : text.endsWith("m") ? "m" : text.endsWith("b") ? "b" : "";
  const numericText = suffix ? text.slice(0, -1) : text;
  const value = Number.parseFloat(numericText.replace(/,/g, ""));
  if (Number.isNaN(value)) {
    return null;
  }

  if (suffix === "k") return Math.round(value * 1000);
  if (suffix === "m") return Math.round(value * 1000000);
  if (suffix === "b") return Math.round(value * 1000000000);
  return Math.round(value);
}

function formatCountDisplay(count) {
  if (count === null || count === undefined) {
    return "unknown";
  }
  if (count < 1000) {
    return String(count);
  }
  if (count < 1000000) {
    const value = count / 1000;
    return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const value = count / 1000000;
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}m`;
}

function buildPopularity(payload) {
  const starsCount = parseCountValue(payload.starsCount ?? payload.stars);
  const forksCount = parseCountValue(payload.forksCount ?? payload.forks);
  const stars = payload.stars || formatCountDisplay(starsCount);
  const forks = payload.forks || formatCountDisplay(forksCount);

  let level = "unknown";
  if (starsCount !== null) {
    if (starsCount >= 10000) {
      level = "high";
    } else if (starsCount >= 1000) {
      level = "medium";
    } else {
      level = "low";
    }
  }

  return {
    stars,
    forks,
    level
  };
}

function buildProjectStatus(payload, language) {
  const zh = isZhLanguage(language);
  if (payload.isArchived) {
    return {
      label: "archived",
      description: zh ? "仓库已归档，不建议作为主要活跃项目使用。" : "Repository is archived and not recommended as a primary active project."
    };
  }

  if (!payload.lastCommitAt) {
    return {
      label: "unknown",
      description: zh
        ? "缺少最近提交时间信息，无法可靠判断活跃度。"
        : "Recent commit timestamp is unavailable, so activity cannot be determined reliably."
    };
  }

  const lastCommitTime = Date.parse(payload.lastCommitAt);
  if (!Number.isFinite(lastCommitTime)) {
    return {
      label: "unknown",
      description: zh
        ? "缺少最近提交时间信息，无法可靠判断活跃度。"
        : "Recent commit timestamp is unavailable, so activity cannot be determined reliably."
    };
  }

  const days = Math.floor((Date.now() - lastCommitTime) / (1000 * 60 * 60 * 24));
  if (days <= 30) {
    return {
      label: "active",
      description: zh ? "最近仍有提交，仓库看起来处于积极维护状态。" : "Recent commits indicate the repository is actively maintained."
    };
  }
  if (days <= 180) {
    return {
      label: "moderate",
      description: zh ? "项目近期有更新，但频率相对一般。" : "The project has updates, but not very frequently in recent months."
    };
  }
  return {
    label: "low_activity",
    description: zh ? "较长时间无明显更新，项目活跃度偏低。" : "No clear recent updates for a long period, so activity appears low."
  };
}

function includeTechIfFound(items, text, keyword, stackName) {
  if (text.includes(keyword)) {
    uniquePush(items, stackName);
  }
}

function buildTechStack(payload, requirements) {
  const stack = [];
  const readmeLower = normalizeText(payload.readmeText);
  const topicLower = normalizeText((payload.topics || []).join(" "));
  const languageLower = normalizeText((payload.languages || []).join(" "));

  if (hasProjectFile(payload, "package.json")) uniquePush(stack, "Node.js");
  if (hasProjectFile(payload, "tsconfig.json")) uniquePush(stack, "TypeScript");
  if (hasProjectFile(payload, "requirements.txt") || hasProjectFile(payload, "pyproject.toml")) uniquePush(stack, "Python");
  if (hasProjectFile(payload, "cargo.toml")) uniquePush(stack, "Rust");
  if (hasProjectFile(payload, "go.mod")) uniquePush(stack, "Go");
  if (hasProjectFile(payload, "pom.xml") || hasProjectFile(payload, "build.gradle")) uniquePush(stack, "Java");
  if (hasProjectFile(payload, "dockerfile") || hasProjectFile(payload, "docker-compose.yml")) uniquePush(stack, "Docker");

  TECH_README_KEYWORDS.forEach(({ needle, stack: stackName }) => {
    if (readmeLower.includes(needle) || topicLower.includes(needle.replace(".js", ""))) {
      uniquePush(stack, stackName);
    }
  });

  includeTechIfFound(stack, languageLower, "typescript", "TypeScript");
  includeTechIfFound(stack, languageLower, "javascript", "Node.js");
  includeTechIfFound(stack, languageLower, "python", "Python");
  includeTechIfFound(stack, languageLower, "go", "Go");
  includeTechIfFound(stack, languageLower, "java", "Java");
  includeTechIfFound(stack, languageLower, "rust", "Rust");

  requirements.forEach((item) => {
    if (item === "Node.js" || item === "Python" || item === "Docker" || item === "Java" || item === "Go") {
      uniquePush(stack, item);
    }
  });

  return stack.slice(0, 6);
}

function buildBestFor(repoType, techStack, payload, language) {
  const zh = isZhLanguage(language);
  const items = [];
  const lowerTopics = normalizeText((payload.topics || []).join(" "));
  const hasAny = (names) => names.some((name) => techStack.includes(name));

  if (repoType === REPO_TYPES.RUNNABLE) {
    uniquePush(items, zh ? "希望快速运行并评估完整项目的开发者。" : "Developers who want to quickly run and evaluate a complete project.");
  } else if (repoType === REPO_TYPES.LIBRARY) {
    uniquePush(items, zh ? "需要将可复用能力集成到现有系统的团队。" : "Teams that need to integrate reusable capability into existing systems.");
  } else if (repoType === REPO_TYPES.TEMPLATE) {
    uniquePush(items, zh ? "希望用脚手架快速启动新项目的开发者。" : "Developers who want a starter scaffold to bootstrap new projects.");
  } else {
    uniquePush(items, zh ? "跟踪上游变更或研究历史实现的工程师。" : "Engineers tracking upstream changes or studying historical implementation.");
  }

  if (hasAny(["React", "Next.js", "Vue", "PWA", "Electron"])) {
    uniquePush(items, zh ? "学习前端架构与交付模式的开发者。" : "Frontend developers learning practical app architecture and delivery patterns.");
  }
  if (hasAny(["FastAPI", "Flask", "Express", "Spring Boot"])) {
    uniquePush(items, zh ? "构建 API 或服务化应用的后端开发者。" : "Backend developers building APIs or service-oriented applications.");
  }
  if (techStack.includes("Docker")) {
    uniquePush(items, zh ? "偏好容器化、本地可复现环境的团队。" : "Teams that prefer reproducible local setup with containerized environments.");
  }
  if (lowerTopics.includes("ai") || lowerTopics.includes("llm") || lowerTopics.includes("agent")) {
    uniquePush(items, zh ? "探索 AI 工作流或 LLM 产品模式的开发者。" : "Developers exploring AI-assisted workflows or LLM-powered product patterns.");
  }

  while (items.length < 2) {
    uniquePush(items, zh ? "希望在深入阅读前先获得紧凑参考信息的开发者。" : "Developers who want a compact reference before deeper repository review.");
  }

  return items.slice(0, 4);
}

function buildRepoInsight(payload, repoType, requirements, language) {
  const techStack = buildTechStack(payload, requirements);
  return {
    projectStatus: buildProjectStatus(payload, language),
    popularity: buildPopularity(payload),
    techStack,
    bestFor: buildBestFor(repoType, techStack, payload, language)
  };
}

function decideRepoType(payload, signal) {
  if (payload.isFork || payload.isArchived) {
    return REPO_TYPES.SPECIAL;
  }

  const readme = normalizeText(payload.readmeText);
  const description = normalizeText(payload.description);
  const topics = normalizeText((payload.topics || []).join(" "));
  const files = normalizeText((payload.fileHints || []).join(" "));
  const combined = `${readme} ${description} ${topics} ${files}`;

  const templateScore = countMatches(combined, TEMPLATE_KEYWORDS);
  if (templateScore > 0) {
    return REPO_TYPES.TEMPLATE;
  }

  const libraryScore = countMatches(combined, LIBRARY_KEYWORDS);
  const runScore = countMatches(readme, RUN_KEYWORDS) + countMatches(readme, RUN_COMMANDS);
  const hasRuntimeFile =
    hasProjectFile(payload, "package.json") ||
    hasProjectFile(payload, "requirements.txt") ||
    hasProjectFile(payload, "pyproject.toml") ||
    hasProjectFile(payload, "pom.xml") ||
    hasProjectFile(payload, "go.mod") ||
    hasProjectFile(payload, "cargo.toml") ||
    hasProjectFile(payload, "docker-compose.yml") ||
    hasProjectFile(payload, "dockerfile");

  if (signal.startCommand && (runScore >= 1 || hasRuntimeFile)) {
    return REPO_TYPES.RUNNABLE;
  }

  const onlyPackageJsonHint =
    hasProjectFile(payload, "package.json") &&
    !hasProjectFile(payload, "dockerfile") &&
    !hasProjectFile(payload, "docker-compose.yml") &&
    !hasProjectFile(payload, "makefile");

  if (libraryScore >= 2 || (libraryScore > 0 && onlyPackageJsonHint && !signal.startCommand)) {
    return REPO_TYPES.LIBRARY;
  }

  if (runScore >= 2 && hasRuntimeFile) {
    return REPO_TYPES.RUNNABLE;
  }

  return REPO_TYPES.LIBRARY;
}

function analyzeRepoRuleBased(payload, languageContext = { configured: "auto", resolved: "en", detected: "" }) {
  const resolvedLanguage = normalizeResolvedLanguage(languageContext.resolved);
  const signal = detectCommandSignals(payload);
  const repoType = decideRepoType(payload, signal);
  const inferredRequirements = detectRequirements(payload, signal);
  const quickStart = repoType === REPO_TYPES.RUNNABLE ? buildQuickStart(payload, signal, resolvedLanguage) : emptyQuickStart();
  const whatThisRepoIs = buildWhatThisRepoIs(payload, repoType, inferredRequirements, resolvedLanguage);
  const repoInsight = buildRepoInsight(payload, repoType, inferredRequirements, resolvedLanguage);
  const problemSolved =
    repoType === REPO_TYPES.RUNNABLE ? { available: false, text: "" } : buildProblemSolved(repoType, payload, resolvedLanguage);

  // Expose source on every major block so popup can render provenance without guessing.
  return {
    repoType: {
      value: repoType,
      source: RESULT_SOURCES.RULE_BASED
    },
    whatThisRepoIs: {
      text: whatThisRepoIs,
      source: RESULT_SOURCES.RULE_BASED
    },
    readmeTldr: {
      items: buildReadmeTldr(payload, repoType, signal, inferredRequirements, resolvedLanguage),
      source: RESULT_SOURCES.RULE_BASED
    },
    quickStart: {
      ...quickStart,
      source: RESULT_SOURCES.RULE_BASED
    },
    problemSolved: {
      ...problemSolved,
      source: RESULT_SOURCES.RULE_BASED
    },
    repoInsight: {
      ...repoInsight,
      source: RESULT_SOURCES.RULE_BASED
    },
    language: {
      configured: normalizeLanguageChoice(languageContext.configured),
      resolved: resolvedLanguage,
      detected: (languageContext.detected || "").toString()
    }
  };
}

function normalizeAiList(value, min, max) {
  const items = (Array.isArray(value) ? value : [])
    .map((item) => (item || "").toString().trim())
    .filter(Boolean);
  if (items.length < min) {
    return [];
  }
  return items.slice(0, max);
}

function buildReadmeExcerpt(readmeText) {
  return (readmeText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}

// Build structured facts first; AI only rewrites selected language fields from these facts.
function buildRepoFactsForAi(payload, ruleBasedResult, resolvedLanguage) {
  const signal = detectCommandSignals(payload);
  const requirements = detectRequirements(payload, signal);
  const insight = ruleBasedResult.repoInsight || {};
  const popularity = insight.popularity || {};
  const projectStatus = insight.projectStatus || {};
  const repoTypeValue = (ruleBasedResult.repoType?.value || "").toString();
  const quickStart = ruleBasedResult.quickStart || {};
  const readmeTldr = ruleBasedResult.readmeTldr || {};

  return {
    repoName: payload.repoName || "",
    description: payload.description || "",
    topics: Array.isArray(payload.topics) ? payload.topics.slice(0, 12) : [],
    repoType: repoTypeValue,
    isFork: !!payload.isFork,
    isArchived: !!payload.isArchived,
    stars: popularity.stars || payload.stars || "",
    forks: popularity.forks || payload.forks || "",
    projectStatus: projectStatus.label || "unknown",
    techStack: Array.isArray(insight.techStack) ? insight.techStack.slice(0, 8) : [],
    requirements,
    needsEnv: !!signal.hasEnvSignal,
    quickStartFacts: {
      installCommands: signal.installCommand ? [signal.installCommand] : [],
      runCommands: signal.startCommand ? [signal.startCommand] : [],
      notes: Array.isArray(quickStart.notes) ? quickStart.notes.slice(0, 6) : []
    },
    readmeKeyPoints: Array.isArray(readmeTldr.items) ? readmeTldr.items.slice(0, 5) : [],
    readmeTextExcerpt: buildReadmeExcerpt(payload.readmeText),
    outputLanguage: normalizeResolvedLanguage(resolvedLanguage)
  };
}

function cloneResult(result) {
  if (typeof structuredClone === "function") {
    return structuredClone(result);
  }
  return JSON.parse(JSON.stringify(result));
}

function mergeRuleAndAiResult(ruleBasedResult, aiData) {
  const merged = cloneResult(ruleBasedResult);
  if (!aiData || typeof aiData !== "object") {
    return merged;
  }

  const aiWhatThisRepoIs = (aiData.whatThisRepoIs || "").toString().trim();
  if (aiWhatThisRepoIs) {
    merged.whatThisRepoIs.text = aiWhatThisRepoIs;
    merged.whatThisRepoIs.source = RESULT_SOURCES.AI_GENERATED;
  }

  const aiReadmeTldr = normalizeAiList(aiData.readmeTldr, 3, 5);
  if (aiReadmeTldr.length >= 3) {
    merged.readmeTldr.items = aiReadmeTldr;
    merged.readmeTldr.source = RESULT_SOURCES.AI_ENHANCED;
  }

  const aiBestFor = normalizeAiList(aiData.bestFor, 2, 4);
  if (aiBestFor.length >= 2 && merged.repoInsight && typeof merged.repoInsight === "object") {
    merged.repoInsight.bestFor = aiBestFor;
    merged.repoInsight.source = RESULT_SOURCES.AI_ENHANCED;
  }

  const aiProblemSolved = (aiData.problemSolved || "").toString().trim();
  if (aiProblemSolved && merged.problemSolved?.available) {
    merged.problemSolved.text = aiProblemSolved;
    merged.problemSolved.source = RESULT_SOURCES.AI_GENERATED;
  }

  return merged;
}

function markAiFallbackSources(ruleBasedResult) {
  const fallbackResult = cloneResult(ruleBasedResult);

  // These blocks are designed to be AI-driven; when AI is unavailable we keep rule text but mark fallback.
  if (fallbackResult.whatThisRepoIs && typeof fallbackResult.whatThisRepoIs === "object") {
    fallbackResult.whatThisRepoIs.source = RESULT_SOURCES.FALLBACK;
  }
  if (fallbackResult.readmeTldr && typeof fallbackResult.readmeTldr === "object") {
    fallbackResult.readmeTldr.source = RESULT_SOURCES.FALLBACK;
  }
  if (fallbackResult.problemSolved?.available && typeof fallbackResult.problemSolved === "object") {
    fallbackResult.problemSolved.source = RESULT_SOURCES.FALLBACK;
  }

  return fallbackResult;
}

const AI_NON_ERROR_REASONS = new Set([
  "AI_DISABLED",
  "MISSING_API_KEY",
  "MISSING_BASE_URL",
  "BASE_URL_INVALID",
  "MISSING_MODEL",
  "MODEL_NOT_SUPPORTED",
  "PROVIDER_COMPATIBILITY_LIMITED"
]);

function shouldMarkAiError(reason) {
  return !!reason && !AI_NON_ERROR_REASONS.has(reason);
}

async function markAiSuccess() {
  const store = self.AiSettingsStore;
  if (!store || typeof store.updateRuntimeState !== "function") {
    return;
  }

  await store.updateRuntimeState({
    lastError: "",
    lastErrorAt: 0,
    lastSuccessAt: Date.now()
  });
}

async function markAiError(reason) {
  const store = self.AiSettingsStore;
  if (!store || typeof store.updateRuntimeState !== "function") {
    return;
  }

  await store.updateRuntimeState({
    lastError: reason || "AI_REQUEST_FAILED",
    lastErrorAt: Date.now()
  });
}

async function analyzeRepo(payload) {
  const languageContext = await resolveLanguageContext(payload);
  const ruleBasedResult = analyzeRepoRuleBased(payload, languageContext);
  const enhancer = self.RepoAiEnhancer;
  if (!enhancer || typeof enhancer.enhanceRepoText !== "function") {
    return markAiFallbackSources(ruleBasedResult);
  }

  const facts = buildRepoFactsForAi(payload, ruleBasedResult, languageContext.resolved);
  const aiOutcome = await enhancer.enhanceRepoText(facts, { language: languageContext.resolved });
  if (!aiOutcome?.ok || !aiOutcome.data) {
    // Keep popup status stable when analysis falls back to rules.
    // Runtime error state is reserved for explicit connection-test failures.
    return markAiFallbackSources(ruleBasedResult);
  }

  await markAiSuccess();
  return mergeRuleAndAiResult(ruleBasedResult, aiOutcome.data);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "AI_TEST_CONNECTION") {
    (async () => {
      try {
        const enhancer = self.RepoAiEnhancer;
        if (!enhancer || typeof enhancer.testConnection !== "function") {
          sendResponse({ ok: false, reason: "AI_MODULE_UNAVAILABLE" });
          return;
        }

        const result = await enhancer.testConnection(message.config || {});
        if (result.ok) {
          await markAiSuccess();
          sendResponse({ ok: true });
          return;
        }

        if (shouldMarkAiError(result.reason)) {
          await markAiError(result.reason);
        }
        sendResponse({ ok: false, reason: result.reason || "AI_TEST_FAILED", details: result.details || "" });
      } catch (_error) {
        await markAiError("AI_TEST_FAILED");
        sendResponse({ ok: false, reason: "AI_TEST_FAILED" });
      }
    })();
    return true;
  }

  if (message?.type === "ANALYZE_REPO") {
    (async () => {
      try {
        const payload = message.payload || {};
        const result = await analyzeRepo(payload);
        sendResponse({ ok: true, result });
      } catch (_error) {
        try {
          const payload = message.payload || {};
          const languageContext = {
            configured: "auto",
            resolved: resolveOutputLanguage("auto", payload),
            detected: detectRepoLanguage(payload) || ""
          };
          const fallback = markAiFallbackSources(analyzeRepoRuleBased(payload, languageContext));
          sendResponse({ ok: true, result: fallback });
        } catch (_innerError) {
          sendResponse({ ok: false, error: "ANALYZE_FAILED" });
        }
      }
    })();
    return true;
  }
});
