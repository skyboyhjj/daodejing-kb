#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_batch1.py —— 批1 审阅炉检查点 · 机器预检脚本
==========================================================
基于 小澄真 Validator · 批1审阅协议（VAL-B1-2026-001），
对 ch1-ch10 机备账图谱执行 A1-A5 五项边界检查。

检查项：
  A1  ACTIVE 纯度：ACTIVE 砖必须有 direct_evidence + subject 可在 evidence 指认
  A2  谓词合规：predicate ∈ 37 最小谓词集（v1.3）；原子谓词≤2字
  A3  若字 subtype：predicate="若" 必须有 subtype（metaphor/condition/reasoning/interrogative）
  A4  跨章一致性：同实体跨章 edge_type 不冲突
  A5  静默真实性：silent_count 与 silent_crystals 数组长度一致；静默日志有记录

用法：
  python validate_batch1.py                    # 全量检查
  python validate_batch1.py --chapter 7        # 单章检查
  python validate_batch1.py --json             # JSON 格式输出
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# ============ 常量（与 recycle_crystal.py v1.3 同源） ============
PREDICATES = {
    "喻": {"若", "如", "似"},
    "实": {"是", "曰", "是谓", "有", "无", "生", "成", "化", "静", "动", "宁", "安",
           "居", "处", "与", "言", "正", "事", "心", "利", "行", "有属性",
           "始", "母", "同出", "从", "谓", "指", "不"},
    "逻辑": {"故", "则", "因", "以"},
    "玄": {"玄"},
}
ALL_PREDICATES = set().union(*PREDICATES.values())
SUBTYPES = {"metaphor", "condition", "reasoning", "interrogative"}
EDGE_TYPES = {"喻", "实", "逻辑", "玄"}
STATUS_TYPES = {"ACTIVE", "EXTENSION", "XUAN", "SILENT"}
EXTENSION_SUBJECT_MARKERS = ["解读", "原理", "修养", "管理", "批判", "理解", "语境", "传统"]
EXTENSION_PREDICATES = {"曰", "以"}

# ============ 路径 ============
PROJECT_ROOT = Path(__file__).resolve().parent.parent
GRAPH_DIR = PROJECT_ROOT / "ml" / "graph"
PURITY_DIR = PROJECT_ROOT / "ml" / "purity"
SILENT_LOG = PURITY_DIR / "silent_log.md"


# ============ A1 · ACTIVE 纯度检查 ============
def check_a1_active_purity(spo_list: list, chapter: int) -> dict:
    """检查 ACTIVE 砖的纯度：
    - direct_evidence 字段存在且非空
    - subject 可在 source/direct_evidence 中指认
    - source 须为原文短句（非仅章号）
    """
    issues = []
    active_count = 0
    valid_count = 0

    for i, s in enumerate(spo_list):
        if s.get("status") != "ACTIVE":
            continue
        active_count += 1
        brick_issues = []

        # 1. direct_evidence 必须存在
        de = s.get("direct_evidence", "")
        if not de or not de.strip():
            brick_issues.append("缺 direct_evidence")
        else:
            # 2. subject 须在 evidence 中可指认
            subject = s.get("subject", "")
            subject_clean = re.sub(r"-\d+$", "", subject)  # 去分相后缀
            if subject_clean and subject_clean not in de:
                brick_issues.append(f"subject '{subject_clean}' 不在 direct_evidence '{de}' 中")

        # 3. source 须为原文短句
        source = s.get("source", "")
        if re.match(r"^\d+\.?\s*$", source):
            brick_issues.append(f"source 仅为章号 '{source}'，非原文短句")

        if brick_issues:
            issues.append({"index": i, "subject": s.get("subject"), "issues": brick_issues})
        else:
            valid_count += 1

    return {
        "active_count": active_count,
        "valid_count": valid_count,
        "issues": issues,
        "passed": len(issues) == 0,
    }


# ============ A2 · 谓词合规检查 ============
def check_a2_predicate_compliance(spo_list: list) -> dict:
    """检查 predicate 合规性：
    - 必须在 37 最小谓词集中
    - 原子谓词 ≤2 字（不含否定式"不X"≤3字）
    """
    issues = []
    invalid_predicates = set()

    for i, s in enumerate(spo_list):
        pred = s.get("predicate", "")
        if not pred:
            issues.append({"index": i, "subject": s.get("subject"), "issue": "缺 predicate"})
            continue

        # 合法性检查
        if pred not in ALL_PREDICATES:
            # 否定式特例：不X ≤3 字
            if pred.startswith("不") and len(pred) <= 3:
                invalid_predicates.add(pred)
                issues.append({
                    "index": i, "subject": s.get("subject"),
                    "issue": f"否定式谓词 '{pred}' 不在最小谓词集（v1.3 已移除'不X'型，仅保留原子'不'）"
                })
            else:
                invalid_predicates.add(pred)
                issues.append({
                    "index": i, "subject": s.get("subject"),
                    "issue": f"谓词 '{pred}' 不在 v1.3 最小谓词集（37个）"
                })

    return {
        "total": len(spo_list),
        "issues": issues,
        "invalid_predicates": list(invalid_predicates),
        "passed": len(issues) == 0,
    }


