# 元数据文件生命周期管理 — 实施开发计划

> **依据文档**: `docs/metadata-lifecycle-design.md`（v1.0） | **日期**: 2026-05-15
> **当前系统版本**: v1.4（81章已上线、AI修订器就绪、门控逻辑已优化）

---

## 一、当前系统状态与差距分析

### 1.1 模块完成度矩阵

| 设计书章节 | 模块                             | 完成度 | 状态                                         |
| ---------- | -------------------------------- | ------ | -------------------------------------------- |
| §1         | 元数据结构定义                   | 100%   | ✅ 所有字段、约束、子结构已实现               |
| §2         | 元数据创建流程 (extract_meta.py) | 100%   | ✅ 4种运行模式、跳过逻辑、字段验证完整        |
| §3         | 元数据审核流程 (状态机+控制台)   | 100%   | ✅ 状态机、软锁定、Article 11 检查表完整      |
| §4         | 元数据修订机制 (AI修订器)        | 100%   | ✅ 双路径（暂存/直接）、同步、diff视图完整    |
| §5         | 元数据存储架构 (文件+缓存)       | 85%    | ⚠️ 缺 `_public.json` 文件、消费者仍读敏感文件 |
| §6         | API 接口设计                     | 85%    | ⚠️ 缺 `/api/metadata/version` 端点            |
| §7         | 安全控制机制                     | 90%    | ⚠️ 敏感文件仍在 Git 中、未脱敏                |
| §8         | 版本控制与变更历史追踪           | 70%    | ⚠️ 三重标识未落地、build脚本未创建            |

### 1.2 已完成的实现（无需改动）

以下 16 项已完整实现并与设计书对齐，不在本次计划范围内：

| #   | 功能                                                                                                                   | 实现位置                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | 元数据 CRUD（load/save/validate/getStats/getChapterList/getChapterDetail/updateChapter/deleteChapter）                 | `api/_shared/metadata-store.js` (355行)                        |
| 2   | AI 修订器（reviseChapterToStaging/reviseChapterToProduction/syncStagingToProduction/getStagingData/removeFromStaging） | `api/_shared/metadata-reviser.js` (595行)                      |
| 3   | 初始提取脚本（extract_chapter_info/build_extraction_prompt/call_deepseek/parse_metadata_response）                     | `scripts/extract_meta.py` (500行)                              |
| 4   | 审核控制台（状态筛选/搜索/编辑面板/安全检查表/同步按钮）                                                               | `admin/family-review.html` + `admin/family-review.js` (1587行) |
| 5   | 状态机（6条合法转换 + 3条禁止路径）                                                                                    | `api/_shared/metadata-store.js:20`                             |
| 6   | 软锁定机制（reviewing时独占，423拒绝非所有者）                                                                         | `metadata-store.js:261` + `server.js:812`                      |
| 7   | 操作审计日志（appendHistory，含content_snapshot）                                                                      | `metadata-store.js:95`                                         |
| 8   | 删除保护（仅非approved可删除）                                                                                         | `metadata-store.js:332`                                        |
| 9   | Admin Bearer Token 认证                                                                                                | `server.js` checkAdminAuth()                                   |
| 10  | API 门控逻辑（pending + history.length > 0）                                                                           | 3个文件，已于2026-05-15实施                                    |
| 11  | 内容安全检查（Article 11 在 extract 和 revise prompt 中内嵌）                                                          | `extract_meta.py:196` + `metadata-reviser.js:196`              |
| 12  | 内存缓存层（metadata-store 5s + family_chat 24h）                                                                      | `metadata-store.js:15` + `api/family_chat.js:30`               |
| 13  | 暂存区文件结构与管理                                                                                                   | `data/family_metadata_staging.json`                            |
| 14  | 修订意见结构化解析（parseRevisionNotes 4维度提取）                                                                     | `metadata-reviser.js:282`                                      |
| 15  | 风格示例加载（取3个已通过章节作为AI示例）                                                                              | `metadata-reviser.js:111`                                      |
| 16  | DeepSeek API 调用（含 model 可切换、response_format: json_object）                                                     | `metadata-reviser.js:217` + `extract_meta.py:214`              |

### 1.3 差距清单（待实施）

以下 11 项在设计书中明确定义但尚未实现，按优先级排列：

