# PROJECT_CONTEXT.md — Twin Ledger 项目上下文

> AI 辅助开发共享文件。新对话中引用此文件即可快速理解项目全貌。
>
> 使用方式：在新对话中说 "参考 PROJECT_CONTEXT.md 继续开发 twin_ledger"

---

## 项目概述

**Twin Ledger Architecture (TLA) · 双账本架构** — 《道德经》81 章读解的双流水线系统。

> "Two ledgers, one spiral. Human reads, machine reasons, but the Dao remains unledgered."

- [GitHub 仓库](https://github.com/skyboyhjj/daodejing-kb) — `twin_ledger/` 目录

核心模块：

| 模块 | 状态 | 说明 |
|------|:---:|------|
| HL (Human Ledger) | 🟢 稳定版 | 人读账，五步读解报告（从体起用，把道读成话） |
| ML (Machine Ledger) | 🟢 稳定版 | 机备账，SPO 标准砖图谱（摄用归体，把话铸成砖） |
| 接口① 回收站 | 🟢 稳定版 | `recycle_crystal.py` — HL→ML 铸砖入库 |
| 接口② 净化钩子 | 🟢 稳定版 | `purify_crystal.py` — 铸砖前静默审查 |
| 接口③ 回灌 | 🟢 稳定版 | `backfill_crystal.py` — ML→HL 跨章提示 |

## 关键文件

### 架构文档

| 文件 | 用途 |
|------|------|
| `docs/01_双账本架构总纲.md` | 两本账三接口总纲 + 六缝补齐 + 三扇窗放生 |
| `docs/02_机备账Schema_v1.1_总纲.md` | ML 图谱 schema（三层构件 + 四态 + 窗在纸外） |
| `docs/03_若字谓词分判规范_附录A.md` | "若"字 41 处四类分判规则 |

### 脚本（三接口）

| 文件 | 用途 |
|------|------|
| `scripts/recycle_crystal.py` | 接口① — 读解 → 谓词映射 → Validator → 入库 ml/graph/ |
| `scripts/purify_crystal.py` | 接口② — 静默三问 + 三区分类（A 止语/B 损去/C 静默） |
| `scripts/backfill_crystal.py` | 接口③ — 跨章召回 + 推理策略 + 回灌响应区 |

### 数据（ML 侧）

| 文件 | 用途 |
|------|------|
| `ml/graph/ch1.json` | 第1章 20 砖（0 ACTIVE / 20 EXTENSION） |
| `ml/graph/ch8.json` | 第8章 17 砖（1 ACTIVE / 16 EXTENSION） |
| `ml/purity/purity_ch1.json` | 第1章净化报告（5 静默） |
| `ml/purity/purity_ch8.json` | 第8章净化报告（5 静默） |
| `silent_log.md` | 静默日志（A 止语 2 + B 损去 8，不入图谱） |

### 入口文档

| 文件 | 用途 |
|------|------|
| `README.md` | 项目总纲索引 + 命名体系（TLA/HL/ML） |
| `DEPLOY.md` | 部署说明（环境、命令、谓词集、schema、FAQ） |
| `hl/README.md` | 人读账说明（HL 定位 + 谓词规范 + 静默标记格式） |
| `ml/README.md` | 机备账说明（ML 定位 + schema + 四态定义） |

### 交付报告

| 文件 | 用途 |
|------|------|
| `reports/P1_回收站_交付报告.md` | 回收站验证（17/17 通过，0 拒收） |
| `reports/P2_净化钩子_交付报告.md` | 净化钩子验证（silent_log 三区格式） |
| `reports/P3_回灌脚本_交付报告.md` | 回灌验证（33 实体/34 提示跨章召回） |
| `reports/第1章双账本全流程验证报告.md` | 第1章端到端验证（含 6→0 ACTIVE 修正） |
| `twin_ledger_GitHub更新_CHANGELOG.md` | v1.2 四项修正更新记录 |

## 部署命令

```bash
# 前置条件：Python 3.8+（无外部依赖，仅标准库）

cd twin_ledger

# 步骤1：净化钩子
python scripts/purify_crystal.py --md "hl/chapters/<读解报告>.md" --chapter <N>

# 步骤2：回收站
python scripts/recycle_crystal.py --md "hl/chapters/<读解报告>.md" --chapter <N>

# 步骤3：回灌
python scripts/backfill_crystal.py --chapter <N>

# 纯 JSON 输出（供程序消费）
python scripts/backfill_crystal.py --chapter <N> --json
```

脚本默认路径已通过 `TL_ROOT`（`Path(__file__).parent.parent`）锚定到 `twin_ledger/` 根，CWD 无关。

## 架构

```
          ┌──────────────────────────────────┐
          │        Twin Ledger (TLA)          │
          │                                   │
          │  ┌─────────┐       ┌───────────┐ │
          │  │   HL    │ ═══①══> │    ML     │ │
          │  │ 人读账  │ <══③═══ │  机备账   │ │
          │  │ (话)    │       │  (砖)     │ │
          │  └────┬────┘       └─────┬─────┘ │
          │       │                  │        │
          │       └──── ② ●静默 ────┘        │
          └──────────────────────────────────┘
```

| 组件 | 部署方式 | 说明 |
|------|----------|------|
| recycle_crystal.py | 本地 Python 脚本 | 谓词映射表（32条）+ 最小谓词集（41个） |
| purify_crystal.py | 本地 Python 脚本 | 静默三问 + classify_silent() 三区分类 |
| backfill_crystal.py | 本地 Python 脚本 | 推理策略（逻辑/实 1.0，喻 0.5，玄 0.2） |
| ml/graph/ | JSON 静态文件 | 手工/脚本产出，Git 版本控制 |
| ml/purity/ | JSON 静态文件 | 净化报告，回收站联动 |
| silent_log.md | Markdown 静态文件 | 不入图谱，不参与推理，不接受版本冻结 |

## 分支管理 SOP

单分支 `main`，直接提交。

## 版本控制约定

每次提交代码前：
1. 读取 `PROJECT_CONTEXT.md`，与本地实际状态比较
2. 如有冲突（文件不存在、接口变更、架构调整等），提示用户处理
3. 无冲突则提交，并在提交后更新 `PROJECT_CONTEXT.md` 的相关条目
4. **数据隐私检查（强制）**：提交前扫描以下敏感信息，确认未泄露：
   - API 密钥、Token、密码 — 本项目无外部 API 依赖，无此风险
   - 个人邮箱、手机号 — 检查 `DEPLOY.md` 和报告中的示例数据
   - 检查工具：`git diff --staged` 人工复核

## 已完成

### 1. P0 架构总纲定稿
- 内容：两本账三接口一循环 + schema v1.1 + 若字分判附录
- 文件：`docs/01_双账本架构总纲.md`, `docs/02_机备账Schema_v1.1_总纲.md`, `docs/03_若字谓词分判规范_附录A.md`

### 2. P1 回收站（接口①）实现
- 内容：`recycle_crystal.py` — 读解 → 谓词映射 → Validator → 入库
- 测试：第8章 17/17 通过，0 拒收
- 文件：`scripts/recycle_crystal.py`, `ml/graph/ch8.json`

### 3. P2 净化钩子（接口②）实现
- 内容：`purify_crystal.py` — 静默三问 + silent_log 空白日志
- 联动：回收站检测净化报告 → silent_count 写入图谱
- 文件：`scripts/purify_crystal.py`, `silent_log.md`

### 4. P3 回灌（接口③）实现
- 内容：`backfill_crystal.py` — 跨章召回 + 推理策略 + 响应区
- 测试：第1章 33 实体/34 提示跨章召回
- 文件：`scripts/backfill_crystal.py`

### 5. TLA 命名与目录重构
- 根目录定名 `twin_ledger/`（下划线统一）
- HL/ML 分列两侧，三接口脚本守于 `scripts/`
- 命名体系：TLA（Twin Ledger Architecture）/ HL（Human Ledger）/ ML（Machine Ledger）
- 提交：`0cf83cc`（rename）, `d981e1b`（feat: add TLA v1.1）

### 6. v1.2 四项修正（DeepSeek 审阅反馈）
- 提交：`4e48a42`（twin_ledger: sync v1.2 four fixes）
- 修正 1：ACTIVE/EXTENSION 判据升级 — source 无原文短句 → 默认 EXTENSION（宁降勿升）；逻辑谓词（故/则/因/以）+ 原文短主体（≤8字）放行 ACTIVE
- 修正 2：或然性 note 自动补注 — 谓词含"更可能/可能/似乎/或许"时补"更可能，非确定（或然性推演）"
- 修正 3：silent_log 三区分类 — `classify_silent()` 函数，A 止语边界 / B 损去浮尘 / C 静默晶体
- 修正 4：TL_ROOT 路径锚定 — `Path(__file__).parent.parent`，CWD 无关化
- 数据影响：ch1 6→0 ACTIVE（全 EXTENSION），ch8 1 ACTIVE 保留
- 文件：`scripts/recycle_crystal.py`, `scripts/purify_crystal.py`, `scripts/backfill_crystal.py`, `ml/graph/ch1.json`, `ml/graph/ch8.json`, `ml/purity/purity_ch1.json`, `ml/purity/purity_ch8.json`, `silent_log.md`, `reports/*`

### 7. 注释清理
- 提交：`6aaabd3`（fix: remove duplicate comment in recycle_crystal.py L312）
- 文件：`scripts/recycle_crystal.py`

## 待办 / 已完成 工作流

- 新任务 → 先添加到 **待办事项** 列表
- 任务完成 → 从待办移至 **已完成** 列表，标注编号、根因、修复、文件
- 更新 `PROJECT_CONTEXT.md` 时，检查待办列表中是否有已完成的项，一并移动

## 待办

- [ ] P4：第1-37章（道经上篇）批量重铸
- [ ] P5：全书（第1-81章）重铸

## 新对话快速启动

在新对话中引用此文件即可继续开发：

> "参考 twin_ledger/PROJECT_CONTEXT.md 继续开发 Twin Ledger 双账本架构"