(() => {
  const TARGET_FILES = new Set([
    "package.json",
    "tsconfig.json",
    "requirements.txt",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "cargo.toml",
    "go.mod",
    "dockerfile",
    "docker-compose.yml",
    "makefile",
    ".env.example"
  ]);

  function parsePathParts(pathname) {
    return pathname.split("/").filter(Boolean);
  }

  function isGithubRepoHome(urlString) {
    try {
      const url = new URL(urlString);
      if (url.hostname !== "github.com") {
        return false;
      }
      return parsePathParts(url.pathname).length === 2;
    } catch (_error) {
      return false;
    }
  }

  function getMetaContent(name) {
    const node = document.querySelector(`meta[name="${name}"]`);
    return node ? (node.getAttribute("content") || "").trim() : "";
  }

  function getDescription() {
    const domDescription = document.querySelector(
      '[data-testid="repository-description"], p.f4.my-3, p.f4.mt-3'
    );
    if (domDescription && domDescription.textContent) {
      return domDescription.textContent.trim();
    }

    const ogDescription = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content");
    return ogDescription ? ogDescription.trim() : "";
  }

  function getTopics() {
    const topicLinks = document.querySelectorAll('a[href*="/topics/"]');
    const topics = [];
    topicLinks.forEach((link) => {
      const text = (link.textContent || "").trim();
      if (text) {
        topics.push(text);
      }
    });
    return [...new Set(topics)];
  }

  function getReadmeText() {
    const readmeNode = document.querySelector(
      "#readme article, article.markdown-body, #readme"
    );
    if (!readmeNode) {
      return "";
    }

    const text = (readmeNode.innerText || "").trim();
    return text.slice(0, 20000);
  }

  function getReadmeCodeBlocks() {
    const codeNodes = document.querySelectorAll("#readme pre code, #readme pre");
    const blocks = [];

    codeNodes.forEach((node) => {
      const text = (node.innerText || node.textContent || "").trim();
      if (text) {
        blocks.push(text.slice(0, 1000));
      }
    });

    return blocks.slice(0, 20);
  }

  function extractCountToken(text) {
    if (!text) {
      return "";
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    const match = normalized.match(/(\d[\d,.]*\s*[kmb]?)/i);
    return match ? match[1].trim().replace(/\s+/g, "") : "";
  }

  function parseCountToken(token) {
    if (!token) {
      return null;
    }

    const lowered = token.toLowerCase();
    const suffix = lowered.endsWith("k") ? "k" : lowered.endsWith("m") ? "m" : lowered.endsWith("b") ? "b" : "";
    const numericText = suffix ? lowered.slice(0, -1) : lowered;
    const value = Number.parseFloat(numericText.replace(/,/g, ""));
    if (Number.isNaN(value)) {
      return null;
    }

    if (suffix === "k") return Math.round(value * 1000);
    if (suffix === "m") return Math.round(value * 1000000);
    if (suffix === "b") return Math.round(value * 1000000000);
    return Math.round(value);
  }

  function getMetricInfo(link) {
    if (!link) {
      return { text: "", count: null };
    }

    const candidates = [
      link.querySelector('[id*="counter"]')?.textContent || "",
      link.getAttribute("aria-label") || "",
      link.textContent || ""
    ];

    for (const candidate of candidates) {
      const token = extractCountToken(candidate);
      if (token) {
        return { text: token, count: parseCountToken(token) };
      }
    }

    return { text: "", count: null };
  }

  function getStarsAndForks(owner, repo) {
    const starsPath = `/${owner}/${repo}/stargazers`;
    const forksPath = `/${owner}/${repo}/forks`;

    const starsLink = document.querySelector(`a[href="${starsPath}"], a[href^="${starsPath}?"]`);
    const forksLink = document.querySelector(`a[href="${forksPath}"], a[href^="${forksPath}?"]`);

    return {
      stars: getMetricInfo(starsLink),
      forks: getMetricInfo(forksLink)
    };
  }

  function getLastCommitAt(owner, repo) {
    const latestCommit = document.querySelector('[data-testid="latest-commit"] relative-time[datetime]');
    if (latestCommit) {
      return latestCommit.getAttribute("datetime") || "";
    }

    const commitLink = document.querySelector(`a[href^="/${owner}/${repo}/commit/"]`);
    if (commitLink) {
      const container = commitLink.closest("div, li, article, section");
      const timeNode =
        (container && container.querySelector("relative-time[datetime], time-ago[datetime]")) ||
        document.querySelector(`a[href^="/${owner}/${repo}/commit/"] + relative-time[datetime]`);
      if (timeNode) {
        return timeNode.getAttribute("datetime") || "";
      }
    }

    return "";
  }

  function getLanguages() {
    const values = new Set();

    document
      .querySelectorAll('span[itemprop="programmingLanguage"], [data-testid="repository-language-bar"] a span')
      .forEach((node) => {
        const text = (node.textContent || "").trim();
        if (!text || /\d/.test(text) || text.length > 24) {
          return;
        }
        values.add(text);
      });

    return Array.from(values).slice(0, 6);
  }

  function getRootEntries(owner, repo) {
    const entries = new Set();
    const blobPrefix = `/${owner}/${repo}/blob/`;
    const treePrefix = `/${owner}/${repo}/tree/`;

    document.querySelectorAll("a[href]").forEach((link) => {
      const rawHref = link.getAttribute("href") || "";
      const href = rawHref.split("?")[0].split("#")[0];
      if (!href.startsWith(blobPrefix) && !href.startsWith(treePrefix)) {
        return;
      }

      const parts = href.split("/").filter(Boolean);
      if (parts.length !== 5) {
        return;
      }

      const name = decodeURIComponent(parts[4] || "").trim();
      if (name && !name.includes("/")) {
        entries.add(name);
      }
    });

    return Array.from(entries).slice(0, 120);
  }

  function getFileHints(owner, repo) {
    const hints = new Set();
    const prefixBlob = `/${owner}/${repo}/blob/`;
    const prefixTree = `/${owner}/${repo}/tree/`;

    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith(prefixBlob) && !href.startsWith(prefixTree)) {
        return;
      }

      const pathParts = href.split("/").filter(Boolean);
      const fileName = pathParts[pathParts.length - 1];
      if (!fileName) {
        return;
      }

      const normalized = fileName.toLowerCase();
      if (TARGET_FILES.has(normalized)) {
        hints.add(fileName);
      }
    });

    return Array.from(hints);
  }

  function collectRepoData() {
    if (!isGithubRepoHome(window.location.href)) {
      return { ok: false, error: "NOT_REPO_HOME" };
    }

    const url = new URL(window.location.href);
    const [owner, repo] = parsePathParts(url.pathname);
    const pageText = (document.body?.innerText || "").toLowerCase();
    const metrics = getStarsAndForks(owner, repo);

    const isForkByMeta = getMetaContent("octolytics-dimension-repository_is_fork") === "true";
    const isArchivedByMeta =
      getMetaContent("octolytics-dimension-repository_is_archived") === "true";

    return {
      ok: true,
      data: {
        owner,
        repo,
        repoName: `${owner}/${repo}`,
        description: getDescription(),
        topics: getTopics(),
        languages: getLanguages(),
        rootFiles: getRootEntries(owner, repo),
        stars: metrics.stars.text,
        starsCount: metrics.stars.count,
        forks: metrics.forks.text,
        forksCount: metrics.forks.count,
        lastCommitAt: getLastCommitAt(owner, repo),
        isFork: isForkByMeta || pageText.includes("forked from"),
        isArchived: isArchivedByMeta || pageText.includes("this repository was archived"),
        readmeText: getReadmeText(),
        readmeCodeBlocks: getReadmeCodeBlocks(),
        fileHints: getFileHints(owner, repo)
      }
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "COLLECT_REPO_DATA") {
      return;
    }

    try {
      sendResponse(collectRepoData());
    } catch (_error) {
      sendResponse({ ok: false, error: "EXTRACT_FAILED" });
    }
  });
})();