| #   | 差距                                                  | 影响范围                                  | 严重程度              |
| --- | ----------------------------------------------------- | ----------------------------------------- | --------------------- |
| G1  | `family_metadata_public.json` 不存在                  | 前端 + API 消费者仍读取含审计数据的完整版 | **高** — 安全/隐私    |
| G2  | `build-public-metadata.js` 未创建                     | 无法自动生成脱敏版本                      | **高** — 流程断点     |
| G3  | `.gitignore` 未屏蔽 `family_metadata.json`            | 敏感审计数据可能被提交到 Git              | **高** — 安全/隐私    |
| G4  | 5个消费者仍读取 `family_metadata.json`                | 脱敏切换未完成                            | **高** — 阻断 G1 生效 |
| G5  | `/api/metadata/version` 端点未创建                    | 前端无法检测部署版本变化                  | 中 — 功能缺失         |
| G6  | `_format_version`/`_content_hash`/`_generated` 未落地 | 三重版本标识仅停留在设计                  | 中 — 功能缺失         |
| G7  | `--check` 模式未实现                                  | 无法在 CI/CD 中校验一致性                 | 中 — 运维缺失         |
| G8  | 前端无版本检测 + 缓存刷新逻辑                         | 部署更新后用户可能用旧缓存                | 中 — 用户体验         |
| G9  | 管理平台与公开网站未分离                              | 同仓分离方案仅设计未实施                  | 低 — 架构演进         |
| G10 | Cloudflare Pages 无管理 API                           | 仅本地 server.js 有完整管理端点           | 低 — 运维限制         |
| G11 | 无自动化回归测试                                      | 缺少对元数据质量的结构化测试              | 低 — 质量保障         |

---

## 二、分阶段实施路线图

### Phase 1：安全脱敏与交付加固（短期，5-7天）

**目标**: 消除所有安全/隐私差距，打通 `_public.json` 完整链路。

```
优先级：P0 — 必须完成，事关安全底线
```

#### 任务 1.1：创建 `scripts/build-public-metadata.js`

| 属性         | 内容                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **描述**     | 编写 Node.js 脚本，从完整版元数据构建脱敏公开版                                                                                                                                                                     |
| **输入**     | `data/family_metadata.json`（完整版）                                                                                                                                                                               |
| **输出**     | `data/family_metadata_public.json`（脱敏版）                                                                                                                                                                        |
| **关键逻辑** | ① 白名单字段过滤（移除 reviewed_by/reviewed_at/review_history）② 计算 content_hash（SHA-256 前8位，仅对 chapters 内容）③ 写入 _format_version/_content_hash/_generated ④ 支持 --check 模式（仅比对 hash，不写文件） |
| **参考实现** | `scripts/version-manifest.js`（已有 SHA-256 章节 hash 计算逻辑）                                                                                                                                                    |
| **预估行数** | ~80-100 行                                                                                                                                                                                                          |
| **交付物**   | `scripts/build-public-metadata.js`                                                                                                                                                                                  |

**白名单字段映射：**
```
完整版字段              公开版字段
──────────────         ──────────────
chapter          →     chapter        ✅ 保留
title            →     title          ✅ 保留
core_idea        →     core_idea      ✅ 保留
safety_notes     →     safety_notes   ✅ 保留
interaction_points →  interaction_points ✅ 保留
parent_tips      →     parent_tips    ✅ 保留
review_status    →     review_status  ✅ 保留
reviewed_by      →     ❌ 移除
reviewed_at      →     ❌ 移除
review_history   →     ❌ 移除
```

#### 任务 1.2：首次生成 `family_metadata_public.json`

| 属性       | 内容                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| **描述**   | 运行 build 脚本，生成首个脱敏版本                                                     |
| **命令**   | `node scripts/build-public-metadata.js`                                               |
| **验证**   | 检查输出文件不含 reviewed_by/reviewed_at/review_history 字段，验证 _content_hash 非空 |
| **交付物** | `data/family_metadata_public.json`                                                    |

#### 任务 1.3：更新 `.gitignore`

| 属性         | 内容                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| **描述**     | 确保敏感文件不入库                                                         |
| **文件**     | `.gitignore`                                                               |
| **新增规则** | `data/family_metadata.json`、`data/family_metadata_staging.json`           |
| **保留规则** | `data/family_metadata_public.json` 继续入库（生产部署需要）                |
| **注意事项** | 如果 `family_metadata.json` 已在 Git 历史中，需 `git rm --cached` 移除跟踪 |

