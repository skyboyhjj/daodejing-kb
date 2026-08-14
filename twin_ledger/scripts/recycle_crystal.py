#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
recycle_crystal.py —— P1 回收站：读解报告 → 规范化铸砖 → 入库
================================================================
双账本架构接口①（人读账 → 机备账）的第一个可运行实现。

工作流（对齐双账本架构总纲 §三·接口①）：
  ① 提取：从五步读解报告提取 SPO（第二步/第三步的 JSON 块）
  ② 规范化：实体→本体-分相双层；谓词→最小谓词集；边型→喻/实/逻辑/玄；状态→四态
  ③ Validator：格式校验（缺字段/非法谓词/subtype 缺失 → 拒收）
  ④ 入库：写入 ml/graph/<chapter>.json (ML)

物理隔离：本脚本只读 人读账 Markdown，只写 机备账 JSON——不碰对方账本文件。

用法：
  python recycle_crystal.py --md "../hl/chapters/《道德经》第8章 · 上善若水 · 五步协同读解.md" \
      --chapter 8
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# 脚本自身目录（用于解析默认相对路径）
SCRIPT_DIR = Path(__file__).parent.resolve()

# ============ 机备账 schema v1.1 常量（与 contracts.py 同源，独立防耦合） ============
EDGE_TYPES = ["喻", "实", "逻辑", "玄"]
STATUS_TYPES = ["ACTIVE", "EXTENSION", "XUAN", "SILENT"]
SUBTYPES = ["metaphor", "condition", "reasoning", "interrogative"]

# 最小谓词集（四型之下）
PREDICATES = {
    "喻": {"若", "如", "似"},
    "实": {"是", "曰", "是谓", "有", "无", "生", "成", "化", "静", "动", "宁", "安",
           "居", "处", "与", "言", "正", "事", "心", "利", "善利", "有属性",
           "始", "母", "同出", "异", "从", "谓", "指"},
    "逻辑": {"故", "则", "因", "以"},
    "玄": {"玄"},
}
# 若字 subtype 判定（附录A 三层规则）
RUO_SUBTYPE = {
    "metaphor": {"if": ["像", "如同"]},
    "condition": {"if": ["如果", "假如"]},
    "reasoning": {"if": ["乃", "才"]},
}


# ============ ① 提取：从读解报告提取 SPO JSON 块 ============
def extract_spo_blocks(md_text: str) -> list:
    """提取读解中所有 ```json ... ``` 块并解析，合并为晶体候选列表
    兼容两种格式：
      A. 独立 SPO 列表 / 单条 dict（第8章 DeepSeek 版）
      B. 章节内嵌 {chapter, spo_triples: [...]}（第1-9章批量版）
    """
    blocks = re.findall(r"```json\s*\n(.*?)```", md_text, re.S)
    candidates = []
    for b in blocks:
        try:
            data = json.loads(b.strip())
        except json.JSONDecodeError:
            continue
        # 格式 B：章节内嵌 spo_triples
        if isinstance(data, dict) and "spo_triples" in data:
            candidates.extend(data["spo_triples"])
            continue
        if isinstance(data, list):
            candidates.extend(data)
        elif isinstance(data, dict) and "subject" in data:
            candidates.append(data)
    return candidates


