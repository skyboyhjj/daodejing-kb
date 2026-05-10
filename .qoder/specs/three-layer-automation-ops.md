# 三层代码库自动化运营方案

## Context

慧惠道德经亲子体验营（daodejing-kb）是一个纯静态网站，包含 81 个章节 HTML 文件（L1-L4 多认知层级）、客户端搜索引擎、AI 聊天组件。当前存在以下运营痛点：

1. **搜索索引手动维护**：`data/search-data.js`（33KB）需人工从 81 章提取文本编译，章节更新后易遗漏
2. **质量检查无自动化**：32 项质量清单完全靠人工逐条核对
3. **无版本追踪**：不知道哪些章节最近修改过、哪些需要刷新
4. **无 CI 管道**：推送到 Vercel 前无质量门禁

本方案遵循宪法第五条（减法优先）和第十条（外挂增强），设计一套**零依赖、纯 Node.js**的自动化运营体系。

---

## 架构总览

```
┌─── 触发方式 ──────────────────────────────────────┐
│  [手动] npm run pipeline                           │
│  [CI]   GitHub Actions on push                    │
│  [Qoder] Skill 生成新章节后执行                    │
└───────────────────────────────────────────────────┘
                     │
                     ▼
┌─── 管道流程 ──────────────────────────────────────┐
│                                                    │
│  ① validate.js ──→ ② build-index.js ──→ ③ manifest│
│     质量验证          搜索索引重建         版本追踪  │
│                                                    │
└───────────────────────────────────────────────────┘
                     │
                     ▼
┌─── 部署 ─────────────────────────────────────────┐
│  Vercel auto-deploy on git push（零改动）          │
└───────────────────────────────────────────────────┘
```

**三层映射**：