# ============ A3 · 若字 subtype 检查 ============
def check_a3_ruo_subtype(spo_list: list) -> dict:
    """检查 predicate="若" 的砖是否都有 subtype"""
    issues = []
    ruo_count = 0
    valid_count = 0

    for i, s in enumerate(spo_list):
        if s.get("predicate") != "若":
            continue
        ruo_count += 1
        subtype = s.get("subtype")
        if not subtype or subtype not in SUBTYPES:
            issues.append({
                "index": i, "subject": s.get("subject"),
                "issue": f"predicate='若' 缺 subtype 或非法: {subtype}",
            })
        else:
            valid_count += 1

    return {
        "ruo_count": ruo_count,
        "valid_count": valid_count,
        "issues": issues,
        "passed": len(issues) == 0,
    }


# ============ A4 · 跨章一致性检查 ============
def check_a4_cross_chapter(all_chapters: dict) -> dict:
    """检查同实体跨章边型一致性：
    - 同 subject_base 在不同章出现时，edge_type 应一致
    - 本体节点（不带分相后缀）跨章五行不应冲突
    """
    entity_map = defaultdict(list)  # subject_base -> [(chapter, edge_type, predicate)]

    for ch, data in all_chapters.items():
        for s in data.get("spo", []):
            # 取本体节点名（去 chapter 后缀）
            subject = s.get("subject", "")
            base = re.sub(r"-\d+$", "", subject)
            if base and len(base) >= 1:
                entity_map[base].append({
                    "chapter": ch,
                    "subject": subject,
                    "edge_type": s.get("edge_type"),
                    "predicate": s.get("predicate"),
                })

    # 检查跨章冲突
    conflicts = []
    for entity, entries in entity_map.items():
        if len(entries) <= 1:
            continue
        edge_types = {e["edge_type"] for e in entries}
        if len(edge_types) > 1:
            # 实体在不同章有不同边型 → 记录
            conflicts.append({
                "entity": entity,
                "chapters": sorted(set(e["chapter"] for e in entries)),
                "edge_types": list(edge_types),
                "details": [(e["chapter"], e["subject"], e["edge_type"], e["predicate"]) for e in entries],
            })

    return {
        "total_entities": len(entity_map),
        "cross_chapter_entities": sum(1 for v in entity_map.values() if len(v) > 1),
        "conflicts": conflicts,
        "passed": len(conflicts) == 0,
    }


# ============ A5 · 静默真实性检查 ============
def check_a5_silent_integrity(spo_list: list, silent_crystals: list, silent_count: int, chapter: int) -> dict:
    """检查静默数据完整性：
    - silent_count 与 silent_crystals 数组长度一致
    - silent_log.md 中有该章记录
    """
    issues = []

    # 1. 计数一致性
    actual_count = len(silent_crystals)
    if silent_count != actual_count:
        issues.append(f"silent_count={silent_count} 与数组长度 {actual_count} 不一致")

    # 2. 静默日志记录检查
    silent_log_ok = False
    if SILENT_LOG.exists():
        log_text = SILENT_LOG.read_text(encoding="utf-8")
        if f"| {chapter} |" in log_text or f"章 {chapter}" in log_text:
            silent_log_ok = True
    if not silent_log_ok:
        issues.append(f"silent_log.md 中未找到第 {chapter} 章记录")

    return {
        "silent_count": silent_count,
        "actual_count": actual_count,
        "issues": issues,
        "passed": len(issues) == 0,
    }


# ============ 附加检查 ============
def check_schema_version(data: dict, chapter: int) -> dict:
    """检查 schema 版本号"""
    schema = data.get("schema", "")
    ok = schema == "machine_ledger_v1.3"
    return {"schema": schema, "chapter": chapter, "passed": ok}


def check_direct_evidence_format(spo_list: list) -> dict:
    """检查 direct_evidence 格式（应为原文短句，非空非章号）"""
    issues = []
    for i, s in enumerate(spo_list):
        de = s.get("direct_evidence", "")
        if de and re.match(r"^\d+\.?\s*$", de.strip()):
            issues.append({
                "index": i, "subject": s.get("subject"),
                "issue": f"direct_evidence 仅为章号 '{de}'",
            })
    return {"issues": issues, "passed": len(issues) == 0}


