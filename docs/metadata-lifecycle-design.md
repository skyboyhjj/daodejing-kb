# 道德经亲子体验营 — 元数据文件生命周期管理设计书

> **版本**: 1.0 | **日期**: 2026-05-15 | **适用范围**: daodejing-kb 全栈项目

---

## 目录

1. [元数据结构定义](#1-元数据结构定义)
2. [元数据创建流程](#2-元数据创建流程)
3. [元数据审核流程](#3-元数据审核流程)
4. [元数据修订机制](#4-元数据修订机制)
5. [元数据存储架构](#5-元数据存储架构)
6. [API 接口设计](#6-api-接口设计)
7. [安全控制机制](#7-安全控制机制)
8. [版本控制与变更历史追踪](#8-版本控制与变更历史追踪)

---

## 1. 元数据结构定义

### 1.1 公开元数据字段（生产环境可见）

每个章节的元数据由以下 7 个公开字段组成。这些字段在 `family_metadata_public.json` 中对前端和 API 消费者可见：

| 字段                 | 类型                      | 约束     | 说明                                                     |
| -------------------- | ------------------------- | -------- | -------------------------------------------------------- |
| `chapter`            | `number`                  | 1-81     | 章节编号                                                 |
| `title`              | `string`                  | ≤15字    | 章节标题（如"道可道，非常道"）                           |
| `core_idea`          | `string`                  | ≤80字    | 核心智慧的一句话表述，用自然语言像讲故事，禁用哲学术语   |
| `safety_notes`       | `array<string>`           | 3-6条    | 亲子对话中的安全约束列表，每条一条规则                   |
| `interaction_points` | `array<InteractionPoint>` | 3个主题  | 亲子互动话题，每主题覆盖 4-6岁/7-9岁/10-12岁三档         |
| `parent_tips`        | `string`                  | ≤80字    | 给家长的温暖陪伴式提醒，不说教、不指导                   |
| `review_status`      | `enum`                    | 见状态机 | `pending` / `reviewing` / `approved` / `revision_needed` |

**InteractionPoint 子结构：**
```json
{
  "topic": "互动话题名（3-8字）",
  "age_4_6": "针对4-6岁孩子的引导方向，可为null",
  "age_7_9": "针对7-9岁孩子的引导方向，可为null",
  "age_10_12": "针对10-12岁孩子的引导方向，可为null"
}
```

### 1.2 内部管理字段（仅完整版文件可见）

完整版 `family_metadata.json` 额外包含以下敏感字段，通过 `build-public-metadata.js` 脱敏后移除：

| 字段             | 类型                  | 说明                                                     |
| ---------------- | --------------------- | -------------------------------------------------------- |
| `reviewed_by`    | `string`              | 当前审核者的操作标识（`reviewing` 状态时有值，否则为空） |
| `reviewed_at`    | `string`              | 最近一次审核操作的日期（ISO date 格式 `YYYY-MM-DD`）     |
| `review_history` | `array<HistoryEntry>` | 完整操作审计日志（见第 8 节）                            |

**HistoryEntry 结构：**
```json
{
  "action": "created|reviewing|approved|revision_needed|updated|deleted",
  "by": "操作者标识",
  "at": "2026-05-15T12:00:00.000Z",
  "notes": "操作备注",
  "revisions": { /* 结构化修订意见（revision_needed时） */ },
  "content_snapshot": { /* 关键状态转换时的内容快照 */ }
}
```

### 1.3 文件级元字段

顶层 JSON 对象的元字段：

| 字段              | 类型     | 说明                                         |
| ----------------- | -------- | -------------------------------------------- |
| `chapters`        | `object` | 以章节号（字符串）为 key 的元数据字典        |
| `_updated`        | `string` | 最近修改日期，格式 `YYYY-MM-DD`              |
| `_version`        | `string` | 格式版本号，当前为 `"1.0"`                   |
| `_format_version` | `string` | （`_public.json` 专属）Schema 版本号         |
| `_content_hash`   | `string` | （`_public.json` 专属）8 位 SHA-256 内容指纹 |
| `_generated`      | `string` | （`_public.json` 专属）ISO 8601 生成时间戳   |

### 1.4 数据质量约束

- `core_idea`：必须保留原文哲学内核，用儿童能理解的自然语言表述，禁用"哲学""辩证""虚无主义"等术语，禁用当代政治话语（如"好日子""大家一起"）
- `safety_notes`：必须覆盖 Article 11 安全检查表中的关键项目（见 1.5），每条不超过 40 字
- `interaction_points`：至少包含 3 个主题，其中第三个固定为"把智慧带入生活"
- `parent_tips`：不允许使用"你应该""你必须"等说教句式

### 1.5 Article 11 安全检查表（11 项）

审核员在通过章节前必须逐项确认（`admin/family-review.js` line ~1100）：

| #   | 检查项                                          |
| --- | ----------------------------------------------- |
| 1   | 无死亡、灾难、暴力等可能引发儿童恐惧的内容      |
| 2   | 无身体外貌、身材等可能引发儿童焦虑的外在比较    |
| 3   | 不将概念简化为"好坏都一样"的相对主义            |
| 4   | 不对任何行为做道德评判（不用"好/坏/对/错"标签） |
| 5   | 不使用"不可知论""虚无主义"等哲学术语            |
| 6   | 不将概念曲解为消极逃避或放弃努力                |
| 7   | 所有表述温暖、包容、积极                        |
| 8   | 不使用当代政治话语或社会宣传                    |
| 9   | 无引发贫富焦虑、阶层比较的内容                  |
| 10  | 批判性内容不演变为攻击性引导                    |
| 11  | 保留原文哲学深度，不过度"儿童化"到失真          |

---

## 2. 元数据创建流程

### 2.1 整体流水线

```
chapters/ch{XX}.html (L1白话版)
    ↓ [scripts/extract_meta.py: extract_chapter_info()]
章节HTML → 标题、原文、概念标签、L1内容文本
    ↓ [scripts/extract_meta.py: build_extraction_prompt()]
结构化提示词（含原文 + L1内容 + 安全约束 + JSON Schema）
    ↓ [DeepSeek API: deepseek-chat, temperature=0.7, max_tokens=2000]
AI 提取的原始 JSON
    ↓ [scripts/extract_meta.py: parse_metadata_response()]
字段验证（必填校验、数量校验、topic校验）
    ↓ [scripts/extract_meta.py: process_chapter()]
追加写入 data/family_metadata.json，review_status = "pending"
```

### 2.2 提取脚本使用方式

```bash
# 单章测试模式
python scripts/extract_meta.py --chapter 8

# 批量模式（20 章核心章节）
python scripts/extract_meta.py --batch

# 全量模式（81 章）
python scripts/extract_meta.py --all

# 自定义章节列表
python scripts/extract_meta.py --chapters 3,7,9,11,12
```

**关键实现细节：**
- 自动跳过已有元数据的章节（避免覆盖已审核内容）
- 每章间隔 2 秒避免 API 限流
- 新章节 `review_status` 初始为 `"pending"`，`reviewed_by` 和 `reviewed_at` 为空
- 第一章的 `review_history` 记录为 `{action:"created", by:"extract_meta.py"}`

### 2.3 内容提取细节

从 `chapters/ch{XX}.html` 提取的内容：

| 提取目标      | HTML 选择器                                     | 实现位置              |
| ------------- | ----------------------------------------------- | --------------------- |
| 章节号 + 标题 | `<h1>` 中的 `第N章 · 标题`                      | `extract_meta.py:93`  |
| 原文          | `<div class="original-text">`                   | `extract_meta.py:104` |
| 概念标签      | `<span class="concept-tag">`                    | `extract_meta.py:115` |
| L1 白话版     | `<div class="level-block level-l1">` 中的 `<p>` | `extract_meta.py:126` |

如果 L1 内容少于 50 字符，该章节自动跳过。

### 2.4 AI 提示词结构

提示词包含七个部分（`extract_meta.py:147 build_extraction_prompt()`）：
1. 角色设定（儿童教育专家 + 慧惠内容顾问）
2. 章节基本信息（编号、标题、核心概念）
3. 原文
4. 白话版全文（L1）
5. 期望输出的 JSON Schema
6. 安全约束（5 条硬性要求）
7. 重要提醒（风格要求 + 最少 2 个互动话题）

---

## 3. 元数据审核流程

### 3.1 状态机定义

```
                    ┌──────────┐
                    │ pending  │ ← 初始状态（extract_meta.py 生成）
                    └────┬─────┘
                         │ 点击"开始审核"
                         ▼
                    ┌──────────┐
              ┌─────│reviewing │─────┐
              │     └────┬─────┘     │
              │          │           │
              │ 点击"退回"│           │ 点击"通过"（通过 Article 11 检查）
              │          │           │
              │          ▼           ▼
              │     ┌──────────┐ ┌──────────┐
              └─────│ revision │ │ approved │
                    │ _needed  │ └────┬─────┘
                    └────┬─────┘     │
                         │           │ 点击"打回修订"
                         │           ▼
                         │     ┌──────────┐
                         └─────│ revision │
                               │ _needed  │
                               └──────────┘
```

**合法状态转换（`metadata-store.js:20`）：**

| 从                | 到                | 触发动作                        |
| ----------------- | ----------------- | ------------------------------- |
| `pending`         | `reviewing`       | 审核员认领章节，开始审核        |
| `reviewing`       | `approved`        | 审核通过（Article 11 全项通过） |
| `reviewing`       | `revision_needed` | 审核打回（携带结构化修订意见）  |
| `reviewing`       | `pending`         | 审核员退回（解除锁定）          |
| `revision_needed` | `reviewing`       | 修订完成后重新提交审核          |
| `approved`        | `revision_needed` | 已上线章节下架（二次部署策略）  |

**不可直接转换的路径：**
- `pending → approved`（必须先经过 reviewing）
- `approved → reviewing`（必须先打回 revision_needed）
- `revision_needed → approved`（必须先经过 reviewing）

### 3.2 审核控制台操作界面

审核控制台位于 `admin/family-review.html` + `admin/family-review.js`：

- **左侧边栏**：章节列表，支持按状态筛选（all/approved/pending/reviewing/revision_needed）和搜索
- **右侧主面板**：单章详情，包含四个可编辑文本区域 + 安全检查表
- **操作按钮**：根据当前状态动态显示可用操作
- **diff 比较视图**：对比生产版本与暂存区修订

### 3.3 软锁定机制

当审核员将章节置为 `reviewing` 状态时：
1. `reviewed_by` 设置为审核员标识（operatorBy 参数）
2. 其他审核员尝试修改时返回 HTTP `423 Locked`
3. 只有锁定者本人可以继续操作或退回
4. 状态离开 `reviewing`（approved/revision_needed/pending）时自动解锁

**实现位置：** `metadata-store.js:261` (store) → `server.js:812` (API 端点)

### 3.4 Article 11 安全检查集成

审核员将章节从 `reviewing` 转为 `approved` 前：
1. 安全检查表 11 项必须全部勾选（`family-review.js:1251 performAction()`）
2. 如有未勾选项，弹出警告模态框，列出未通过项目
3. 审核员可选择"返回检查"或"仍然通过（风险自担）"
4. 强制通过时在 `review_history` 备注中记录

---

## 4. 元数据修订机制

### 4.1 双路径修订架构

```
┌──────────────────────────────────────────────────────┐
│                   revision_needed                     │
│  (审核员填写结构化修订意见 → appendHistory 存储)        │
└──────────────────┬───────────────────────────────────┘
                   │
    ┌──────────────┴──────────────┐
    │   调用 AI 修订器              │
    │   metadata-reviser.js        │
    └──────────────┬──────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    ┌─────────┐         ┌─────────┐
    │ 暂存区  │         │ 直接写入 │
    │ Staging │         │ 生产环境 │
    └────┬────┘         └─────────┘
         │
    ┌────┴────┐
    │ 管理员   │
    │ 确认同步 │
    ▼         │
  生产环境    │ 拒绝 → 删除暂存
```

### 4.2 修订触发与提示词构建

**触发条件：** 管理员通过审核控制台点击"AI 修订"按钮，或在命令行调用修订器。

**提示词构建（`metadata-reviser.js:137 buildRevisionPrompt()`）：**

AI 修订器的提示词比初始提取更丰富，包含：
1. **参考原文**（截取前 300 字符）
2. **L1 白话版内容**（截取前 1500 字符）
3. **当前元数据**（完整 JSON）
4. **已通过章节的风格示例**（最多取 3 个 approved 状态的章节）
5. **审核员的修订意见**（从 `review_history` 中提取最近的 `revision_needed` 条目）
6. **优化要求**（6 条硬性标准，包含"保留原文批判精神"的哲学保护）
7. **安全约束**（4 条，与生成阶段略有不同但同样严格）

**修订意见的解析（`metadata-reviser.js:282 parseRevisionNotes()`）：**
从 `revisions` 结构体中提取四个维度的可读意见：
- `core_idea.problem` + `core_idea.direction`
- `safety_notes.problem` + `safety_notes.direction`
- `interaction_points.problem` + `interaction_points.direction`
- `parent_tips.problem` + `parent_tips.direction`

### 4.3 暂存区 → 生产同步（管理员确认）

**同步流程（`metadata-reviser.js:487 syncStagingToProduction()`）：**
1. 检查暂存区文件是否存在且非空
2. 支持全量同步或指定章节列表同步
3. 逐章比对：暂存区章节必须在生产环境中存在
4. 覆盖四个内容字段（core_idea/safety_notes/interaction_points/parent_tips）
5. 在 `review_history` 中追加 `admin (synced from staging)` 条目
6. 成功同步的章节从暂存区移除
7. 返回 `{synced: [], skipped: [], stagingRemaining: N}`

**安全保护：**
- 仅覆盖内容字段，不修改 `review_status`/`reviewed_by`/`reviewed_at`
- 暂存区章节在生产环境中不存在时跳过（而非创建）
- 同步后自动从暂存区删除已处理章节

### 4.4 暂存区数据管理

**暂存区文件结构（`data/family_metadata_staging.json`）：**
```json
{
  "chapters": {
    "50": {
      "chapter": 50,
      "title": "出生入死",
      "core_idea": "...",
      "safety_notes": ["...", "..."],
      "interaction_points": [...],
      "parent_tips": "...",
      "_staged_at": "2026-05-15T12:00:00.000Z",
      "_staged_by": "AI (metadata-reviser)",
      "_staged_model": "deepseek-chat",
      "_production_status": "revision_needed"
    }
  },
  "_updated": "2026-05-15T12:00:00.000Z",
  "_version": "1.0",
  "_description": "AI 修订暂存区 — 等待管理员同步到生产环境"
}
```

暂存区支持的操作：
- `GET /api/metadata/staging` → 查看暂存区内容
- `POST /api/metadata/sync` → 同步到生产环境
- `DELETE /api/metadata/staging?chapter=N` → 废弃某章的 AI 修订

---

## 5. 元数据存储架构

### 5.1 文件存储层级

```
data/
├── family_metadata.json          ← 完整版（含审计字段），管理端读写
├── family_metadata_public.json   ← 公开版（脱敏），前端 + API 消费
└── family_metadata_staging.json  ← AI 修订暂存区，待管理员确认
```

### 5.2 内存缓存机制

**模块级缓存（`metadata-store.js:15`）：**
- `_metadataCache`: 完整 JSON 对象（5 秒 TTL）
- `_cacheTimestamp`: 上次加载时间戳
- 写入时（`saveMetadata()`）主动刷新缓存

**API 级缓存（`api/family_chat.js:30`）：**
- `_cache` Map：以 `fc_{chapter}_{ageGroup}_{hash}` 为 key
- 24 小时 TTL（`Date.now() - entry.ts > 24 * 60 * 60 * 1000`）
- 基于对话历史的简单哈希生成缓存键
- 过期条目在 `cacheGet()` 中惰性删除

**文件级预热缓存（`data/family_chat_cache.json`）：**
- 通过 `family-chat-cache-warmup` Skill 批量预生成
- 覆盖所有 `approved` 章节 × 3 个年龄段 × N 轮组合

### 5.3 序列化与写入策略

- 缩进格式：`JSON.stringify(data, null, 4)` 带尾随换行符
- 原子写入：先写完整字符串再关闭文件句柄（Node.js `writeFileSync`）
- `_updated` 字段更新为 `new Date().toISOString().split('T')[0]`（日期格式）
- 暂存区使用 ISO 完整时间戳格式

### 5.4 消费者读取路径

| 消费者                        | 文件                   | 加载方式                        | 位置                              |
| ----------------------------- | ---------------------- | ------------------------------- | --------------------------------- |
| Vercel `/api/family_chat`     | `family_metadata.json` | `fs.readFileSync`（模块级缓存） | `api/family_chat.js:19`           |
| Cloudflare `/api/family_chat` | `family_metadata.json` | `fetch(url)`（模块级缓存）      | `functions/api/family_chat.js:15` |
| 前端 `family.js`              | `family_metadata.json` | `XMLHttpRequest`                | `js/family.js:965`                |
| 前端 `family.js` parentTips   | `family_metadata.json` | `XMLHttpRequest`                | `js/family.js:942`                |
| 审核控制台                    | `family_metadata.json` | 通过管理 API 代理               | `admin/family-review.js`          |
| 本地开发服务器                | `family_metadata.json` | `fs.readFileSync`               | `server.js`                       |

> **注意**：前端和 API 消费者未来应切换为 `family_metadata_public.json`（脱敏版），参见[元数据生产环境脱敏交付规范](memory://6ed4cdd3)。

### 5.5 cacheTTL 说明

| 缓存层                   | TTL     | 清除策略                        | 逻辑位置                |
| ------------------------ | ------- | ------------------------------- | ----------------------- |
| metadata-store 内存      | 5 秒    | 写入时主动刷新 + 读取时惰性失效 | `metadata-store.js:17`  |
| family_chat 对话缓存     | 24 小时 | 读取时惰性删除过期条目          | `api/family_chat.js:47` |
| Vercel Serverless 冷启动 | 按需    | 实例回收时清除                  | Vercel 平台层           |

---

## 6. API 接口设计

### 6.1 接口总览

| 方法     | 路径                              | 认证        | 说明                                                                              | 实现位置        |
| -------- | --------------------------------- | ----------- | --------------------------------------------------------------------------------- | --------------- |
| `GET`    | `/api/metadata`                   | 无          | 章节列表/详情（支持 `?chapter=N`、`?status=`、`?search=`）                        | `server.js:707` |
| `GET`    | `/api/metadata/stats`             | 无          | 聚合统计（total/approved/pending/reviewing/revision_needed/by_reviewer）          | `server.js:667` |
| `PUT`    | `/api/metadata`                   | ADMIN_TOKEN | 更新章节元数据 + 状态转换（body: `{chapter, updates, operator_by}`）              | `server.js:764` |
| `DELETE` | `/api/metadata?chapter=N`         | ADMIN_TOKEN | 删除章节元数据（仅非 approved 状态）                                              | `server.js:849` |
| `GET`    | `/api/metadata/staging`           | 无          | 查看 AI 修订暂存区                                                                | `server.js`     |
| `POST`   | `/api/metadata/sync`              | ADMIN_TOKEN | 暂存区同步到生产环境（body: `{chapters?: [N]}`）                                  | `server.js`     |
| `DELETE` | `/api/metadata/staging?chapter=N` | ADMIN_TOKEN | 删除暂存区中的某章修订                                                            | `server.js`     |
| `POST`   | `/api/reviser/revise`             | ADMIN_TOKEN | 触发 AI 修订某章节 → 写入暂存区                                                   | `server.js`     |
| `GET`    | `/api/metadata/version`           | 无          | （计划中）返回版本信息 `{content_hash, generated, chapter_count, approved_count}` | —               |

### 6.2 `GET /api/metadata` — 章节列表/详情

**Query 参数：**

| 参数      | 类型     | 说明                                                   |
| --------- | -------- | ------------------------------------------------------ |
| `chapter` | `number` | 指定章节号，返回单章详情                               |
| `status`  | `string` | 过滤状态（pending/reviewing/approved/revision_needed） |
| `search`  | `string` | 模糊搜索标题 + core_idea                               |

**响应（列表模式）：**
```json
{
  "total": 81,
  "chapters": [
    {
      "chapter": 1,
      "title": "道可道，非常道",
      "core_idea": "真正的「道」无法用语言完全描述...",
      "review_status": "approved",
      "reviewed_by": "",
      "reviewed_at": "2026-05-12",
      "safety_notes_count": 3,
      "interaction_points_count": 2
    }
  ]
}
```

**响应（详情模式 `?chapter=N`）：**
返回完整的章节元数据对象，包含所有字段（含 `review_history`）。

### 6.3 `PUT /api/metadata` — 更新章节

**请求体：**
```json
{
  "chapter": 50,
  "updates": {
    "review_status": "approved",
    "review_notes": "安全检查全部通过",
    "title": "新标题（可选）",
    "core_idea": "新核心思想（可选）",
    "safety_notes": ["新安全约束..."],
    "interaction_points": [...],
    "parent_tips": "新家长提示",
    "revisions": { /* 结构化修订意见 */ }
  },
  "operator_by": "产品经理"
}
```

**状态转换校验（自动执行）：**
1. `validateTransition(from, to)` — 检查是否在合法转换列表中
2. 软锁定检查 — `reviewing` 状态下非锁定者返回 423
3. 关键状态转换时自动保存 `content_snapshot`
4. `reviewing` 时自动设置 `reviewed_by`
5. `approved`/`revision_needed` 时自动清除 `reviewed_by`

**响应：**
```json
{
  "ok": true,
  "chapter": { /* 更新后的完整章节对象 */ }
}
```

### 6.4 `DELETE /api/metadata` — 删除章节

**限制条件：**
- 仅 `review_status !== 'approved'` 的章节可删除
- 删除前在 `review_history` 中追加 `deleted` 条目
- 需要 ADMIN_TOKEN 认证

### 6.5 `GET /api/metadata/stats` — 聚合统计

**响应：**
```json
{
  "total": 81,
  "approved": 78,
  "pending": 1,
  "reviewing": 0,
  "revision_needed": 2,
  "by_reviewer": { "产品经理": 50, "设计师": 31 },
  "_updated": "2026-05-15",
  "_version": "1.0"
}
```

### 6.6 错误响应码

| HTTP 状态码 | 含义       | 触发条件                                        |
| ----------- | ---------- | ----------------------------------------------- |
| `200`       | 成功       | 正常响应                                        |
| `400`       | 请求错误   | 缺少必填字段 / 非法状态转换 / JSON 解析失败     |
| `401`       | 未认证     | 缺少或无效的 ADMIN_TOKEN                        |
| `403`       | 禁止访问   | review_status 非 approved 的章节被 API 门控拦截 |
| `404`       | 未找到     | 章节不存在                                      |
| `405`       | 方法不允许 | 非 POST/PUT/DELETE/GET 请求                     |
| `423`       | 资源锁定   | 章节正由其他审核员审核中                        |
| `500`       | 服务器错误 | 文件读写失败 / DeepSeek API 调用失败            |
| `501`       | 未实现     | 暂未开发的功能                                  |

### 6.7 第二章部署策略 — API 门控逻辑

当章节 `review_status === "pending"` 且用户 `conversation_history.length > 0` 时，API 放行以保护过渡期活跃用户：

```
检查逻辑（api/family_chat.js:207-215 / functions/api/family_chat.js:195-206 / server.js:564-576）:

var allowed = chapterMeta.review_status === 'approved' ||
              (chapterMeta.review_status === 'pending' && history.length > 0);
if (!allowed) {
    return 403 { error: '此章节正在维护中，请先探索其他章节！', code: 'CHAPTER_IN_TRANSITION' }
}
```

| 用户类型             | 行为                                            |
| -------------------- | ----------------------------------------------- |
| 有对话历史的活跃用户 | 继续使用旧内容（不受 pending 影响）             |
| 无对话历史的新用户   | 收到 403 "此章节正在维护中，请先探索其他章节！" |

---

## 7. 安全控制机制

### 7.1 认证机制

管理端 API 通过 **Bearer Token** 认证：

```
Authorization: Bearer {ADMIN_TOKEN}
```

- 环境变量 `ADMIN_TOKEN` 配置在 `.env` 文件（本地）/ Vercel 环境变量（生产）
- 未提供或 Token 不匹配 → 返回 401
- 公开 API（GET /api/metadata、GET /api/metadata/stats）无需认证
- 管理 API（PUT/DELETE/POST）需要认证

**实现位置：** `server.js` 中的 `checkAdminAuth()` 函数

### 7.2 软锁定机制

防止多审核员同时编辑同一章节：

| 状态        | 锁定规则                                      |
| ----------- | --------------------------------------------- |
| `reviewing` | 由 `reviewed_by` 独占，其他审核员操作返回 423 |
| 其他状态    | 无锁定，任意管理员可操作                      |

**解锁方式：**
1. 审核通过（`reviewing → approved`）
2. 打回修订（`reviewing → revision_needed`）
3. 主动退回（`reviewing → pending`）

### 7.3 操作审计

所有状态变更和内容修改均在 `review_history` 中记录：

| 记录项             | 说明                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `action`           | 操作类型（created/reviewing/approved/revision_needed/updated/deleted） |
| `by`               | 操作者标识                                                             |
| `at`               | ISO 8601 时间戳                                                        |
| `notes`            | 操作备注                                                               |
| `revisions`        | 结构化修订意见（仅 revision_needed 时有）                              |
| `content_snapshot` | 关键状态转换时的内容快照（仅 approved 和 revision_needed 时有）        |

**快照包含的四个字段：** `core_idea`、`safety_notes`（浅拷贝数组）、`interaction_points`（浅拷贝数组）、`parent_tips`

### 7.4 删除保护

- 仅 `review_status !== 'approved'` 的章节可删除
- 已上线（approved）章节不可直接删除，需先打回 `revision_needed`
- 删除前在 `review_history` 中追加记录再执行
- 建议实际操作前先手动备份文件

### 7.5 内容安全检查

- Article 11 安全检查表（11 项）必须在审核通过前确认
- AI 提取和修订的 System Prompt 中内嵌安全约束
- API 级门控：仅 `review_status === 'approved'`（或 pending+活跃用户）的章节可通过 `family_chat`

---

## 8. 版本控制与变更历史追踪

### 8.1 三重版本标识

`family_metadata_public.json` 采用三重标识方案：

| 标识              | 生成方式                  | 示例                         | 用途                            |
| ----------------- | ------------------------- | ---------------------------- | ------------------------------- |
| `_format_version` | 手动递增（Schema 变更时） | `"1.0"`                      | 消费者判断数据结构兼容性        |
| `_content_hash`   | SHA-256 前 8 位（hex）    | `"a3f2b8c1"`                 | 检测内容是否变化（部署后比对）  |
| `_generated`      | ISO 8601 时间戳           | `"2026-05-15T12:00:00.000Z"` | 标识生成时间，支持版本 API 查询 |

### 8.2 `build-public-metadata.js` 构建脚本

**功能：**
1. 从 `family_metadata.json` 白名单提取公开字段（过滤 `reviewed_by`、`reviewed_at`、`review_history`）
2. 计算 `_content_hash`（仅对 `chapters` 内容计算，排除顶层元字段）
3. 写入 `_format_version`、`_content_hash`、`_generated`
4. 输出 `family_metadata_public.json`

**命令行模式：**
```bash
# 构建公开版
node scripts/build-public-metadata.js

# 一致性检查（不写文件，仅检查当前部署版本的 hash 是否与源文件一致）
node scripts/build-public-metadata.js --check
```

### 8.3 变更检测算法

```javascript
// 伪代码
var chaptersStr = JSON.stringify(publicMetadata.chapters, Object.keys(publicMetadata.chapters).sort());
var hash = sha256(chaptersStr).substring(0, 8); // 取前 8 位
if (hash !== currentPublicMetadata._content_hash) {
    console.log('检测到内容变更: ' + currentPublicMetadata._content_hash + ' → ' + hash);
    // 更新 hash + 时间戳
}
```

### 8.4 review_history 变更日志

每条日志记录完整的操作上下文：

```json
{
  "action": "approved",
  "by": "产品经理",
  "at": "2026-05-15T12:00:00.000Z",
  "notes": "安全检查全部通过，第50章已针对'出生入死'主题完成额外审查",
  "content_snapshot": {
    "core_idea": "真正的摄生不是躲开危险...",
    "safety_notes": ["不使用战争比喻...", "不夸大危险..."],
    "interaction_points": [{"topic": "蜗牛与盾牌", ...}],
    "parent_tips": "这一章讲解的是...不要用恐惧来保护孩子..."
  }
}
```

**记录时机：**
- 状态转换时（每次）→ 携带 action + 备注
- 内容编辑时（无状态转换）→ action: "updated"
- 删除操作时 → action: "deleted"
- AI 修订时 → 在暂存区记录 `_staged_at`/`_staged_by`/`_staged_model` + 生产环境追加同步记录

### 8.5 Git 版本控制规范

| 文件                                | 是否提交 Git    | 说明                              |
| ----------------------------------- | --------------- | --------------------------------- |
| `data/family_metadata.json`         | ~~是~~ → **否** | 包含敏感审计数据，应 `.gitignore` |
| `data/family_metadata_public.json`  | **是**          | 脱敏版本，生产部署所需            |
| `data/family_metadata_staging.json` | **否**          | 临时暂存区，不应进入版本库        |

**Commit 信息规范：**
```
metadata: [动作] [章节范围] — [摘要说明]

示例：
  metadata: approve chapters/1-10 — 首轮审核通过
  metadata: revise chapter/50 — 出生入死章节专项修订
  metadata: sync staging chapters/50,52 — 管理员确认AI修订

🤖 Generated with Qoder (https://qoder.com)
```

### 8.6 版本查询 API（计划中）

```
GET /api/metadata/version
→ {
    "content_hash": "a3f2b8c1",
    "generated": "2026-05-15T12:00:00.000Z",
    "format_version": "1.0",
    "chapter_count": 81,
    "approved_count": 78
  }
```

前端可在应用初始化时调用此 API，检测部署版本变化并触发缓存刷新。

---

## 附录 A：关键文件索引

| 文件路径                            | 行数  | 核心职责                              |
| ----------------------------------- | ----- | ------------------------------------- |
| `api/_shared/metadata-store.js`     | 355   | CRUD、状态机、缓存、审计日志          |
| `api/_shared/metadata-reviser.js`   | 595   | AI 修订流水线、暂存区管理、同步       |
| `scripts/extract_meta.py`           | 500   | 初始元数据生成（HTML → JSON）         |
| `server.js`                         | ~900  | 本地开发服务器 + 所有管理 API 路由    |
| `admin/family-review.html`          | —     | 审核控制台 UI                         |
| `admin/family-review.js`            | ~1587 | 审核控制台前端逻辑                    |
| `api/family_chat.js`                | 279   | Vercel 端亲子对话 API                 |
| `functions/api/family_chat.js`      | 283   | Cloudflare 端亲子对话 API             |
| `js/family.js`                      | —     | 前端消费者（元数据缓存 + parentTips） |
| `data/family_metadata.json`         | —     | 完整版元数据（81 章节）               |
| `data/family_metadata_staging.json` | —     | AI 修订暂存区                         |
| `data/family_metadata_public.json`  | —     | 脱敏公开版（计划生成）                |

## 附录 B：状态机速查表

```
pending ──→ reviewing ──→ approved ──→ revision_needed
  │            │  │                        │
  │            │  └──→ revision_needed ────┘
  │            │                           │
  └────────────┘      ←───────────────────┘
       (退回)              (重新审核)
```

## 附录 C：下架/上架二次部署流程

| 步骤              | 操作                                               | 元数据变化                                      | 用户影响                                 |
| ----------------- | -------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| **1. 审核修订**   | 审核员完成修订审核，设置为 revision_needed         | `review_status → revision_needed`（完整版文件） | 无（公开版未变）                         |
| **2. AI 修订**    | 调用修订器，写入暂存区                             | 暂存区更新（生产文件未变）                      | 无                                       |
| **3. 管理员确认** | 同步暂存区到完整版，修改 review_status             | 完整版内容更新                                  | 无                                       |
| **4. 第一次部署** | 构建公开版：内容不变，仅 `review_status → pending` | `_public.json` 的 review_status 变更            | **新用户被拦截**，活跃用户继续使用旧内容 |
| **5. 等待 24h**   | 让活跃用户自然结束会话                             | —                                               | 新用户仍被拦截                           |
| **6. 第二次部署** | 构建公开版：新内容 + `review_status → approved`    | `_public.json` 内容+状态更新                    | 所有用户使用新内容                       |