| 层级 | 职责 | 自动化脚本 |
|:---|:---|:---|
| **Base**（知识库） | chapters/*.html 源文件 | validate.js 验证完整性 |
| **View**（认知视图） | search-data.js / search-index.json | build-index.js 自动派生 |
| **SkillUP**（能力演化） | quality-report.json / chapter-manifest.json | report.js + manifest.js 生成健康度报告 |

---

## 实现清单

### 新增文件

| 文件路径 | 作用 | 优先级 |
|:---|:---|:---|
| `package.json` | 定义 npm run 脚本别名（零依赖） | P0 |
| `scripts/build-index.js` | 从 81 章 HTML 提取文本，重建搜索索引 | P0 |
| `scripts/validate.js` | 32 项质量检查的自动化实现 | P1 |
| `scripts/version-manifest.js` | 生成章节版本清单（hash + 修改日期 + 质量分） | P2 |
| `scripts/batch-runner.js` | 一键执行完整管道 | P2 |
| `scripts/report.js` | 生成健康度报告 | P2 |
| `.github/workflows/ci.yml` | GitHub Actions 质量门禁 | P1 |

### 不修改的文件

所有现有 HTML/CSS/JS 文件保持不变。自动化脚本只在 `scripts/` 目录中运行，输出写入 `data/` 目录。

---

## 详细设计

### 1. `package.json`（零依赖）

```json
{
  "name": "daodejing-kb",
  "version": "1.0.0",
  "private": true,
  "description": "道德经亲子体验营知识库",
  "scripts": {
    "dev": "node server.js",
    "validate": "node scripts/validate.js",
    "validate:ch": "node scripts/validate.js",
    "build:index": "node scripts/build-index.js",
    "build:manifest": "node scripts/version-manifest.js",
    "pipeline": "node scripts/batch-runner.js",
    "report": "node scripts/report.js"
  }
}
```

关键决策：**零 npm 依赖**。所有脚本仅使用 Node.js 内置模块（fs, path, crypto）。

### 2. `scripts/build-index.js`（搜索索引自动重建）

**核心逻辑**：

```
对每个 chapters/chXX.html：
  1. 提取章节号（从文件名）
  2. 提取标题（从 <title> 或 <h1>）
  3. 提取原文（从 .original-text div）
  4. 提取概念标签（从 .concept-tag span 的 class 名）
  5. 提取全文可搜索文本（所有 .level-block 内文本，去 HTML 标签）
  
输出：
  - data/search-data.js → window.__DaoSearchData = {...}
  - data/search-index.json → 纯 JSON 格式
```

**关键约束**：
- 输出格式必须与现有 `js/search.js` 完全兼容（`chapters` 数组，每项含 num/title/concepts/text 字段）
- 使用正则提取 HTML（不引入 DOM 库），因为章节 HTML 结构高度模板化
- 概念标签从 class 属性中匹配 concept-tags.json 中定义的 16 个合法标签

### 3. `scripts/validate.js`（质量门禁）

**分为两级检查**：

**结构检查（自动化，CI 阻断）**：
- S1: `<h1>` 标题格式正确（含章节号和主题名）
- S2: 五步导航栏存在（`class="five-step-nav"`）
- S3: 原文区块存在（`class="original-text"`）
- S4: 慧惠章节问候存在（`慧惠章节问候`）
- S5: AI 角色标注存在（`AI角色标注`）
- S6: 每个 step-section 含 L1-L4 data-level 块
- S7: 概念标签数量 ≥ 2
- S8: 脚本引用完整（search.js, level-filter.js, huihui-chat.js）

**语义检查（启发式，仅报告不阻断）**：
- 每步内容 ≥ 200 字符
- 无占位文本（`此处需要`、`TODO`、`待补充`）
- L1 块无学术术语（检查常见哲学术语出现在 data-level="l1" 块中）
- 跨章验证表存在（verify-table 或等价）

**CLI 用法**：
```
node scripts/validate.js          # 验证全部 81 章
node scripts/validate.js 42       # 仅验证第 42 章
node scripts/validate.js --strict # 语义检查也作为错误
```

### 4. `scripts/version-manifest.js`（版本追踪）

**输出** `data/chapter-manifest.json`：
```json
{
  "generated": "2026-05-09T10:00:00Z",
  "totalChapters": 81,
  "averageQuality": 28.5,
  "chapters": [
    {
      "num": 1,
      "title": "众妙之门",
      "contentHash": "sha256:a1b2c3...",
      "lastModified": "2026-05-08",
      "qualityScore": 30,
      "concepts": ["dao", "xuan"]
    }
  ]
}
```

**用途**：增量操作——只对 hash 变化的章节重新验证/索引。

### 5. `.github/workflows/ci.yml`（质量门禁）

```yaml
name: Quality Gate
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/validate.js
      - run: node scripts/build-index.js --check
        # --check 模式：生成索引但不写入文件，
        # 而是与现有 data/search-data.js 比较，
        # 如果不一致则报错（提示需要本地重建）
```

**设计原则**：
- CI **不自动提交**（避免循环，保持人类在环）
- CI 只做"检测"不做"修复"——告诉你问题在哪，你本地修复
- Vercel 部署独立于 CI（push 即部署，CI 只是质量报告）

---

## 日常工作流

### 流程 A：生成新章节

```
1. 调用 Qoder Skill 生成 chapters/ch42.html
2. npm run validate -- 42      # 验证新章节
3. 修复标记的问题
4. npm run build:index         # 重建搜索索引
5. git add && git commit && git push
6. CI 验证 → Vercel 部署
```

### 流程 B：批量更新（如添加问候语）

```
1. 编写 scripts/xxx-transform.js（参照 add-huihui-greeting.js 模式）
2. 运行转换脚本
3. npm run pipeline            # 验证 → 重建索引 → 更新清单
4. 检查报告，确认无章节质量下降
5. git add -A && git commit && git push
```

### 流程 C：日常健康巡检

```
1. npm run report              # 生成健康报告
2. 查看 data/quality-report.json
3. 优先修订"红色章节"（得分低于阈值）
4. 修订后 npm run build:index && git push
```

---

## 与现有 Skill 资产的对接

| Skill 资产 | 在本方案中的应用 |
|:---|:---|
| SK-01（Spec 驱动开发） | 新章节生成遵循 Skill.md 规格，validate.js 自动验收 |
| SK-04（零侵入架构） | 所有脚本在 scripts/ 独立目录，不改动已有代码 |
| SK-09（健康度评估） | report.js 实现简化版健康度公式：质量分 × 新鲜度 |
| SK-10（网站聊天组件） | 搜索索引更新保证聊天引用的章节内容是最新的 |
| 章节分析 Skill | build-index.js 自动提取 Skill 输出的 HTML 结构 |

---

## 实施顺序

**第一批（立即可用，最高价值）**：
1. `package.json` — 1 分钟创建
2. `scripts/build-index.js` — 解决搜索索引手动维护痛点
3. `scripts/validate.js`（结构检查部分） — 防止坏章节入库

**第二批（质量闭环）**：
4. `.github/workflows/ci.yml` — CI 门禁
5. `scripts/validate.js`（语义检查部分） — 完整 32 项覆盖

**第三批（运营智能）**：
6. `scripts/version-manifest.js` — 增量操作
7. `scripts/report.js` — 健康度看板
8. `scripts/batch-runner.js` — 一键管道

---

## 验证方式

实施完成后的验证步骤：

1. **build-index.js 验证**：运行脚本，对比生成的 `search-data.js` 与现有文件，确认格式一致且内容更完整
2. **validate.js 验证**：对已知有问题的章节运行，确认能正确检出；对高质量章节运行，确认不误报
3. **端到端验证**：修改某章节内容 → 运行 `npm run pipeline` → 确认搜索索引自动更新 → 本地 `npm run dev` 测试搜索功能正常
4. **CI 验证**：推送到 GitHub 分支 → 确认 Actions 运行 → 确认质量门禁正确阻断/放行

---

## 关键文件参考

| 文件 | 为什么重要 |
|:---|:---|
| `data/search-data.js` | build-index.js 的输出目标，必须保持与 search.js 兼容的格式 |
| `.qoder/skills/daodejing-chapter-analysis/quality-checklist.md` | validate.js 的 32 项检查规则来源 |
| `.qoder/skills/daodejing-chapter-analysis/concept-tags.json` | 合法概念标签的定义（16 个） |
| `.qoder/skills/daodejing-chapter-analysis/template.html` | 章节 HTML 结构的规范模板 |
| `scripts/add-huihui-greeting.js` | 批处理脚本的代码风格参考（CommonJS, regex-on-HTML, 幂等性检查） |
| `js/search.js` | 搜索引擎的数据格式要求（window.__DaoSearchData.chapters 数组） |