#### 任务 1.4：切换消费者读取路径（5处修改）

| #   | 文件                              | 当前路径                     | 新路径                              | 行号 |
| --- | --------------------------------- | ---------------------------- | ----------------------------------- | ---- |
| 1   | `js/family.js`                    | `/data/family_metadata.json` | `/data/family_metadata_public.json` | 945  |
| 2   | `js/family.js`                    | `/data/family_metadata.json` | `/data/family_metadata_public.json` | 968  |
| 3   | `api/family_chat.js`              | `data/family_metadata.json`  | `data/family_metadata_public.json`  | 19   |
| 4   | `functions/api/family_chat.js`    | `/data/family_metadata.json` | `/data/family_metadata_public.json` | 15   |
| 5   | `server.js` (handleFamilyChatAPI) | `data/family_metadata.json`  | `data/family_metadata_public.json`  | ~530 |

**注意事项：**
- `api/family_chat.js` 使用 `__dirname` 相对路径，需确认编译后路径正确
- `functions/api/family_chat.js` 使用 `new URL()` 从 request.url 构建完整 URL
- `server.js` 使用 `path.join(__dirname, ...)` 本地路径
- `js/family.js` 使用 XMLHttpRequest 浏览器请求

#### 任务 1.5：本地 + 预览环境验证

| 属性         | 内容                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **描述**     | 全面测试脱敏切换后的功能                                                                                                                                                                                                          |
| **测试项目** | ① 本地开发服务器启动 → 亲子时光功能正常 ② Cloudflare Pages 预览 → API 调用正常 ③ 审核控制台仍读取完整版文件（不受影响）④ 检查浏览器 Network 面板：get 的是 `_public.json` ⑤ 确认响应中不含 reviewed_by/reviewed_at/review_history |
| **工具**     | `npx wrangler pages dev`（Cloudflare 本地预览）                                                                                                                                                                                   |

#### 任务 1.6：部署到 Vercel 生产环境

| 属性         | 内容                                |
| ------------ | ----------------------------------- |
| **描述**     | 生产部署脱敏版本                    |
| **前置条件** | Phase 1 验证全部通过                |
| **部署方式** | Vercel CLI 或 Git push 触发自动部署 |

#### Phase 1 风险清单

| 风险                                                       | 概率 | 影响 | 缓解措施                                                 |
| ---------------------------------------------------------- | ---- | ---- | -------------------------------------------------------- |
| `api/family_chat.js` 在 Vercel 编译后找不到 `_public.json` | 低   | 高   | 预先在 Vercel preview 环境验证                           |
| 切换路径后前端缓存仍指向旧文件                             | 中   | 中   | 清除浏览器缓存 + Service Worker 更新                     |
| `family_metadata.json` 已在 Git 历史中                     | 确认 | 中   | `git rm --cached` + 检查历史，必要时 `git filter-branch` |
| Cloudflare Pages 部署后未包含新文件                        | 低   | 中   | 确认 `_public.json` 在部署目录中                         |

---

### Phase 2：版本控制与监控完善（中期，2-3周）

**目标**: 落地三重版本标识，建立版本查询 API，实现前端版本感知与缓存刷新。

```
优先级：P1 — 重要基础设施，影响运维质量
```

#### 任务 2.1：创建 `GET /api/metadata/version` 端点（本地）

| 属性         | 内容                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| **描述**     | 在 server.js 中添加版本查询端点                                              |
| **路径**     | `GET /api/metadata/version`（无需认证）                                      |
| **响应**     | `{ content_hash, generated, format_version, chapter_count, approved_count }` |
| **数据来源** | 读取 `family_metadata_public.json` 的三大元字段                              |
| **预估行数** | ~25 行                                                                       |
| **位置**     | `server.js` 新增 `handleMetadataVersion` 函数                                |

#### 任务 2.2：创建 Cloudflare 版本端点

| 属性         | 内容                                                              |
| ------------ | ----------------------------------------------------------------- |
| **描述**     | 在 `functions/api/` 中创建 Cloudflare Pages 版本端点              |
| **文件**     | `functions/api/metadata-version.js`（新文件）                     |
| **实现**     | 从静态资源 `/data/family_metadata_public.json` 提取并返回版本信息 |
| **预估行数** | ~40 行                                                            |