# ============ ② 规范化 ============
# 人读账谓词 → 机备账最小谓词集 映射表（回收站核心：把"话"铸成"砖"）
PREDICATE_MAP = {
    # 因果/逻辑
    "导致": "故", "推出": "故", "引发": "故", "推出结论": "故", "推出结论是": "故",
    "构成": "是谓", "共同构成": "是谓", "组成": "是谓",
    "回应的是": "以", "应用": "以", "可被普遍化为": "是谓",
    # 判断/定义
    "是": "是", "即是": "是", "在本质上，是": "是谓", "将本章理解为": "是谓",
    "主张": "曰", "认为": "曰",
    # 版本/文本
    "记录七善第三项为": "曰", "存在核心版本争议": "是谓",
    # 动作
    "作用于": "利", "利益": "利", "不与之争": "不争", "处于": "处", "接近": "几",
    "如同": "若", "类似": "若",
    # 第1章特有（本体论）
    "超越": "不", "为……之始": "始", "为……之母": "母", "与……同出": "同出", "通向": "生",
    # 版本考辨类（第1章新读解）
    "与王弼本存在关键差异": "异", "存在核心断句争议": "异", "支持第一种断句": "从",
    "支持第二种断句": "从", "聚焦于": "谓", "在帛书'异名同谓'的印证下，更可能指": "指",
    # 生成/存在
    "生": "生", "化": "化", "成为": "成",
}
def to_base_name(name: str) -> str:
    """实体 → 本体节点名（去分相后缀：'水-8-上善'→'水'；但'故无尤'这类实体名保留）"""
    if not name:
        return name
    # 仅当形态为 '名-数字-...' 时视为分相节点
    m = re.match(r"^(.+?)-(\d+)-", name)
    if m:
        return m.group(1)
    return name


def normalize_predicate(pred: str) -> str:
    """谓词 → 最小谓词集（先查映射表，再直接匹配，去修饰）"""
    pred = pred.strip()
    # 1. 映射表优先（人读账语言 → 机备账谓词）
    if pred in PREDICATE_MAP:
        return PREDICATE_MAP[pred]
    # 2. 直接匹配最小谓词集
    for edges in PREDICATES.values():
        if pred in edges:
            return pred
    # 3. '不X' 否定式 → 保留
    if pred.startswith("不") and len(pred) <= 3:
        return pred
    # 4. 尝试从长谓词中提取核心动词（如"在本质上，是"→"是"）
    for core in ["是谓", "是", "曰", "以", "故", "则", "若", "如", "似", "有", "无", "生", "成"]:
        if core in pred:
            return core
    # 无法归入 → 原样返回（由 Validator 裁决）
    return pred


def infer_edge_type(pred: str, status: str = "ACTIVE") -> str:
    """谓词 → 边型（优先查表，玄谓词特判）"""
    if pred == "玄":
        return "玄"
    for etype, preds in PREDICATES.items():
        if pred in preds:
            return etype
    if pred.startswith("不"):
        return "实"  # 否定式属实边
    return "实"  # 兜底（Validator 会复核）


def infer_subtype(pred: str, note: str = "", edge_type: str = "") -> str:
    """若字 subtype 分判（附录A 三层规则）"""
    if pred != "若":
        return None
    if edge_type == "逻辑":
        if note and ("乃" in note or "才" in note):
            return "reasoning"
        return "condition"
    if edge_type == "喻":
        return "metaphor"
    # 兜底：从喻不从逻辑
    return "metaphor"


# 解读性主体标记（非文本直陈，须标 EXTENSION——schema §4.2）
EXTENSION_SUBJECT_MARKERS = ["解读", "原理", "修养", "管理", "批判", "理解", "语境", "传统"]
EXTENSION_PREDICATES = ["曰", "以"]  # 曰=命题陈述，以=应用/目的——均属解读层


def infer_status(spo: dict, subject: str = "", pred: str = "") -> str:
    """状态判定（Validator 三问简化版）：
    文本直陈（原文引出的 SPO）→ ACTIVE
    解读推演/情境应用/版本考辨 → EXTENSION（🟠创见，非文本事实）
    """
    note = spo.get("note", "")
    if "创见" in note or "延伸" in note:
        return "EXTENSION"
    # 版本考辨（帛书/通行本）→ EXTENSION（非文本直陈，是考据推论）
    if subject.startswith(("帛书", "通行本", "王弼", "河上公", "王安石", "苏辙", "本章两大歧解")):
        return "EXTENSION"
    # 解读性主体 → EXTENSION
    if any(mk in subject for mk in EXTENSION_SUBJECT_MARKERS):
        return "EXTENSION"
    # 命题/应用谓词 → EXTENSION
    if pred in EXTENSION_PREDICATES:
        return "EXTENSION"
    # "是谓"接长解读句（>25 字，非原文短句）→ 解读结论，EXTENSION
    obj = spo.get("object", "")
    if pred == "是谓" and isinstance(obj, str) and len(obj) > 25:
        return "EXTENSION"
    return "ACTIVE"


