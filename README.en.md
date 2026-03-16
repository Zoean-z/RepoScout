# RepoScout

[English](README.en.md) | [中文](README.md)

RepoScout is a Chrome extension that analyzes GitHub repository homepages and shows structured insights in one click.  
It combines a rule-based analyzer with optional AI enhancement to help you quickly understand what a repo is, how to run it, and who it is for.

## Features

- One-click analysis on GitHub repository homepages
- Repository type detection
  - `Runnable Project`
  - `Library Package`
  - `Template / Example`
  - `Fork / Special`
- Structured output
  - What This Repo Is
  - README TL;DR
  - Repo Insight (activity, popularity, tech stack, target users)
  - Quick Start (steps, requirements, notes)
  - Solves What Problem
- Optional AI enhancement
  - Multiple provider presets (OpenAI / Anthropic / Gemini / DeepSeek / Qwen / Zhipu / Moonshot / Custom)
  - Field-level source badges (Rule-based / AI-generated / AI-enhanced / Fallback)
- Local analysis cache
  - Stores up to 80 recent results by `owner/repo`

## Installation (Developer Mode)

1. Get the source code (choose one)
   - Download the repository ZIP and extract it
   - `git clone https://github.com/Zoean-z/RepoScout.git`
2. Open the extension page in Chrome or Edge
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project directory that contains `manifest.json`
6. Open any GitHub repo homepage and click the extension icon

## Usage

1. Open a GitHub repository homepage (for example `https://github.com/owner/repo`)
2. Click the extension icon to run analysis
3. Click `Reanalyze` to refresh
4. Open Settings if you want AI-enhanced output

## AI Configuration

In the options page, you can configure:

- `Provider`
- `Model` (or custom model)
- `API Key`
- `Output Language` (`auto` / `zh` / `en`)
- `Base URL` (for custom compatible APIs)

Notes:

- If AI is disabled or not fully configured, the extension falls back to rule-based analysis
- Some compatibility providers may require provider-specific routing or settings
- Moonshot has a higher minimum timeout handled in code

## Permissions and Privacy

Main permissions in `manifest.json`:

- `activeTab` / `tabs`: read the active tab and communicate with content scripts
- `storage`: store AI config, runtime status, and local analysis cache
- `https://github.com/*`: collect repository page data
- `https://api.openai.com/*`: default AI endpoint domain (custom base URL is user-configurable)

Data handling:

- Rule-based analysis runs locally
- Repository facts are sent to an AI provider only when AI is enabled and configured
- Config and cache are stored in `chrome.storage.local`

## Project Structure

- `manifest.json`: Chrome Extension Manifest V3 config
- `content.js`: collects structured data from GitHub repo pages (README, stars/forks, languages, file hints, etc.)
- `background.js`: rule-based analyzer, AI merge logic, and runtime message routing
- `repo-ai-enhancer.js`: AI request wrapper (Responses / Chat Completions compatibility)
- `ai-settings.js`: AI config store and normalization
- `provider-presets.js`: provider/model presets
- `popup.*`: popup UI and result rendering
- `options.*`: settings UI and connection test
- `i18n.js`: Chinese/English messages and language resolution

## Local Development

This project uses plain JS/HTML/CSS and does not require a build step.

Recommended workflow:

1. Edit files
2. Click **Refresh** on the extensions page (Chrome: `chrome://extensions/`, Edge: `edge://extensions/`)
3. Validate behavior on a GitHub repo homepage
4. Use `Test Connection` in settings to verify AI connectivity

## Troubleshooting

- Works only on GitHub repository homepages  
  URL should match `https://github.com/{owner}/{repo}`

- "Page data temporarily unavailable"  
  Refresh the current GitHub page and try again

- AI connection failed  
  Check API key, base URL, and model; run `Test Connection` in settings first

- Result appears non-AI  
  It may be a fallback path; check source badges (Fallback / Rule-based)