#### 任务 2.3：前端版本感知 + 缓存刷新

| 属性         | 内容                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **描述**     | 在 `js/family.js` 中添加启动时版本检测逻辑                                                                                                                     |
| **逻辑**     | ① 初始化时调用 `/api/metadata/version` ② 将 `content_hash` 存入 `localStorage` ③ 每次启动/切换章节时比对 hash ④ 若 hash 变化：清空元数据缓存 + 显示 toast 提示 |
| **预估行数** | ~30 行                                                                                                                                                         |
| **位置**     | `js/family.js` 的 loadMetadataCache 函数附近                                                                                                                   |

#### 任务 2.4：完善 build 脚本

| 属性         | 内容                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **描述**     | 为 build-public-metadata.js 添加增强功能                                                                                                  |
| **新增功能** | ① `--check` 模式（仅比对 hash，不写文件，退出码反映状态）② 变更摘要输出（列出 hash 变化、时间戳变化）③ 输出文件统计（章节数、approved数） |
| **预估行数** | ~30 行增量                                                                                                                                |

#### 任务 2.5：npm 脚本集成

| 属性         | 内容                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **描述**     | 将 build 脚本加入 package.json 标准化工作流                                                                                             |
| **新增脚本** | `"build:public-metadata": "node scripts/build-public-metadata.js"`、`"check:metadata": "node scripts/build-public-metadata.js --check"` |
| **文件**     | `package.json`                                                                                                                          |

#### 任务 2.6：端到端版本流程验证

| 属性         | 内容                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **测试场景** | ① 修改某章 core_idea → 运行 build → content_hash 变化 ② 部署后前端检测到 hash 变化 → toast 提示 → 缓存刷新 ③ `--check` 模式在不同环境下返回正确状态 |
| **工具**     | 本地 server.js + Cloudflare wrangler preview                                                                                                        |

#### Phase 2 风险清单

| 风险                                         | 概率 | 影响 | 缓解措施                                   |
| -------------------------------------------- | ---- | ---- | ------------------------------------------ |
| 前端 localStorage 与 Service Worker 缓存冲突 | 中   | 中   | 使用 `content_hash` 作为版本标识的单一来源 |
| Cloudflare 静态资源部署延迟                  | 低   | 低   | 版本 API 读取运行时文件而非部署缓存        |

---

### Phase 3：架构分离与运维完善（长期，1-2个月）

**目标**: 完成同仓分离架构，建立自动化质量保障体系。

```
优先级：P2 — 架构演进，非紧急但重要
```

#### 任务 3.1：同仓分离 — 管理端路径隔离

| 属性         | 内容                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| **描述**     | 将 admin 目录部署为独立的路由前缀或独立项目                                          |
| **方案**     | ① 管理端 API 统一挂载 `/admin/api/*` ② 前端页面部署在 `/admin/*` ③ 公开 API 保持不变 |
| **涉及文件** | `server.js`（路由拆分）、`admin/`（路径调整）、Vercel 配置                           |
| **注意事项** | 确保管理端与公开端不共享缓存、不泄露 Token                                           |

#### 任务 3.2：Cloudflare Pages 管理 API

| 属性         | 内容                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| **描述**     | 为 Cloudflare 生产环境添加管理 API 端点                                                                       |
| **新增文件** | `functions/admin/api/metadata.js`（PUT/DELETE）、`functions/admin/api/metadata-staging.js`（GET/POST/DELETE） |
| **认证方式** | 复用 Bearer Token 机制，从 env 读取 ADMIN_TOKEN                                                               |
| **注意事项** | Cloudflare Functions 无 `fs` 模块，需通过 KV 或 R2 存储元数据                                                 |

#### 任务 3.3：自动化质量回归测试

| 属性         | 内容                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **描述**     | 建立元数据质量的结构化测试套件                                                                                                                                       |
| **测试范围** | ① 所有 81 章的必填字段完整性 ② safety_notes ≥ 3 条 ③ interaction_points 每 topic 的 age 字段不为全 null ④ core_idea 无禁用术语 ⑤ 状态机转换合法性 ⑥ 版本 hash 一致性 |
| **实现方式** | Node.js 脚本（独立于现有 validate.js，但风格一致）                                                                                                                   |
| **集成**     | 作为 `npm run test:metadata` 加入 npm scripts                                                                                                                        |

