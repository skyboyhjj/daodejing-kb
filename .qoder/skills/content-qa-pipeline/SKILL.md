---
name: content-qa-pipeline
description: 道德经知识库内容质量保障流水线。对 81 个章节 HTML 文件执行结构化质量验证、搜索索引构建、版本清单更新和健康报告生成。覆盖 validate.js（22 条规则的结构化检查）、comprehensive-check-v2.js（C1-C5 五维深度检查）、build-index.js（全文搜索索引生成）、version-manifest.js（内容 hash 变更追踪）和 report.js（聚合健康报告）。通过 batch-runner.js 编排为完整流水线或快速模式。当用户需要检查章节质量、生成搜索索引、追踪内容变更、或生成项目健康报告时使用本 Skill。
---

# 内容质量保障流水线

道德经知识库的自动化质量保障体系，对 81 个章节 HTML 文件执行多维度的结构化检查与索引维护。

## 1. 流水线架构

### 1.1 组件关系

```
                   batch-runner.js (流水线编排器)
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    validate.js      build-index.js    version-manifest.js
   (22条规则检查)    (搜索索引构建)     (内容 hash 追踪)
          │                │                │
          └────────────────┴────────────────┘
                           │
                           ▼
                     report.js
                   (健康报告聚合)
```

### 1.2 两种运行模式

| 模式       | 命令                          | 包含步骤                                           |
| ---------- | ----------------------------- | -------------------------------------------------- |
| 完整流水线 | `npm run pipeline`            | validate → build-index → version-manifest → report |
| 快速模式   | `npm run pipeline -- --quick` | validate → build-index                             |
| CI 模式    | `npm run ci`                  | validate + build-index --check (仅检查不写出)      |

### 1.3 各脚本职责概览

