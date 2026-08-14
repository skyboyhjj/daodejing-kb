# Machine Ledger (ML) · 机备账

> **摄用归体，把话铸成砖。**
>
> The square root: words crystallize into bricks for machine reasoning.

---

## 定位

机备账是双账本架构的"砖"侧——标准 SPO 图谱，为机器推理与检索服务。

Schema v1.1 定义三层核心构件：
- **节点层**：本体-分相双层（`水` / `水-8-上善`）
- **边层**：喻/实/逻辑/玄 四型 + 最小谓词集
- **状态层**：ACTIVE/EXTENSION/XUAN/SILENT 四态

---

## 目录

```
ml/
├── README.md
├── graph/           ← 标准砖图谱
│   ├── ch1.json     ← 第1章（20 砖）
│   └── ch8.json     ← 第8章（17 砖）
└── purity/          ← 净化报告
    ├── purity_ch1.json
    └── purity_ch8.json
```

---

## 图谱 Schema (v1.1)

```json
{
  "schema": "machine_ledger_v1.1",
  "chapter": 1,
  "spo": [
    {
      "subject": "实体-章",
      "subject_base": "实体",
      "predicate": "谓词",
      "edge_type": "实|逻辑|喻|玄",
      "object": "实体-章",
      "object_base": "实体",
      "source": "1.",
      "status": "ACTIVE|EXTENSION|XUAN|SILENT",
      "subtype": "metaphor|condition|reasoning|interrogative|null",
      "note": "备注"
    }
  ],
  "silent_crystals": [],
  "silent_count": 0,
  "purity": {
    "reviewed": true,
    "questions": ["...", "..."],
    "note": "..."
  }
}
```

## 四态定义

| STATUS | 含义 | 标注 |
|:------:|------|------|
| ACTIVE | 文本直陈，可机器推理 | 🔵文本事实 |
| EXTENSION | 解读推演，非文本直陈 | 🟠创见延伸 |
| XUAN | 玄边，不可机械推断 | ○玄 |
| SILENT | 静默，不入推理 | ●静默 |

---

## 流向

```
HL (人读账) ──① 回收站──> ML (机备账)
HL (人读账) <──③ 回灌─── ML (机备账)
```

---

## 当前图谱

| 章 | 砖数 | ACTIVE | EXTENSION | 静默 |
|----|:---:|:------:|:---------:|:---:|
| 第1章 | 20 | 6 | 14 | 5 |
| 第8章 | 17 | 4 | 13 | 6 |

---

*"开方：摄用归体，把话铸成砖。"*