# Twin Ledger (TLA) v1.1 · 部署说明

**版本**: v1.1  
**日期**: 2026-08-14  
**范围**: 双账本三接口（回收站 / 净化钩子 / 回灌脚本）全实现  
**状态**: P0 架构 ✅ / P1 回收站 ✅ / P2 净化 ✅ / P3 回灌 ✅

---

## 1. 项目概述

"Twin Ledger Architecture"（双账本架构），将《道德经》81 章读解分为两条并行且互相滋养的流水线：

```
Human Ledger (HL, 人读账)  ←→  Machine Ledger (ML, 机备账)
     ↑ ① 回收站 →          ↓ ③ 回灌 ↑
              └── ② 净化（●静默）──┘
```

| 接口 | 脚本 | 方向 | 功能 |
|------|------|:---:|------|
| ① 回收站 | `recycle_crystal.py` | HL→ML | 五步读解 → 规范化铸砖 → 入库 |
| ② 净化钩子 | `purify_crystal.py` | ●静默 | 铸砖前静默审查 + 空白日志 |
| ③ 回灌脚本 | `backfill_crystal.py` | ML→HL | 图谱跨章召回 → 提示注入读解 |

### 已验证数据

| 章 | 砖数 | 静默 | ACTIVE/EXTENSION |
|----|:---:|:---:|:---:|
| 第1章 | 20 | 5 | 6 / 14 |
| 第8章 | 17 | 6 | 4 / 13 |
| **累计** | **37** | **11** | **10 / 27** |

---

## 2. 目录结构

```
twin-ledger/
├── README.md
├── DEPLOY.md                          ← 本文件
├── silent_log.md                      ← 静默日志（不入图谱）
├── scripts/                           ← 三接口脚本
│   ├── recycle_crystal.py             ← 接口① 回收站 (HL→ML)
│   ├── purify_crystal.py              ← 接口② 净化钩子 (●静默)
│   └── backfill_crystal.py            ← 接口③ 回灌 (ML→HL)
├── hl/                                ← 人读账 (Human Ledger)
│   └── chapters/                      ← 五步读解报告
├── ml/                                ← 机备账 (Machine Ledger)
│   ├── graph/                         ← 标准砖图谱
│   │   ├── ch1.json                   ← 第1章（20 砖）
│   │   └── ch8.json                   ← 第8章（17 砖）
│   └── purity/                        ← 净化报告
│       ├── purity_ch1.json
│       └── purity_ch8.json
├── docs/                              ← 架构文档
│   ├── 01_双账本架构总纲.md
│   ├── 02_机备账Schema_v1.1_总纲.md
│   └── 03_若字谓词分判规范_附录A.md
└── reports/                           ← 交付与验证报告
    ├── P1_回收站_交付报告.md
    ├── P2_净化钩子_交付报告.md
    ├── P3_回灌脚本_交付报告.md
    └── 第1章全流程验证报告.md
```

---

## 3. 环境要求

| 依赖 | 版本要求 |
|------|---------|
| Python | ≥ 3.8 |
| 操作系统 | Windows / Linux / macOS |
| 外部依赖 | **无**（仅标准库：`json`, `re`, `argparse`, `pathlib`, `datetime`） |

验证环境：

```bash
python --version
# Python 3.8+
```

---

## 4. 快速开始

### 4.1 准备读解报告

读解报告为 Markdown 格式，需包含 `json` 代码块，格式如下：

```markdown
第三步·智慧晶体

```json
{"subject": "...", "predicate": "...", "object": "...", "note": "..."}
```
```

### 4.2 一键运行全流程

```bash
# 进入 twin-ledger 根目录
cd twin-ledger

# 步骤1：净化钩子（铸砖前静默审查）
python scripts/purify_crystal.py --md "hl/chapters/<读解报告>.md" --chapter <N>

# 步骤2：回收站（规范化铸砖入库）
python scripts/recycle_crystal.py --md "hl/chapters/<读解报告>.md" --chapter <N>

# 步骤3：回灌（跨章提示生成）
python scripts/backfill_crystal.py --chapter <N>
```

---

## 5. 分步详解

### 5.1 接口② 净化钩子（purify_crystal.py）

**用途**：铸砖前执行静默审查——决定"哪些不提取"。

**命令**：

```bash
python purify_crystal.py \
    --md "00-人读/《道德经》第N章 · 标题 · 五步协同读解.md" \
    --chapter N
```

**参数**：

