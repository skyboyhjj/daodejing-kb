# Twin Ledger Architecture (TLA) · 双账本架构

> **"Two ledgers, one spiral. Human reads, machine reasons, but the Dao remains unledgered."**

---

## 命名

| 缩写 | 英文 | 中文 | 释义 |
|:---:|------|------|------|
| TLA | Twin Ledger Architecture | 双账本架构 | 总称 |
| HL | Human Ledger | 人读账 | 从体起用，把道读成话（平方） |
| ML | Machine Ledger | 机备账 | 摄用归体，把话铸成砖（开方） |

人读账与机备账，是同一个旋量场的两个正负解。
一个生"话"（为人），一个生"砖"（为机），同出而异名，同谓之玄。

它们是 720° 螺旋的两半程。Twin 不是两个东西并排站，是一个螺旋的两半，拆开即死，合上才转。

它们是相位锁定的孪生体。互相滋养，不是互相借用，而是像双螺旋的碱基对，一呼一吸，一益一损，缺一个，另一个就只是半条命。

---

## 核心架构

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

| 接口 | 方向 | 脚本 | 功能 |
|:---:|:---:|------|------|
| ① 回收站 | HL → ML | `recycle_crystal.py` | 五步读解 → 规范化铸砖 → 入库 |
| ② 净化钩子 | ●静默 | `purify_crystal.py` | 铸砖前静默审查 + 空白日志 |
| ③ 回灌 | ML → HL | `backfill_crystal.py` | 图谱跨章召回 → 提示注入读解 |

---

## 目录结构

```
twin_ledger/
├── README.md                   ← 本文件
├── DEPLOY.md                   ← 部署说明
├── silent_log.md               ← 静默日志（不入图谱）
├── docs/                       ← 架构文档
│   ├── 01_双账本架构总纲.md
│   ├── 02_机备账Schema_v1.1_总纲.md
│   └── 03_若字谓词分判规范_附录A.md
├── scripts/                    ← 三接口脚本
│   ├── recycle_crystal.py      ← 接口① 回收站 (HL→ML)
│   ├── purify_crystal.py       ← 接口② 净化钩子 (●静默)
│   └── backfill_crystal.py     ← 接口③ 回灌 (ML→HL)
├── hl/                         ← 人读账 (Human Ledger)
│   ├── README.md
│   └── chapters/               ← 五步读解报告
├── ml/                         ← 机备账 (Machine Ledger)
│   ├── README.md
│   ├── graph/                  ← 标准砖图谱
│   │   ├── ch1.json
│   │   └── ch8.json
│   └── purity/                 ← 净化报告
│       ├── purity_ch1.json
│       └── purity_ch8.json
└── reports/                    ← 交付与验证报告
    ├── P1_回收站_交付报告.md
    ├── P2_净化钩子_交付报告.md
    ├── P3_回灌脚本_交付报告.md
    └── 第1章全流程验证报告.md
```

---

## 四条红线

1. **HL SPO 不经回收站不得入 ML**
2. **ML 结论不经回灌不得入 HL**
3. **净化清单永不参与推理**
4. **回灌永远提示不结论**

---

## 当前状态

| 阶段 | 状态 |
|------|:---:|
| P0 架构总纲 | ✅ |
| P1 回收站 (HL→ML) | ✅ |
| P2 净化钩子 (●静默) | ✅ |
| P3 回灌 (ML→HL) | ✅ |
| P4 第1-37章批量重铸 | 待启动 |

**已入库**: 第1章 20 砖 + 第8章 17 砖 = 37 砖 / 11 静默 / 双螺旋第一轮闭合

---

## 复跑命令

```bash
cd twin_ledger/scripts

# 步骤1：净化钩子
python purify_crystal.py --md "<读解报告.md>" --chapter <N>

# 步骤2：回收站
python recycle_crystal.py --md "<读解报告.md>" --chapter <N>

# 步骤3：回灌
python backfill_crystal.py --chapter <N>
```

---

*"名与骨，就都定住了。"*