def normalize_spo(raw: dict, chapter: int) -> dict:
    """单条 SPO 规范化 → schema v1.1 标准砖"""
    subject = raw.get("subject", "").strip()
    pred = normalize_predicate(raw.get("predicate", "").strip())
    obj = raw.get("object")
    if isinstance(obj, str):
        obj = obj.strip()
    source = raw.get("source", "") or raw.get("context", "") or f"{chapter}."

    # 实体 → 分相节点（若已是 名-章-相 格式则保留）
    def phase(name):
        if not name:
            return name
        if re.match(r"^.+-\d+", name):
            return name
        return f"{name}-{chapter}"

    subj_phase = phase(subject)
    obj_phase = phase(obj) if obj else None

    edge_type = infer_edge_type(pred)
    if edge_type == "喻" and pred == "若":
        edge_type = "喻"
    status = infer_status(raw, subject, pred)
    note = raw.get("note", "")
    subtype = infer_subtype(pred, note, edge_type)

    brick = {
        "subject": subj_phase,
        "subject_base": to_base_name(subject),
        "predicate": pred,
        "edge_type": edge_type,
        "object": obj_phase,
        "object_base": to_base_name(obj) if obj else None,
        "source": source,
        "status": status,
        "subtype": subtype,
    }
    if note:
        brick["note"] = note
    return brick


# ============ ③ Validator（格式与边界校验，绝不裁决义理） ============
def validate_brick(b: dict) -> list:
    """返回违规列表（空=通过）。只做格式校验，不裁决义理。"""
    errors = []
    if not b.get("subject"):
        errors.append("缺 subject")
    if not b.get("predicate"):
        errors.append("缺 predicate")
    elif b["predicate"] not in set().union(*PREDICATES.values()) and not b["predicate"].startswith("不"):
        errors.append(f"谓词非法（不在最小谓词集）: {b['predicate']}")
    if b.get("edge_type") not in EDGE_TYPES:
        errors.append(f"edge_type 非法: {b.get('edge_type')}")
    if b.get("status") not in STATUS_TYPES:
        errors.append(f"status 非法: {b.get('status')}")
    # 若字 subtype 硬校验（附录A：predicate=若 且 subtype 缺失/非法 → 拒收）
    if b.get("predicate") == "若":
        if not b.get("subtype") or b["subtype"] not in SUBTYPES:
            errors.append(f"'若'字缺 subtype 或非法: {b.get('subtype')}")
    # 玄边不得标 ACTIVE（schema §4.2 规则3）
    if b.get("edge_type") == "玄" and b.get("status") == "ACTIVE":
        errors.append("玄边不得标 ACTIVE（须 XUAN 或 SILENT）")
    return errors


