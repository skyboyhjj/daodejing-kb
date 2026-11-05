# 道德经亲子体验营知识库（daodejing-kb）

面向亲子共读《道德经》的静态知识站，内置「慧惠」AI 分层解读聊天组件。

- 在线访问（主）：<https://hui-skill.org>（Cloudflare Pages）

## 功能特性

- **81 章原文古版展示**：古版 · 竖排（繁体）⇄ 今文 · 横排（简体）即时切换，`writing-mode: vertical-rl` 从右向左铺列
- **五步协同读解**：每章「文本细读 → 概念拆解 → 生活应用 → 亲子对话 → 跨章验证」
- **L1-L4 认知分层**：大白话版 / 精读版 / 应用版 / 学术版，适配不同认知水平
- **慧惠 AI 聊天**：DeepSeek 代理，按当前认知层级生成差异化解读
- **全文检索**：章节关键字全文搜索
- **SkillUP 认知成长追踪**：水滴 → 溪流 → 江河 → 江海的水德成长模型
- **亲子时光**：亲子共读互动与进度记录
- **水墨道风设计**：墨绿 / 淡金 / 宣纸配色，克制典雅

## 技术栈

- 纯静态 HTML / CSS / 原生 JS（无前端构建工具）
- Node.js ≥ 16 运维工具链（脚本见 `scripts/`）
- Serverless Functions：`api/`（Vercel）+ `functions/`（Cloudflare Pages）
- 数据存储：用户数据全部 localStorage，零服务端（详见 AGENTS.md 宪法约束）

## 目录结构

```
daodejing-kb/
├── index.html           首页
├── chapters/            81 章章节页（ch01.html ~ ch81.html）
├── concepts/            概念索引
├── paths/               阅读路径
├── js/                  前端模块（聊天 / 竖排 / 搜索 / SkillUP / 亲子）
├── css/                 样式（水墨道风 / 竖排 / 聊天 / 亲子）
├── api/                 Vercel Serverless Functions（DeepSeek 代理）
├── functions/           Cloudflare Pages Functions
├── scripts/             自动化工具链（含简繁映射生成 / 校验 / 索引构建）
├── docs/                设计文档
├── data/                数据目录
├── server.js            本地开发服务器
├── AGENTS.md            AI 助手指南（项目约定与预读规则）
└── PROJECT_CONTEXT.md   项目上下文（关键文件 / 部署 / 已完成 / 待办）
```

## 快速开始（本地开发）

```bash
# 1. 准备环境变量
cp .env.example .env   # Windows: copy .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY（聊天功能必填）

# 2. 启动本地开发服务器（默认 http://localhost:8080）
node server.js
```

浏览器访问 `http://localhost:8080` 即可。聊天功能需要有效的 `DEEPSEEK_API_KEY`，其余静态功能不依赖 Key。

## 环境变量

| 变量 | 必填 | 说明 |
|------|:---:|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key，聊天组件后端代理使用 |
| `RESEND_API_KEY` | ❌ | Resend 邮件 Key，用户反馈邮件转发用 |
| `PORT` | ❌ | 本地服务器端口，默认 8080 |

## 部署

静态站点部署于 Cloudflare Pages，推送代码即自动发布。

```bash
git push   # 触发自动部署；或 npx wrangler pages deploy .
```

在 Cloudflare Pages 项目设置中配置环境变量 `DEEPSEEK_API_KEY`。

> 前端统一使用相对路径 `API_URL = '/api/chat'`，聊天请求由 Cloudflare Pages Function（`functions/api/chat.js`）代理，无需额外配置。

## 古版竖排与简繁转换

- 竖排古版**运行时简→繁**（繁体楷体），今文横排**保持原文简体**，切换状态经 localStorage 记忆。
- 简繁映射数据 `js/s2t-data.js` 由脚本自动生成，**勿手改**。
- 改动 `chapters/*.html` 原文后须复查繁体映射：

```bash
npm run s2t:check   # 检查新增未审核的字
npm run s2t:accept  # 确认同形字
npm run s2t         # 重新生成映射数据
```

## 质量检查

```bash
npm run ci             # 完整质量流水线（校验 + 索引 + 元数据 + 测试）
npm run validate       # 章节结构验证
npm run build:index    # 构建搜索索引
npm run s2t:check      # 简繁映射复查
```

## 相关文档

- [AGENTS.md](./AGENTS.md) — AI 助手指南（项目约定、文档预读规则、自检清单）
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — 项目上下文（关键文件、部署、已完成/待办）
- `docs/` — 完整设计文档（部署、认知分层、聊天组件、SkillUP、亲子时光等）