# ============ 主审阅逻辑 ============
def validate_chapter(chapter: int, data: dict, all_chapters: dict = None) -> dict:
    """对单章执行全部检查"""
    spo_list = data.get("spo", [])
    silent_crystals = data.get("silent_crystals", [])
    silent_count = data.get("silent_count", 0)

    results = {
        "chapter": chapter,
        "spo_count": len(spo_list),
        "active_count": sum(1 for s in spo_list if s.get("status") == "ACTIVE"),
        "extension_count": sum(1 for s in spo_list if s.get("status") == "EXTENSION"),
        "silent_count": silent_count,
    }

    # A1
    results["A1"] = check_a1_active_purity(spo_list, chapter)
    # A2
    results["A2"] = check_a2_predicate_compliance(spo_list)
    # A3
    results["A3"] = check_a3_ruo_subtype(spo_list)
    # A4 (need all chapters)
    if all_chapters:
        results["A4"] = check_a4_cross_chapter(all_chapters)
    # A5
    results["A5"] = check_a5_silent_integrity(spo_list, silent_crystals, silent_count, chapter)
    # Schema
    results["schema_check"] = check_schema_version(data, chapter)
    # direct_evidence format
    results["de_format"] = check_direct_evidence_format(spo_list)

    # 结论判定
    g6a_issues = []
    if not results["A1"]["passed"]:
        g6a_issues.append(f"A1: {len(results['A1']['issues'])} 条 ACTIVE 纯度问题")
    if not results["A2"]["passed"]:
        g6a_issues.append(f"A2: {len(results['A2']['issues'])} 条谓词违规")
    if not results["A3"]["passed"]:
        g6a_issues.append(f"A3: {len(results['A3']['issues'])} 条若字 subtype 缺失")

    results["conclusion"] = "VALID" if not g6a_issues else "INVALID"
    results["g6a_issues"] = g6a_issues

    return results