| 参数 | 必填 | 说明 |
|------|:---:|------|
| `--md` | 是 | 五步读解报告路径 |
| `--chapter` | 是 | 章号 |
| `--add` | 否 | 人工补充静默（成对使用：`--add "句子" --add "理由"`） |
| `--log` | 否 | 空白日志路径（默认 `output/machine_ledger/silent_log.md`） |
| `--report-dir` | 否 | 净化报告输出目录（默认 `output/machine_ledger/purity`） |
| `--view` | 否 | 仅查看不写入 |

**输出**：
- `silent_log.md`（追加静默行）
- `purity/purity_ch<N>.json`（净化报告，供回收站联动）

**静默审查三问（小澄真）**：
1. 这一章，哪一句/哪个词，是我决定'不提取'的？
2. 这条边/这颗晶体，是文本直陈，还是我的推演？
3. 若在推演，是否已标注'🟠创见延伸'而非'🔵文本事实'？

**自动提取 3 种格式**：
- `●：xxx` — 明确标记的静默晶体
- `> 一句止语` — 最想强调却决定不写
- `~~损去浮尘~~` — 划掉的过度解读

---

### 5.2 接口① 回收站（recycle_crystal.py）

**用途**：读解报告 → 规范化铸砖 → 入库。

**命令**：

```bash
python recycle_crystal.py \
    --md "00-人读/《道德经》第N章 · 标题 · 五步协同读解.md" \
    --chapter N
```

**参数**：

| 参数 | 必填 | 说明 |
|------|:---:|------|
| `--md` | 是 | 五步读解报告路径 |
| `--chapter` | 是 | 章号 |
| `--db` | 否 | 结构库路径（默认 `verify/daojing_database_v2.json`） |
| `--out` | 否 | 图谱输出目录（默认 `output/machine_ledger/graph`） |
| `--purity-dir` | 否 | 净化报告目录（P2 钩子，默认 `output/machine_ledger/purity`） |

**工作流**：

```
① 提取：json 代码块解析（兼容独立 SPO 列表 + 章节内嵌格式）
② 规范化：谓词映射表（导致→故、主张→曰…）+ 本体-分相双层 + STATUS 自动判定
③ Validator：格式校验（谓词非法/edge_type 非法/若字 subtype 缺失/玄边标 ACTIVE → 拒收）
④ 入库：graph/ch<N>.json
```

**输出**：
- `graph/ch<N>.json`（标准砖图谱，含 `purity` 块 + `silent_count`）

**STATUS 自动判定规则**：

| 判定条件 | STATUS |
|---------|:------:|
| 原文直陈（如 `夫唯不争 →故→ 无尤`） | ACTIVE |
| 版本考辨（帛书/通行本/王弼/河上公/王安石） | EXTENSION |
| 解读性主体（含"解读/原理/修养/管理/批判"） | EXTENSION |
| 命题/应用谓词（`曰`/`以`） | EXTENSION |
| `是谓` + 长解读句（>25 字） | EXTENSION |

---

### 5.3 接口③ 回灌脚本（backfill_crystal.py）

**用途**：读解新章时，从图谱中召回跨章同实体砖，生成提示注入读解。

**命令**：

```bash
python backfill_crystal.py --chapter N
python backfill_crystal.py --chapter N --json    # 纯 JSON 输出
```

**参数**：

| 参数 | 必填 | 说明 |
|------|:---:|------|
| `--chapter` | 是 | 待读解章号 |
| `--graph` | 否 | 图谱目录（默认 `output/machine_ledger/graph`） |
| `--json` | 否 | 纯 JSON 输出 |
| `--include-self` | 否 | 含当前章自身（默认排除） |

**推理策略**：

| 边型 | 权重 | 策略 |
|------|:----:|------|
| 逻辑 / 实 | 1.0 | 正常遍历 |
| 喻 | 0.5 | 不传递因果 |
| 玄 | 0.2 | 降权 + 人文语境提示 |

**输出**：
- Markdown 格式回灌提示 + 强制响应区（三选一：采纳/忽略/质疑 + 理由≥10字）

---

## 6. 谓词规范参考

### 6.1 最小谓词集（41 个）

| 边型 | 谓词 |
|------|------|
| 喻 | `若` `如` `似` |
| 实 | `是` `曰` `是谓` `有` `无` `生` `成` `化` `静` `动` `宁` `安` `居` `处` `与` `言` `正` `事` `心` `利` `善利` `有属性` `始` `母` `同出` `异` `从` `谓` `指` |
| 逻辑 | `故` `则` `因` `以` |
| 玄 | `玄` |

### 6.2 谓词映射表（32 条，人读账语言 → 机备账谓词）