# ============ ④ 入库 ============
def write_graph(chapter: int, bricks: list, silent: list, out_dir: Path, purity_review: dict = None) -> Path:
    graph = {
        "schema": "machine_ledger_v1.1",
        "chapter": chapter,
        "generated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "spo": bricks,
        "silent_crystals": silent,
        "silent_count": len(silent),  # 缝5：仅监控元数据，不入图谱推理
        "purity": {
            "reviewed": bool(purity_review),
            "questions": purity_review.get("questions", []) if purity_review else [],
            "note": "静默审查前置：净化钩子（purify_crystal.py）执行于铸砖前",
        } if purity_review else None,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"ch{chapter}.json"
    path.write_text(json.dumps(graph, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


# ============ 静默晶体提取（复用 purify_crystal 的完整提取逻辑） ============
def extract_silent(md_text: str) -> list:
    """从读解中提取静默晶体（●标记 + 一句止语 + 损去浮尘）——与 purify_crystal.py 同源"""
    silent = []
    # 格式1：●：xxx 理由：xxx
    for m in re.finditer(r"●\s*[：:]\s*(.+?)(?:理由[：:]?\s*(.{0,15}))?", md_text):
        item = m.group(1).strip()
        reason = (m.group(2) or "").strip()
        if item and len(item) > 2:
            silent.append({"●": item, "reason": reason or "（未注明）"})
    # 格式2：> 最想强调却决定不写出的那句话：xxx（一句止语）
    for m in re.finditer(r">\s*(?:最想强调却决定不写出的那句话|一句止语)\s*[：:]\s*(.+?)(?:[。！？]|$)", md_text):
        item = m.group(1).strip()
        if item and len(item) > 4:
            silent.append({"●": item, "reason": "一句止语（最想强调却决定不写）"})
    # 格式3：损去浮尘（~~划掉~~）
    for m in re.finditer(r"~~(.+?)~~", md_text):
        item = m.group(1).strip()
        if item and len(item) > 3:
            silent.append({"●": f"损去浮尘：{item}", "reason": "过度解读，划掉不说"})
    return silent


def main():
    parser = argparse.ArgumentParser(description="P1 回收站：读解→规范化→入库")
    parser.add_argument("--md", required=True, help="五步读解报告路径")
    parser.add_argument("--chapter", type=int, required=True, help="章号")
    parser.add_argument("--db", default="verify/daojing_database_v2.json", help="结构库（取 core_concepts 补实体）")
    parser.add_argument("--out", default=str(SCRIPT_DIR / "../ml/graph"), help="图谱输出目录 (ML)")
    parser.add_argument("--purity-dir", default=str(SCRIPT_DIR / "../ml/purity"), help="净化报告目录 (ML, P2 钩子读取)")
    args = parser.parse_args()

    md_path = Path(args.md)
    if not md_path.exists():
        print(f"错误: 读解文件不存在 {md_path}", file=sys.stderr)
        sys.exit(1)
    md_text = md_path.read_text(encoding="utf-8")

    # ① 提取
    raw_spo = extract_spo_blocks(md_text)
    silent = extract_silent(md_text)

    # P2 净化钩子：读取净化报告（若已执行 purify_crystal.py），联动 silent_count
    purity_review = None
    purity_path = Path(args.purity_dir) / f"purity_ch{args.chapter}.json"
    if purity_path.exists():
        try:
            purity_review = json.loads(purity_path.read_text(encoding="utf-8"))
            silent = silent + purity_review.get("manual_silent", [])
            print(f"[净化钩子] 检测到净化报告：{purity_path.name}（手动静默 +{len(purity_review.get('manual_silent', []))}）")
        except json.JSONDecodeError:
            print(f"[净化钩子] 净化报告解析失败，忽略")

    print("=" * 68)
    print("P1 回收站 | recycle_crystal.py")
    print("=" * 68)
    print(f"[提取] 读解中 SPO JSON 块: {len(raw_spo)} 条候选")
    print(f"[提取] 静默晶体: {len(silent)} 枚")

    # ② 规范化 + ③ 校验
    bricks, rejected = [], []
    for raw in raw_spo:
        brick = normalize_spo(raw, args.chapter)
        errs = validate_brick(brick)
        if errs:
            rejected.append({"brick": brick, "errors": errs})
        else:
            bricks.append(brick)

    print(f"[规范化] 通过: {len(bricks)} 条")
    print(f"[Validator] 拒收: {len(rejected)} 条")
    for r in rejected:
        print(f"    ❌ {r['brick']['subject']} --{r['brick']['predicate']}--> {r['brick']['object']}: {r['errors']}")

    # ④ 入库
    out_path = write_graph(args.chapter, bricks, silent, Path(args.out), purity_review)
    print(f"[入库] {out_path}（{len(bricks)} 条标准砖 + {len(silent)} 枚静默）")
    print("=" * 68)


if __name__ == "__main__":
    main()