def format_report(results: dict, all_chapters: dict = None) -> str:
    """生成人类可读的审阅报告"""
    lines = []
    lines.append(f"# 批1 审阅炉检查点 · 审阅报告（v1.3）")
    lines.append(f"")
    lines.append(f"**日期**: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"**审阅对象**: ch1-ch10 机备账图谱（v1.3，37 谓词集）")
    lines.append(f"**执行**: 机器预检（A1-A5）")
    lines.append(f"")

    # 总表
    total_spo = 0
    total_active = 0
    total_silent = 0
    all_valid = True

    lines.append(f"## 一、审阅结果总表")
    lines.append(f"")
    lines.append(f"| 章 | 砖数 | ACTIVE/EXTENSION | 静默 | A1纯度 | A2谓词 | A3若字 | 结论 |")
    lines.append(f"|----|:----:|:----------------:|:----:|:------:|:------:|:------:|:----:|")

    for ch in sorted(results.keys()):
        r = results[ch]
        a1 = "✅" if r["A1"]["passed"] else "❌"
        a2 = "✅" if r["A2"]["passed"] else "❌"
        a3 = "✅" if r["A3"]["passed"] else ("❌" if r["A3"]["ruo_count"] > 0 else "—")
        conc = r["conclusion"]
        total_spo += r["spo_count"]
        total_active += r["active_count"]
        total_silent += r["silent_count"]
        if conc != "VALID":
            all_valid = False

        lines.append(f"| ch{ch} | {r['spo_count']} | {r['active_count']}/{r['extension_count']} | "
                     f"{r['silent_count']} | {a1} | {a2} | {a3} | {conc} |")

    lines.append(f"")
    lines.append(f"**合计**: {total_spo} 砖，{total_active} ACTIVE，{total_silent} 静默")
    lines.append(f"")

    # G6a 汇总
    g6a_total = sum(len(r["g6a_issues"]) for r in results.values())
    lines.append(f"**G6a 污染级问题：{g6a_total} 项**" + (" ✅" if g6a_total == 0 else " ❌"))
    lines.append(f"")

    # 逐项
    lines.append(f"## 二、逐项审阅记录")
    lines.append(f"")

    # A1
    lines.append(f"### A1 · ACTIVE 纯度（G2）")
    a1_bad = [(ch, r) for ch, r in results.items() if not r["A1"]["passed"]]
    if not a1_bad:
        lines.append(f"- 全部通过 ✅")
    else:
        for ch, r in a1_bad:
            for iss in r["A1"]["issues"]:
                lines.append(f"- ch{ch} #{iss['index']} `{iss['subject']}`: {', '.join(iss['issues'])}")
    lines.append(f"")

    # A2
    lines.append(f"### A2 · 谓词合规（G3）")
    a2_bad = [(ch, r) for ch, r in results.items() if not r["A2"]["passed"]]
    if not a2_bad:
        lines.append(f"- 全部通过 ✅（37 谓词集）")
    else:
        for ch, r in a2_bad:
            for iss in r["A2"]["issues"]:
                lines.append(f"- ch{ch} #{iss['index']} `{iss['subject']}`: {iss['issue']}")
    lines.append(f"")

    # A3
    lines.append(f"### A3 · 若字 subtype")
    ruo_total = sum(r["A3"]["ruo_count"] for r in results.values())
    a3_bad = [(ch, r) for ch, r in results.items() if not r["A3"]["passed"]]
    if not a3_bad:
        lines.append(f"- 全部通过 ✅（{ruo_total} 条'若'砖 subtype 齐备）")
    else:
        for ch, r in a3_bad:
            for iss in r["A3"]["issues"]:
                lines.append(f"- ch{ch} #{iss['index']} `{iss['subject']}`: {iss['issue']}")
    lines.append(f"")

    # A4
    if all_chapters:
        a4_result = check_a4_cross_chapter(all_chapters)
        lines.append(f"### A4 · 跨章一致性")
        lines.append(f"- 跨章实体: {a4_result['cross_chapter_entities']} 个")
        if a4_result["conflicts"]:
            for c in a4_result["conflicts"]:
                lines.append(f"- ⚠ 实体 `{c['entity']}` 跨章 {c['chapters']} 边型冲突: {c['edge_types']}")
        else:
            lines.append(f"- 无边型冲突 ✅")
        lines.append(f"")

    # A5
    lines.append(f"### A5 · 静默真实性")
    a5_bad = [(ch, r) for ch, r in results.items() if not r["A5"]["passed"]]
    if not a5_bad:
        lines.append(f"- 全部通过 ✅")
    else:
        for ch, r in a5_bad:
            for iss in r["A5"]["issues"]:
                lines.append(f"- ch{ch}: {iss}")
    lines.append(f"")

    # Schema
    lines.append(f"### Schema 版本")
    schema_bad = [(ch, r) for ch, r in results.items() if not r["schema_check"]["passed"]]
    if not schema_bad:
        lines.append(f"- 全部 `machine_ledger_v1.3` ✅")
    else:
        for ch, r in schema_bad:
            lines.append(f"- ch{ch}: `{r['schema_check']['schema']}` ❌")
    lines.append(f"")

    # 结论
    lines.append(f"## 三、审阅结论")
    lines.append(f"")
    if all_valid:
        lines.append(f"> **批1 审阅炉检查点通过：ch1-ch10 共 {total_spo} 砖，10/10 章 VALID，G6a 污染级 0 项。**")
    else:
        invalid_chs = [ch for ch, r in results.items() if r["conclusion"] != "VALID"]
        lines.append(f"> **批1 审阅炉检查点：{len(invalid_chs)} 章 INVALID（{invalid_chs}），G6a 污染级 {g6a_total} 项。**")

    lines.append(f"")
    lines.append(f"---")
    lines.append(f"*审阅执行: 机器预检 validate_batch1.py (v1.3) | 义理抽检待审阅炉对话*")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="批1 审阅炉检查点 · 机器预检")
    parser.add_argument("--chapter", type=int, help="单章检查（1-10）")
    parser.add_argument("--json", action="store_true", help="JSON 格式输出")
    parser.add_argument("--graph-dir", default=str(GRAPH_DIR), help="图谱目录")
    args = parser.parse_args()

    graph_dir = Path(args.graph_dir)

    # 加载所有章节
    chapters = list(range(1, 11)) if not args.chapter else [args.chapter]
    all_data = {}
    missing = []

    for ch in chapters:
        path = graph_dir / f"ch{ch}.json"
        if not path.exists():
            missing.append(ch)
            continue
        with open(path, encoding="utf-8") as f:
            all_data[ch] = json.load(f)

    if missing:
        print(f"[错误] 缺失章节: {missing}", file=sys.stderr)
        sys.exit(1)

    # 执行检查
    results = {}
    for ch, data in all_data.items():
        results[ch] = validate_chapter(ch, data, all_data)

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        report = format_report(results, all_data)
        print(report)

    # 退出码
    all_valid = all(r["conclusion"] == "VALID" for r in results.values())
    sys.exit(0 if all_valid else 1)


if __name__ == "__main__":
    main()