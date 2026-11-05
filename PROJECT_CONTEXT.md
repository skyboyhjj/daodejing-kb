# daodejing-kb 项目上下文
## 项目概述
**道德经亲子体验营知识库（daodejing-kb）** — 面向亲子共读《道德经》的静态知识站，内置「慧惠」AI 分层解读聊天组件。
- [hui-skill.org](https://hui-skill.org) — Cloudflare Pages（主入口）
- [huihui-skill.org](https://huihui-skill.org) — Vercel（备用/历史）

核心特色：81 章原文古版竖排展示、五步读解、L1-L4 认知分层、慧惠 AI 聊天、SkillUP 认知成长追踪、亲子时光。

## 关键文件
| 文件 | 用途 |
|------|------|
| `index.html` | 首页 |
| `chapters/ch01.html` ~ `ch81.html` | 81 章章节页（五步读解 + L1-L4 分层 + 古版竖排） |
| `chapters.html` | 章节索引 |
| `js/huihui-chat.js` | 慧惠聊天组件前端（IIFE，DOM 注入，L1-L4 层级按钮） |
| `css/huihui-chat.css` | 聊天组件样式（水墨道风配色） |
| `api/chat.js` | Vercel Serverless Function — DeepSeek 代理 |
| `functions/api/chat.js` | Cloudflare Pages Function — DeepSeek 代理 |
| `api/family_chat.js` / `functions/api/family_chat.js` | 亲子对话（DeepSeek 代理） |
| `api/family_progress.js` | 亲子进度 |
| `functions/api/metadata-version.js` | 元数据版本 |
| `js/original-vintage.js` | 古版竖排外挂（竖排⇄横排切换，运行时简→繁） |
| `css/original-vintage.css` | 古版竖排样式 |
| `js/s2t-data.js` | 简繁映射数据（**自动生成，勿手改**） |
| `scripts/make-s2t-data.js` | 简繁映射的生成/检查脚本（数据源） |
| `scripts/s2t-known-same.txt` | 同形字（简繁相同）快照 |
| `js/level-filter.js` | 认知层级（L1-L4）筛选 |
| `js/search.js` | 全文搜索 |
| `js/skillup-tracker.js` / `skillup-ui.js` / `skillup-consent.js` | SkillUP 认知成长追踪 |
| `js/family.js` / `css/family.css` | 亲子时光 |
| `js/kongmen-map.js` / `css/kongmen-map.css` | 空门地图 |
| `js/memorial-512.js` / `css/memorial-512.css` | 5·12 纪念功能 |
| `css/daodejing-styles.css` | 全站主样式 |
| `server.js` | 本地开发服务器（静态 + /api/chat 代理） |
| `docs/` | 设计文档（见 AGENTS.md 预读规则） |
| `scripts/` | 自动化运维工具链（见 package.json scripts） |

## 部署命令
### Vercel（huihui-skill.org，备用/灰度先行）
```bash
cd daodejing-kb
vercel --prod
```
### Cloudflare Pages（hui-skill.org，主入口）
```bash
git push   # 触发 Cloudflare Pages 自动部署
# 或手动：
npx wrangler pages deploy .
```
分级发布流程：**Vercel 先行灰度验证 → 稳定后同步 Cloudflare Pages 生产入口**。

## 站点架构
双平台共用同一套代码，`API_URL = '/api/chat'` 相对路径两端自动适配：
```
                 GitHub: daodejing-kb
                          │ git push
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
 Cloudflare Pages                      Vercel
  静态: 根目录                           静态: 根目录
  API:  functions/api/*.js              API:  api/*.js
  🌐 hui-skill.org                      🌐 huihui-skill.org
```

## API 架构
- 聊天：`POST /api/chat`（body `{ messages, level }`）→ DeepSeek `deepseek-chat`，L1-L4 分层 System Prompt
- 亲子对话：`POST /api/family_chat`
- 亲子进度：`api/family_progress.js`
- 元数据版本：`functions/api/metadata-version.js`
- 安全：`DEEPSEEK_API_KEY` 仅存平台环境变量，前端无 Token

## 简体→繁体（古版竖排）
- 竖排古版**运行时简→繁**，今文横排**保持原文简体**（外挂增强，localStorage 记忆，零服务端）
- `js/s2t-data.js` 自动生成（约 253 对差异字 + 「不谷→不穀」词组特例，二义字按王弼本语境定字）
- 数据源：`scripts/make-s2t-data.js`（MAP）+ `scripts/s2t-known-same.txt`（同形快照）

### 改动原文后的复查流程（必须执行）
改动了 `chapters/*.html` 中 `<div class="original-text">` 的原文后：
1. `npm run s2t:check` — 检查「新增未审核」的字
2. 有新增字 → 简体转繁体补进 `make-s2t-data.js` 的 MAP；同形字执行 `npm run s2t:accept`
3. `npm run s2t` — 重新生成 `js/s2t-data.js` 并核验第一章预览

## 分支管理
`main` 单分支开发，无 master/main 拆分。提交前遵循「版本控制约定」。

## 版本控制约定
每次提交前：
1. 读取 `PROJECT_CONTEXT.md`，与本地实际状态比较
2. 如有冲突（文件缺失、接口变更、架构调整），提示用户处理
3. 无冲突则提交，提交后更新 `PROJECT_CONTEXT.md` 相关条目

## 待办 / 已完成 工作流
- 新任务 → 先加入 **待办** 列表
- 完成 → 移入 **已完成**，标注编号、根因/修复/文件
- 更新 `PROJECT_CONTEXT.md` 时检查待办中是否有已完成项一体移动

## 已完成
### 1. 古版竖排展示（外挂增强）
- **实现**：`writing-mode: vertical-rl` 从右向左铺列；「古版·竖排 ⇄ 今文·横排」切换，localStorage 记忆
- **文件**：`js/original-vintage.js`、`css/original-vintage.css`、`scripts/inject-original-vintage.js`

### 2. 竖排繁体转换
- **实现**：竖排视图运行时简→繁，253 对差异字 + 「不谷→不穀」特例；二义字（后/发/复/谷/不谷 等）按王弼本语境定字；横排原文保持简体
- **文件**：`js/s2t-data.js`（生成）、`scripts/make-s2t-data.js`（源）、`js/original-vintage.js`（接入）

### 3. 简繁检查流程固化
- **实现**：`make-s2t-data.js` 三模式（生成 / `--check` / `--accept-same`）+ 同形字快照 `s2t-known-same.txt`；新增 npm scripts `s2t` / `s2t:check` / `s2t:accept`
- **文件**：`scripts/make-s2t-data.js`、`scripts/s2t-known-same.txt`、`package.json`、`AGENTS.md`（第六节）

## 待办
- 同步 Cloudflare Pages：本次古版竖排 + 繁体转换改动尚未 `git commit` + `push`（待用户批准）

## 新对话快速启动
在新对话中引用此文件即可继续开发：
> "参考 PROJECT_CONTEXT.md 继续开发 daodejing-kb"