| 脚本                        | npm 命令                                 | 输入                                | 输出                                         | 失败则中断流水线 |
| --------------------------- | ---------------------------------------- | ----------------------------------- | -------------------------------------------- | :--------------: |
| `validate.js`               | `npm run validate`                       | chapters/ch*.html                   | 终端报告                                     |        ✅         |
| `comprehensive-check-v2.js` | `node scripts/comprehensive-check-v2.js` | chapters/ch*.html (81章)            | 终端分类报告                                 |  —（独立运行）   |
| `build-index.js`            | `npm run build:index`                    | chapters/ch*.html + concepts/*.html | data/search-data.js + data/search-index.json |        ✅         |
| `version-manifest.js`       | `npm run version`                        | chapters/ch*.html                   | data/chapter-manifest.json                   |        ✅         |
| `report.js`                 | `npm run report`                         | 聚合以上各步骤结果                  | data/quality-report.json                     |        ✅         |

---

## 2. 第 1 步：结构化质量验证 (validate.js)

### 2.1 检查规则体系

22 条规则分为 8 大类：

| 类别        | 规则 ID                                      | 数量  | 检查内容                                                        |
| ----------- | -------------------------------------------- | :---: | --------------------------------------------------------------- |
| S1 基础结构 | S1-DOCTYPE, S1-LANG, S1-CHARSET, S1-VIEWPORT |   4   | `<!DOCTYPE html>`、`lang="zh-CN"`、meta charset UTF-8、viewport |
| S2 标题结构 | S2-H1, S2-TITLE-FORMAT, S2-CHAPTER-NUM       |   3   | h1 唯一性、title 格式一致性、章节号匹配文件名                   |
| S3 五步导航 | S3-NAV, S3-NAV-LINKS                         |   2   | 五步导航区块存在、5 个步骤链接                                  |
| S4 原文区块 | S4-ORIGINAL, S4-NOT-EMPTY                    |   2   | div.original-text 存在、内容 > 10 字符                          |
| S5 认知层级 | S5-LEVEL-SELECTOR, S5-L1~L4                  |   5   | 层级选择器 + L1/L2/L3/L4 4 层内容                               |
| S6 概念标签 | S6-HAS-CONCEPTS, S6-VALID-CONCEPTS           |   2   | 至少 1 个概念标签、所有标签在 16 个有效清单内                   |
| S7 慧惠元素 | S7-GREETING, S7-AI-NOTE                      |   2   | 慧惠章节问候、AI 角色标注                                       |
| S8 文件结构 | S8-CSS, S8-CLOSING                           |   2   | 链接统一样式文件、HTML 标签正确闭合                             |

### 2.2 有效概念标签清单（16 个）

```
dao, de, wuwei, ziran, fan, xuan,
rouruo, pu, yi, jing, xia, zhizu,
buzheng, qiantui, yinger, shouzhong
```

### 2.3 用法

```bash
# 验证全部 81 章
npm run validate
node scripts/validate.js

# 验证指定章节（支持 ch01 或 1）
node scripts/validate.js ch01
node scripts/validate.js 53
node scripts/validate.js ch01 ch08 ch53

# 自动修复模式（当前为预留功能）
npm run validate:fix
node scripts/validate.js --fix
```

### 2.4 输出示例

```
[validate] 检查 81 个章节文件，22 条规则

  FAIL  ch76.html (2/22 项不通过)
        ✗ [S5-L4] 必须含 L4（学术）层级内容
        ✗ [S6-VALID-CONCEPTS] 所有概念标签必须在有效清单内

──────────────────────────────────────────────────
[validate] 结果: 1780/1782 通过
[validate] 1 个文件有问题，共 2 项不通过
```

---

## 3. 第 2 步：搜索索引构建 (build-index.js)

### 3.1 构建流程

```
chapters/ch01~ch81.html
        │
        ├─→ 提取标题 (h1)
        ├─→ 提取原文 (div.original-text)
        ├─→ 提取概念标签 (span.concept-tag)
        ├─→ 提取认知层级 (data-level="l1"~"l4")
        └─→ 提取全文文本（去标签、去实体）
        │
        ▼
   搜索文本拼接:
   原文 + 标题 + 概念关键词 + 五步关键词 + 层级关键词 + 全文
        │
        ├─→ data/search-data.js   (window.__DaoSearchData = {...})
        └─→ data/search-index.json (机器可读 JSON)
```

### 3.2 索引条目结构

```javascript
{
  num: 1,
  title: "第1章 · 道可道",
  concepts: ["dao", "xuan"],
  text: "道可道非常道 ... (搜索全文)",
  url: "chapters/ch01",
  levels: ["l1", "l2", "l3", "l4"]
}
```

### 3.3 用法

```bash
# 重新构建索引
npm run build:index
node scripts/build-index.js

# 仅检查索引是否过期（CI 用，不写出文件）
node scripts/build-index.js --check
```

### 3.4 输出示例

```
[build-index] 扫描到 81 个章节文件
[build-index] 输出: data/search-data.js (428.3 KB)
[build-index] 输出: data/search-index.json (233.5 KB)
[build-index] 完成: 81 章索引已生成
```

### 3.5 --check 模式

通过 SHA-256 hash 比较当前章节源文件与已生成索引，判断索引是否过期：

```
[build-index] OK: 搜索索引已是最新 (hash: a1b2c3d4e5f6)
```

若不一致则退出码为 1，CI 流水线会触发重新构建。

---

## 4. 第 3 步：版本清单更新 (version-manifest.js)

### 4.1 清单字段

```json
{
  "generated": "2026-05-14T10:30:00.000Z",
  "totalChapters": 81,
  "fullyUpgraded": 78,
  "chapters": {
    "ch01.html": {
      "num": 1,
      "hash": "a1b2c3d4e5f6",
      "modified": "2026-05-10",
      "completeness": "5/5",
      "fullUpgrade": true
    }
  }
}
```

- **hash**: 文件内容 SHA-256 前 12 位
- **completeness**: 五维度（层级选择器 + L1/L2/L3/L4）评分
- **fullUpgrade**: 五维度全部满足

### 4.2 用法

```bash
# 生成/更新清单
npm run version
node scripts/version-manifest.js

# 比较与上次清单的变更（不写出文件）
node scripts/version-manifest.js --diff
```

### 4.3 --diff 模式输出

```
  ~ ch53.html (已变更: a1b2c3d4e5f6 → x9y8z7u6v5w4)
  + ch82.html (新增)

[version-manifest] 汇总: 1 新增, 1 变更
```

---

## 5. 第 4 步：健康报告聚合 (report.js)

### 5.1 采集维度

| 维度       | 采集方式                         | 字段                         |
| ---------- | -------------------------------- | ---------------------------- |
| 章节统计   | 直接扫描 chapters/ 目录          | totalChapters, totalSizeKB   |
| 四层级覆盖 | 正则匹配 `data-level="l1"` 等    | withFourLevels               |
| 慧惠问候   | 正则匹配 `<!-- 慧惠章节问候 -->` | withHuihuiGreeting           |
| 概念标签   | 正则扫描 + 使用统计              | conceptUsage, unusedConcepts |
| 验证通过率 | 运行 validate.js 并解析输出      | passRate, passPercent        |
| 搜索索引   | 运行 build-index.js --check      | upToDate                     |
| 版本清单   | 读取 chapter-manifest.json       | fullyUpgraded                |

### 5.2 输出文件结构

```json
{
  "generated": "2026-05-14T10:30:00.000Z",
  "summary": {
    "overallHealth": "GOOD",
    "validationPassRate": "1780/1782",
    "searchIndexUpToDate": true,
    "fourLevelCoverage": "81/81"
  },
  "metrics": { "...": "..." },
  "validation": { "...": "..." },
  "searchIndex": { "upToDate": true },
  "manifest": { "...": "..." }
}
```

### 5.3 健康等级判定

| 验证通过率 | 等级            |
| ---------- | --------------- |
| ≥ 90%      | GOOD            |
| 70% ~ 89%  | FAIR            |
| < 70%      | NEEDS_ATTENTION |

### 5.4 用法

```bash
npm run report
node scripts/report.js
```

---

## 6. 第 5 步（可选）：深度一致性检查 (comprehensive-check-v2.js)

### 6.1 五维检查体系

| 维度          | 检查项数 | 关注点                                    | 严重级别标记 |
| ------------- | :------: | ----------------------------------------- | :----------: |
| C1 内容完整性 |    9     | 五步结构、L1~L4 块数、概念标签、原文      |    🔴 HIGH    |
| C2 样式一致性 |    7     | level-block CSS、按钮样式、默认隐藏规则   |    🟡 MED     |
| C3 功能一致性 |    4     | level-filter.js 引用、选择器 ID、数据属性 |    🔴 HIGH    |
| C4 特殊元素   |    8     | 慧惠问候、AI 标注、导航、金句、聊天组件   | 🔴/= HIGH/MED |
| C5 文件结构   |    6     | DOCTYPE、head、CSS 引用、脚本引用、页脚   | 🔴/= HIGH/MED |

### 6.2 用法

```bash
# 运行全面检查
node scripts/comprehensive-check-v2.js
```

### 6.3 输出示例

```
── 按检查项汇总 ──

  ✅ C1-STEP1-5 [五步结构完整]: 全部通过
  🔴 C1-L4 [L4认知层内容 (>=4块)]: 3章
      章节: 76, 77, 79
  ✅ C4-HUIHUI [慧惠AI问候语]: 全部通过

── 按严重级别汇总 ──

  🔴 HIGH: 3章受影响
  🟡 MED:  0章受影响
  🟢 LOW:  0章受影响
```

---

## 7. 流水线编排 (batch-runner.js)

### 7.1 执行逻辑

按序执行每个步骤，任一步骤失败则立即终止并报告：

```
[1/4] 结构质量验证 (validate)...
  → PASS (234ms)
[2/4] 搜索索引构建 (build-index)...
  → PASS (189ms)
[3/4] 版本清单更新 (version-manifest)...
  → PASS (56ms)
[4/4] 健康报告生成 (report)...
  → PASS (312ms)

──────────────────────────────────────────────────
  PIPELINE COMPLETE (791ms)
  4/4 步骤通过
```

### 7.2 用法

```bash
# 完整流水线
npm run pipeline

# 快速流水线（仅 validate + build-index）
npm run pipeline -- --quick

# CI 模式（验证 + 索引检查，不写出文件）
npm run ci
```

---

## 8. 典型工作流

### 8.1 日常开发后检查

```bash
# 1. 快速验证 + 索引检查
npm run ci

# 2. 如有问题，查看详情
node scripts/validate.js

# 3. 修复后重新构建索引
npm run build:index

# 4. 发布前完整流水线
npm run pipeline
```

### 8.2 章节内容更新后

```bash
# 1. 验证修改的章节
node scripts/validate.js ch53

# 2. 查看变更
node scripts/version-manifest.js --diff

# 3. 重新构建索引
npm run build:index

# 4. 生成最新报告
npm run report
```

### 8.3 全量质量审计

```bash
# 1. 标准验证
npm run validate

# 2. 深度一致性检查
node scripts/comprehensive-check-v2.js

# 3. 生成完整报告
npm run pipeline
```

---

## 9. 故障排除

### 9.1 validate.js 失败

| 常见错误          | 原因                        | 解决                                                            |
| ----------------- | --------------------------- | --------------------------------------------------------------- |
| S5-L1~L4 不通过   | 章节缺少某认知层级          | 运行 `daodejing-chapter-analysis` Skill 重新生成该章节          |
| S6-VALID-CONCEPTS | 使用了未定义的概念标签      | 检查 `class="concept-tag xxx"` 中的标签名是否在 16 个有效清单内 |
| S2-CHAPTER-NUM    | h1 中的章节号与文件名不一致 | 以文件名为准，修正 h1 中的章节号                                |
| S3-NAV-LINKS      | 五步导航链接不完整          | 确保 5 个 `<a href="#stepN">` 链接都存在                        |

### 9.2 build-index.js 失败

| 症状                 | 原因                           | 解决                                           |
| -------------------- | ------------------------------ | ---------------------------------------------- |
| "未找到任何章节文件" | chapters/ 目录为空或无匹配文件 | 确认 `chapters/ch*.html` 存在                  |
| 某章标题为空         | h1 标签格式异常                | 检查该章的 h1 标签是否遵循 `第X章 · 标题` 格式 |
| --check 报告过期     | 章节文件修改后未重建索引       | 运行 `npm run build:index`                     |

### 9.3 report.js 失败

| 症状             | 原因                     | 解决                                             |
| ---------------- | ------------------------ | ------------------------------------------------ |
| 验证结果解析失败 | validate.js 输出格式变化 | 直接运行 `node scripts/validate.js` 确认输出格式 |
| 搜索索引检查失败 | search-data.js 不存在    | 先运行 `npm run build:index`                     |

---

## 附录：快速命令参考

```bash
# 标准验证
npm run validate                              # 验证 81 章
node scripts/validate.js ch01 ch08 ch53       # 验证指定章节

# 深度检查
node scripts/comprehensive-check-v2.js        # C1-C5 五维检查

# 索引构建
npm run build:index                           # 构建搜索索引
node scripts/build-index.js --check           # 仅检查索引是否过期

# 版本管理
npm run version                               # 生成版本清单
node scripts/version-manifest.js --diff       # 查看变更

# 报告
npm run report                                # 生成健康报告

# 流水线
npm run pipeline                              # 完整流水线（4 步）
npm run pipeline -- --quick                   # 快速流水线（2 步）
npm run ci                                    # CI 模式（验证+检查）
```
