# CHANGELOG · twin_ledger 更新（2026-08-14）

> 本次更新对应本地 **v1.2 四项修正版**（DeepSeek 审阅反馈全部落实）。
> GitHub 仓库原文件为 v1.2 修正前版本，需按此清单更新。

---

## 版本说明

- **本地版本**: P1-P3 v1.2（四项修正版）+ TLA 目录重构
- **GitHub 状态**: 修正前（缺 4 项修正 + 路径未适配）
- **本次动作**: 12 文件更新（7 必须 + 4 报告 + 1 日志）

---

## 一、脚本更新（3 个）

### 1. `scripts/recycle_crystal.py` — 回收站（接口①）

| 变更 | 说明 |
|------|------|
| **ACTIVE/EXTENSION 判据升级** | 新增：source 无原文短句 → 默认 EXTENSION（宁降勿升）；逻辑谓词（故/则/因/以）+ 原文短主体（≤8字）放行 ACTIVE |
| **或然性 note** | 谓词含"更可能/可能/似乎/或许"时，note 自动补"更可能，非确定（或然性推演）" |
| **版本考辨扩展** | 主体前缀补：王安石/苏辙/本章两大歧解 → EXTENSION |
| **新谓词映射** | 支持第1章版本考辨类：异/从/谓/指 |
| **TL_ROOT 锚定** | 路径 CWD 无关化（适配 GitHub `scripts/` 布局） |

**数据影响**：第1章 20 砖从"6 ACTIVE + 14 EXTENSION"修正为"**0 ACTIVE + 20 EXTENSION**"（全解读推演）；第8章保留唯一真直陈"夫唯不争→故→无尤"（1 ACTIVE）。

### 2. `scripts/purify_crystal.py` — 净化钩子（接口②）

| 变更 | 说明 |
|------|------|
| **静默三区分类** | silent_log 分列：A 止语边界 / B 损去浮尘 / C 静默晶体（classify_silent 函数） |
| **格式升级** | 由"单表+类型列"改为"三区独立小节表" |
| **TL_ROOT 锚定** | 路径 CWD 无关化 |

**数据影响**：silent_log 第1/8章各 5 条，按类型分入 A/B/C 区。

### 3. `scripts/backfill_crystal.py` — 回灌（接口③）

| 变更 | 说明 |
|------|------|
| **TL_ROOT 锚定** | 路径 CWD 无关化（适配 GitHub `scripts/` 布局） |

> 注：`--json` 纯输出修复在 GitHub 上已有，本包保持一致。

---

## 二、数据更新（5 个）

| 文件 | 修正前 | 修正后 |
|------|--------|--------|
| `ml/graph/ch1.json` | 6 ACTIVE / 14 EXTENSION | **0 ACTIVE / 20 EXTENSION** |
| `ml/graph/ch8.json` | — | **1 ACTIVE / 16 EXTENSION**（保留"夫唯不争→故→无尤"） |
| `ml/purity/purity_ch1.json` | 旧版 | 最新（含三问 + 自动提取 5 静默） |
| `ml/purity/purity_ch8.json` | 旧版 | 最新（含三问 + 自动提取 5 静默） |
| `silent_log.md` | 单表（带类型列） | **三区分列**（A 止语 2 + B 损去 8） |

---

## 三、报告更新（4 个）

| 文件 | 更新点 |
|------|--------|
| `reports/P1_回收站_交付报告.md` | STATUS 判定结果同步（第1章全 EXTENSION 说明） |
| `reports/P2_净化钩子_交付报告.md` | silent_log 三区格式同步 |
| `reports/P3_回灌脚本_交付报告.md` | 路径/数据引用同步 |
| `reports/第1章双账本全流程验证报告.md` | 6 ACTIVE → 0 ACTIVE 的修正说明 |

---

## 四、未更新文件（已是最新，无需动）

| 文件 | 原因 |
|------|------|
| `docs/01_双账本架构总纲.md` | ✅ 含六缝补齐 + 三扇窗放生 |
| `docs/02_机备账Schema_v1.1_总纲.md` | ✅ 含"窗在纸外"（250 行一致） |
| `docs/03_若字谓词分判规范_附录A.md` | ✅ subtype 枚举必填版 |
| `README.md` / `DEPLOY.md` / `hl/README.md` / `ml/README.md` | ✅ 命名版，未涉及修正 |

---

## 五、提交建议信息

```text
twin_ledger: sync v1.2 four fixes from review

- recycle: ACTIVE/EXTENSION judge upgrade (source-based, prefer-conservative)
- recycle: add probability note for uncertain predicates (更可能，非确定)
- purify: split silent_log into 3 zones (A 止语 / B 损去 / C 静默晶体)
- backfill: TL_ROOT path anchoring for GitHub layout
- graph: ch1 20 EXTENSION (0 ACTIVE), ch8 1 ACTIVE + 16 EXTENSION
- reports: sync P1/P2/P3/ch1-verification with corrected data

Two ledgers, one spiral.
```

---

*CHANGELOG 生成: 2026-08-14 | 对应更新包: twin_ledger_GitHub更新包.zip*