| 人读账 | 机备账 | 人读账 | 机备账 |
|--------|:------:|--------|:------:|
| 导致 / 推出 / 引发 | `故` | 主张 / 认为 | `曰` |
| 构成 / 组成 | `是谓` | 回应的是 / 应用 | `以` |
| 可被普遍化为 | `是谓` | 将本章理解为 | `是谓` |
| 利益 / 作用于 | `利` | 处于 | `处` |
| 接近 | `几` | 如同 / 类似 | `若` |
| 超越 | `不` | 为……之始 | `始` |
| 为……之母 | `母` | 与……同出 | `同出` |
| 通向 | `生` | 与王弼本存在关键差异 | `异` |
| 存在核心断句争议 | `异` | 支持第一种/第二种断句 | `从` |
| 聚焦于 | `谓` | 在帛书印证下更可能指 | `指` |

---

## 7. 输出产物

### 7.1 图谱文件（graph/ch<N>.json）

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
  "silent_crystals": [...],
  "silent_count": 5,
  "purity": {
    "reviewed": true,
    "questions": [...],
    "note": "..."
  }
}
```

### 7.2 静默日志（silent_log.md）

不入图谱、不参与推理、不接受版本冻结的空白日志。

### 7.3 净化报告（purity/purity_ch<N>.json）

供回收站联动读取 `silent_count`。

---

## 8. 验证清单

### 8.1 单章验证

- [ ] 净化钩子正常提取静默晶体（●/止语/损去浮尘）
- [ ] 回收站 100% 通过（0 拒收）
- [ ] 图谱 STATUS 正确分布（ACTIVE 含原文直陈，EXTENSION 含解读推演）
- [ ] `purity` 块记录净化审查状态
- [ ] `silent_count` 与净化报告一致

### 8.2 跨章验证

- [ ] 回灌脚本能召回跨章同实体
- [ ] 提示语言零结论（无"因此/所以/必然/可以推出"）
- [ ] 响应区强制三选一（采纳/忽略/质疑 + 理由≥10字）
- [ ] 推理策略权重正确（逻辑/实 1.0，喻 0.5，玄 0.2）

### 8.3 格式验证

- [ ] 所有谓词在最小谓词集中
- [ ] 所有 edge_type 在 `{喻, 实, 逻辑, 玄}` 中
- [ ] 所有 status 在 `{ACTIVE, EXTENSION, XUAN, SILENT}` 中
- [ ] `若` 字边必填 subtype
- [ ] 玄边不得标 ACTIVE

---

## 9. 常见问题

### Q1: 回收站报"谓词非法"

**原因**：读解报告中的谓词未经过标准化映射。  
**修复**：在 `recycle_crystal.py` 的 `PREDICATE_MAP` 中补充映射，并在 `PREDICATES` 中补充最小谓词。

### Q2: 静默晶体提取为 0

**原因**：读解报告中未使用静默标记格式。  
**修复**：在读解报告中添加 `●：xxx`、`> 一句止语` 或 `~~损去浮尘~~` 标记。

### Q3: 回灌提示为空

**原因**：图谱中尚无其他章的数据。  
**说明**：第一本账入库时回灌为空是正常的，待第二本账入库后即可跨章召回。

### Q4: 图谱目录不存在

**原因**：脚本默认输出到 `output/machine_ledger/graph`，相对路径依赖当前工作目录。  
**修复**：使用 `--out` 参数指定绝对路径，或确保在正确的目录下执行脚本。

---

## 10. 复跑命令速查

```bash
# 完整流程（以第1章为例）
cd twin-ledger

# 步骤1：净化
python scripts/purify_crystal.py \
    --md "hl/chapters/《道德经》第1章 · 道可道 · 五步协同读解.md" \
    --chapter 1

# 步骤2：回收站
python scripts/recycle_crystal.py \
    --md "hl/chapters/《道德经》第1章 · 道可道 · 五步协同读解.md" \
    --chapter 1

# 步骤3：回灌
python scripts/backfill_crystal.py --chapter 1

# 纯 JSON 输出（供程序消费）
python scripts/backfill_crystal.py --chapter 1 --json
```

---

## 11. 架构红线

四条防混账红线（来自总纲）：

1. **人读账 SPO 不经回收站不得入图谱**
2. **机备账结论不经回灌不得入读解**
3. **净化清单永不参与推理**
4. **回灌永远提示不结论**

---

*归档时间: 2026-08-14 | 版本: v1.1 | 状态: 三接口全通，双螺旋第一轮闭合*