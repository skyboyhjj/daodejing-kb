# PROJECT_CONTEXT.md — Twin Ledger 项目上下文

> AI 辅助开发共享文件。三方分块维护，新对话中引用此文件即可快速理解项目全貌。
>
> 使用方式：在新对话中说 "参考 PROJECT_CONTEXT.md 继续开发 twin_ledger"

---

## 项目概述

**Twin Ledger Architecture (TLA) · 双账本架构** — 《道德经》81 章读解的双流水线系统。

> "Two ledgers, one spiral. Human reads, machine reasons, but the Dao remains unledgered."

- [GitHub 仓库](https://github.com/skyboyhjj/daodejing-kb) — `twin_ledger/` 目录
- **协作模式**: P4 v1.2 双炉分审制（生产炉 / 审阅炉 / 人工复核）
- **当前批次**: 批1（样章验证）— 第1-10章

核心模块：

| 模块 | 状态 | 说明 |
|------|:---:|------|
| HL (Human Ledger) | 🟢 稳定版 | 人读账，五步读解报告（`hl/chapters/ch{N:02d}.md`） |
| ML (Machine Ledger) | 🟢 稳定版 | 机备账，SPO 标准砖图谱（`ml/graph/ch{N}.json`） |
| 接口① 回收站 | 🟢 稳定版 | `recycle_crystal.py` — HL→ML 铸砖入库 |
| 接口② 净化钩子 | 🟢 稳定版 | `purify_crystal.py` — 铸砖前静默审查 |
| 接口③ 回灌 | 🟢 稳定版 | `backfill_crystal.py` — ML→HL 跨章提示 |
| 基准章 | 🔒 已锁定 | ch1_base / ch8_base（2026-08-15） |

---

## 架构/质量（慧惠）

### Schema 与判据

| 文件 | 用途 |
|------|------|
| `docs/01_双账本架构总纲.md` | 两本账三接口总纲 + 六缝补齐 + 三扇窗放生 |
| `docs/02_机备账Schema_v1.1_总纲.md` | ML 图谱 schema（三层构件 + 四态 + 窗在纸外） |
| `docs/03_若字谓词分判规范_附录A.md` | "若"字 41 处四类分判规则 |

### 铸砖脚本

| 文件 | 用途 |
|------|------|
| `scripts/recycle_crystal.py` | 接口① — 读解 → 谓词映射（32条）→ Validator → 入库 |
| `scripts/purify_crystal.py` | 接口② — 静默三问 + 三区分类（A 止语/B 损去/C 静默） |
| `scripts/backfill_crystal.py` | 接口③ — 跨章召回 + 推理策略 + 回灌响应区 |

### 质量门（每批强制）

| 门 | 检查项 | 阈值 | 责任 |
|----|--------|------|------|
| G1 铸砖率 | 入库砖 / 批内章数 | 100%（0 拒收） | 慧惠 |
| G2 ACTIVE 纯度 | ACTIVE 砖逐字对应原文直陈 | 100% | 慧惠 |
| G3 谓词合规 | 全部最小谓词集 | 100%（Validator 强制） | 慧惠 |
| G4 静默记录 | 有则记，无则记"无" | 100% 执行 | 慧惠 |
| G5 跨章召回 | 图谱实体可被其他章召回 | 抽查 ≥5 实体 | 慧惠 |
| G6a 污染级 | ACTIVE 误标/静默造假/谓词越界 | = 0 项 | 审阅炉 |
| G6b 优化级 | 止语/note 可改进 | 记录在案 | 审阅炉 |

### ML 数据

| 文件 | 说明 |
|------|------|
| `ml/graph/ch1.json` | 第1章 20 砖（0 ACTIVE / 20 EXTENSION） |
| `ml/graph/ch8.json` | 第8章 17 砖（1 ACTIVE / 16 EXTENSION） |
| `ml/graph/ch1_base.json` | 🔒 第1章基准版（锁定） |
| `ml/graph/ch8_base.json` | 🔒 第8章基准版（锁定） |
| `ml/purity/purity_ch1.json` | 第1章净化报告 |
| `ml/purity/purity_ch8.json` | 第8章净化报告 |
| `ml/purity/purity_ch1_base.json` | 🔒 第1章净化基准版（锁定） |
| `ml/purity/purity_ch8_base.json` | 🔒 第8章净化基准版（锁定） |
| `silent_log.md` | 静默日志（A 止语 2 + B 损去 8，不入图谱） |

---

## 工程/部署（TRAE）

### 双炉配置（P4 v1.2）

| 参数 | 生产炉 | 审阅炉 |
|------|--------|--------|
| 执行方 | TRAE 生产对话实例 | TRAE 审阅对话实例 |
| 模型 | DeepSeek（TRAE 任务对话框可选） | 与生产不同模型（GLM-5.3/kimi-k3 等） |
| 温度 | **0.8** | 0.1–0.3（低） |
| top_p | **0.9** | 0.7–0.9 |
| max_tokens | **12288** | — |
| 上下文 | 长（原文、考辨、互文、旧读解） | 4k–8k（只读提交物） |
| 提示词 | [`烧火童子01`](../../docs/03-twin_ledger/01-Prompt/烧火童子01_读解生成20260815.md) | `小澄真Validator` |
| 对话模式 | **单章独立对话** | 每批一个对话 |
| 输出 | Markdown 读解（含 SPO 块） | VALID/INVALID/XUAN + 问题编号 |

> 生产炉参数已确认（2026-08-15）：temperature=0.8, top_p=0.9, max_tokens=12288。审阅炉参数待实测确认。

### 目录结构

```
twin_ledger/
├── hl/chapters/          # 人读账（慧惠/TRAE 生产）
│   ├── ch01.md           # 命名规范：ch{N:02d}.md
│   └── ...
├── ml/
│   ├── graph/            # 标准砖图谱（回收站产出）
│   └── purity/           # 净化报告（净化钩子产出）
├── scripts/              # 三接口脚本（TL_ROOT 锚定）
├── reports/              # 交付报告
├── changelog/            # 变更日志（CHANGELOG-YYYY-MM-DD.md）
├── docs/                 # 架构文档
├── PROJECT_CONTEXT.md    # 本文件（三方共享上下文）
├── README.md
├── DEPLOY.md
└── silent_log.md
```

### 部署命令

```bash
# 前置条件：Python 3.8+（无外部依赖，仅标准库）
cd twin_ledger

# 步骤1：净化钩子
python scripts/purify_crystal.py --md "hl/chapters/ch{N:02d}.md" --chapter <N>

# 步骤2：回收站
python scripts/recycle_crystal.py --md "hl/chapters/ch{N:02d}.md" --chapter <N>

# 步骤3：回灌
python scripts/backfill_crystal.py --chapter <N>

# 纯 JSON 输出（供程序消费）
python scripts/backfill_crystal.py --chapter <N> --json
```

脚本默认路径已通过 `TL_ROOT`（`Path(__file__).parent.parent`）锚定到 `twin_ledger/` 根，CWD 无关。

### Git 工作流

- 单分支 `main`，直接提交
- 每批结束后：`git add` → `git commit` → `git push`
- 提交后更新本文件的相关条目
- CHANGELOG 按日期命名：`changelog/CHANGELOG-YYYY-MM-DD.md`

---

## 读解/审阅（DeepSeek → 审阅炉）

### 基准章（已锁定）

| 章 | 基准文件 | 图谱 | 净化 |
|----|----------|------|------|
| 第1章 | `ml/graph/ch1_base.json` | 0 ACTIVE / 20 EXTENSION | 5 静默 |
| 第8章 | `ml/graph/ch8_base.json` | 1 ACTIVE / 16 EXTENSION | 5 静默 |

### 读解进度

#### 批1 逐章追踪（第2-7、9-10章）

| 章 | 原文 | 生产炉 | 净化 | 回收站 | 回灌 | 备注 |
|----|:--:|:--:|:--:|:--:|:--:|------|
| ch02 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 天下皆知 |
| ch03 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 不尚贤 |
| ch04 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 道冲 |
| ch05 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 天地不仁 |
| ch06 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 谷神不死 |
| ch07 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 天长地久 |
| ch09 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 持而盈之 |
| ch10 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | 载营魄抱一 |

> 状态: ⏳ 待执行 | 🔥 生产中 | ✅ 完成 | ❌ 失败
> 工序: 生产炉 → 净化(purify_crystal.py) → 回收站(recycle_crystal.py) → 回灌(backfill_crystal.py) → Git push

#### 批次总览

| 批 | 章节 | 状态 | 说明 |
|----|------|:--:|------|
| 基准章 | 第1、8章 | 🔒 已锁定 | 2026-08-15 |
| 批1 | 第2-7、9-10章 | ⏳ 待生产 | 生产炉单章独立对话，双炉隔离（GitHub 共享） |
| 批2 | 第11-20章 | ⏳ 待启动 | 批1 静默期后 |
| 批3 | 第21-30章 | ⏳ 待启动 | |
| 批4 | 第31-37章 | ⏳ 待启动 | |

### 审阅记录

| 批次 | 审阅炉判定 | 污染级 | 优化级 | 人工复核 |
|------|-----------|:--:|:--:|:--:|
| 批1 | 待执行 | — | — | — |

---

## 版本控制约定

每次提交代码前：
1. 读取 `PROJECT_CONTEXT.md`，与本地实际状态比较
2. 如有冲突（文件不存在、接口变更、架构调整等），提示用户处理
3. 无冲突则提交，并在提交后更新 `PROJECT_CONTEXT.md` 的相关条目
4. **数据隐私检查（强制）**：提交前扫描以下敏感信息，确认未泄露：
   - API 密钥、Token、密码 — 本项目无外部 API 依赖，无此风险
   - 个人邮箱、手机号 — 检查 `DEPLOY.md` 和报告中的示例数据
   - 检查工具：`git diff --staged` 人工复核

## 待办 / 已完成 工作流

- 新任务 → 先添加到 **待办事项** 列表
- 任务完成 → 从待办移至 **已完成** 列表，标注编号、根因、修复、文件
- 更新 `PROJECT_CONTEXT.md` 时，检查待办列表中是否有已完成的项，一并移动

## 待办

- [ ] P4 批1：第2-7、9-10章生产炉产读解 → 净化回收 → 审阅炉 → 人工复核
- [ ] P4 批2-4：第11-37章批量重铸
- [ ] P5：全书（第1-81章）重铸
- [ ] 工程：编写 batch_crystal.py 批量执行 wrapper
- [ ] 工程：确认 TRAE 任务对话框中审阅炉模型参数的具体设定方式

---

## 已完成

### 1. P0 架构总纲定稿
- 内容：两本账三接口一循环 + schema v1.1 + 若字分判附录
- 文件：`docs/01_双账本架构总纲.md`, `docs/02_机备账Schema_v1.1_总纲.md`, `docs/03_若字谓词分判规范_附录A.md`

### 2. P1 回收站（接口①）实现
- 内容：`recycle_crystal.py` — 读解 → 谓词映射 → Validator → 入库
- 测试：第8章 17/17 通过，0 拒收
- 文件：`scripts/recycle_crystal.py`, `ml/graph/ch8.json`

### 3. P2 净化钩子（接口②）实现
- 内容：`purify_crystal.py` — 静默三问 + silent_log
- 联动：回收站检测净化报告 → silent_count 写入图谱
- 文件：`scripts/purify_crystal.py`, `silent_log.md`

### 4. P3 回灌（接口③）实现
- 内容：`backfill_crystal.py` — 跨章召回 + 推理策略 + 响应区
- 测试：第1章 33 实体/34 提示跨章召回
- 文件：`scripts/backfill_crystal.py`

### 5. TLA 命名与目录重构
- 根目录定名 `twin_ledger/`（下划线统一）
- 提交：`0cf83cc`（rename）, `d981e1b`（feat: add TLA v1.1）

### 6. v1.2 四项修正（DeepSeek 审阅反馈）
- 提交：`4e48a42`
- 修正 1：ACTIVE/EXTENSION 判据升级
- 修正 2：或然性 note 自动补注
- 修正 3：silent_log 三区分类
- 修正 4：TL_ROOT 路径锚定
- 文件：`scripts/*`, `ml/graph/*`, `ml/purity/*`, `silent_log.md`, `reports/*`

### 7. 注释清理
- 提交：`6aaabd3`
- 文件：`scripts/recycle_crystal.py`

### 8. changelog 目录 + PROJECT_CONTEXT 创建
- 提交：`a7d0791`（PROJECT_CONTEXT.md）, `1bc43a9`（changelog/ 目录）
- 文件：`PROJECT_CONTEXT.md`, `changelog/twin_ledger_GitHub更新_CHANGELOG.md`

### 9. P4 v1.2 双炉分审制启动
- 基准章锁定：ch1_base / ch8_base（2026-08-15）
- PROJECT_CONTEXT.md 改造为三方分块结构
- HL 章节目录创建（`hl/chapters/`，命名 `ch{N:02d}.md`）
- 生产炉模式：单章独立对话
- 审阅炉模型：TRAE 任务对话框可选（温度/上下文等参数待进一步确认）

---

## 新对话快速启动

在新对话中引用此文件即可继续开发：

> "参考 twin_ledger/PROJECT_CONTEXT.md 继续开发 Twin Ledger 双账本架构"