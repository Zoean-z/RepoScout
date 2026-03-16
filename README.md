# RepoScout

[中文](README.md) | [English](README.en.md)

RepoScout 是一个 Chrome 扩展，用于在 GitHub 仓库主页快速生成结构化分析结果。  
它结合规则引擎和可选 AI 增强，帮助你更快判断一个仓库是什么、怎么启动、适合谁使用。

## 功能概览

- 仓库主页一键分析（仅 GitHub 仓库主页）
- 自动识别仓库类型
  - `Runnable Project`
  - `Library Package`
  - `Template / Example`
  - `Fork / Special`
- 输出结构化信息
  - What This Repo Is
  - README TL;DR
  - Repo Insight（项目活跃度、受欢迎程度、技术栈、适用人群）
  - Quick Start（步骤/依赖/注意事项）
  - Solves What Problem
- AI 增强（可开关）
  - 支持多 Provider 预设（OpenAI / Anthropic / Gemini / DeepSeek / Qwen / Zhipu / Moonshot / Custom）
  - 字段来源可见（Rule-based / AI-generated / AI-enhanced / Fallback）
- 分析缓存
  - 按 `owner/repo` 缓存最近结果（本地最多保留 80 条）

## 安装方式（开发者模式）

1. 获取项目代码（任选一种）
   - 下载仓库
   - `git clone https://github.com/Zoean-z/RepoScout.git`
2. 打开浏览器扩展页（Chrome 或 Edge）
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 开启右上角“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择项目目录中app文件夹打开
6. 安装后打开任意 GitHub 仓库主页，点击扩展图标查看分析结果

## 使用说明

1. 打开一个 GitHub 仓库主页（例如 `https://github.com/owner/repo`）
2. 点击扩展图标，弹窗会自动分析
3. 如需刷新结果，点击 `Reanalyze`
4. 如需 AI 增强，打开弹窗中的设置页进行配置

## AI 配置

在设置页可以配置：

- `Provider`
- `Model`（或自定义模型）
- `API Key`
- `Output Language`（`auto` / `zh` / `en`）
- `Base URL`（自定义兼容接口时）

说明：

- AI 未开启或配置不完整时，扩展会自动回退到规则分析结果
- 某些兼容性 Provider 可能需要专用网关或参数适配
- Moonshot Provider 会使用更长超时下限（代码中有专门处理）

## 权限与隐私

`manifest.json` 中使用的主要权限：

- `activeTab` / `tabs`：读取当前活动页并与 content script 通信
- `storage`：保存 AI 配置、运行状态与分析缓存
- `https://github.com/*`：采集仓库页面信息
- `https://api.openai.com/*`：默认 AI 接口域名（自定义 Base URL 由用户在设置中决定）

数据处理说明：

- 页面采集数据在本地进行规则分析
- 仅当你启用并配置 AI 时，才会将“提炼后的仓库事实”发送到你配置的模型接口
- 配置和缓存保存在 `chrome.storage.local`

## 项目结构

- `manifest.json`：Chrome Extension Manifest V3 配置
- `content.js`：采集 GitHub 仓库主页结构化信息（README、stars/forks、语言、文件线索等）
- `background.js`：规则分析主引擎、AI 融合、消息路由
- `repo-ai-enhancer.js`：AI 请求封装（Responses / Chat Completions 兼容）
- `ai-settings.js`：AI 配置存储与规范化
- `provider-presets.js`：Provider 与模型预设
- `popup.*`：弹窗 UI 与结果渲染
- `options.*`：设置页 UI 与连接测试
- `i18n.js`：中英文文案与语言解析

## 本地开发

本项目为原生 JS/HTML/CSS，无需构建步骤。

推荐开发流程：

1. 修改代码
2. 在扩展页点击“刷新”（Chrome: `chrome://extensions/`，Edge: `edge://extensions/`）
3. 回到 GitHub 仓库主页验证行为
4. 通过设置页 `Test Connection` 验证 AI 接口可用性

## 常见问题

- 只能在 GitHub 仓库主页使用  
  需要 URL 形如 `https://github.com/{owner}/{repo}`，否则不会分析

- 提示页面数据暂不可用  
  刷新当前 GitHub 页面后重试

- AI 连接失败  
  检查 API Key、Base URL、Model 是否匹配；先在设置页执行 `Test Connection`

- 有结果但不是 AI 风格  
  可能触发了规则回退，查看各模块右侧来源标记（Fallback / Rule-based）