#### 任务 3.4：内容新鲜度计划检查

| 属性         | 内容                                                          |
| ------------ | ------------------------------------------------------------- |
| **描述**     | 定期运行 `--check` 模式，确保 `_public.json` 与源文件同步     |
| **触发方式** | 可在 `pre-commit` hook 中运行，或作为 CI 步骤                 |
| **文件**     | `.husky/pre-commit` 或 `.github/workflows/check-metadata.yml` |

#### Phase 3 风险清单

| 风险                      | 概率 | 影响 | 缓解措施                                     |
| ------------------------- | ---- | ---- | -------------------------------------------- |
| Cloudflare KV/R2 成本考虑 | 中   | 中   | 评估后决定使用 KV 还是继续用静态文件         |
| 路径隔离破坏现有链接      | 中   | 中   | 保留 `/admin/*` 和 `/api/*` 的向后兼容重定向 |

---

## 三、任务总览与依赖关系

```
Phase 1 (安全脱敏)
├── 1.1 build-public-metadata.js     ← 无依赖，可立即开始
├── 1.2 首次生成 _public.json        ← 依赖 1.1
├── 1.3 更新 .gitignore              ← 独立，可与1.1并行
├── 1.4 切换消费者路径 (5处)         ← 依赖 1.2
├── 1.5 本地+预览验证                ← 依赖 1.2+1.4
└── 1.6 Vercel生产部署               ← 依赖 1.5

Phase 2 (版本控制)
├── 2.1 版本API (server.js)          ← 依赖 1.2
├── 2.2 版本API (Cloudflare)         ← 依赖 1.2
├── 2.3 前端版本感知                 ← 依赖 2.1+2.2
├── 2.4 --check 模式                 ← 依赖 1.1
├── 2.5 npm 脚本集成                 ← 依赖 1.1+2.4
└── 2.6 端到端验证                   ← 依赖 2.1-2.5

Phase 3 (架构分离)
├── 3.1 管理端路径隔离               ← 依赖 Phase 1+2
├── 3.2 Cloudflare 管理API           ← 依赖 3.1
├── 3.3 自动化测试                   ← 独立，可随时开始
└── 3.4 新鲜度检查                   ← 依赖 2.4
```

---

## 四、资源估计

| 阶段    | 任务数 | 新增文件                                       | 修改文件 | 新增代码行 | 预估工作量 |
| ------- | ------ | ---------------------------------------------- | -------- | ---------- | ---------- |
| Phase 1 | 6      | 2 (`build-public-metadata.js`, `_public.json`) | 6        | ~230       | 5-7 天     |
| Phase 2 | 6      | 1 (`metadata-version.js`)                      | 4        | ~125       | 2-3 周     |
| Phase 3 | 4      | 3+                                             | 4+       | ~350       | 1-2 月     |

---

## 五、建议的立即启动项

按优先级排列，以下 3 个任务**无任何阻塞依赖**，可立即并行开始：

| 顺序 | 任务                                                                                                                 | 预计耗时 |
| ---- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| ①    | 创建 `scripts/build-public-metadata.js`                                                                              | 1 天     |
| ②    | 更新 `.gitignore`（添加 `family_metadata.json` 和 `staging.json`）                                                   | 5 分钟   |
| ③    | 切换 `js/family.js` 2处 + `api/family_chat.js` 1处 + `functions/api/family_chat.js` 1处 + `server.js` 1处 的文件路径 | 半天     |

> ① 可参考已有脚本 `scripts/version-manifest.js`（SHA-256计算）和 `api/_shared/metadata-store.js`（字段结构）。

---

## 附录：完成标准

每个阶段完成的定义：

| 阶段    | 完成标准                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| Phase 1 | ① 生产环境 `_public.json` 正常服务，不含任何审计字段 ② 所有消费者成功读取 `_public.json` ③ `.gitignore` 已生效 |
| Phase 2 | ① `GET /api/metadata/version` 返回正确的三重标识 ② 前端在 hash 变化时自动刷新缓存 ③ `--check` 模式可用于 CI    |
| Phase 3 | ① 管理端与公开端路径完全隔离 ② 自动化测试覆盖 ≥80% 元数据字段 ③ 新鲜度检查纳入 Git hook                        |
