#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backfill_crystal.py —— P3 回灌：机备账图谱 → 人读账读解提示
================================================================
双账本架构接口③（机备账 → 人读账）的落地实现。

功能：
  1. 跨章召回：读解第N章时，查询图谱中同实体的其他章（本体-分相双层）
  2. 提示生成（非结论）：按 schema v1.1 推理策略遍历，产出提示
  3. 回灌响应区：生成读解模板第二步的"回灌响应区"（采纳/忽略/质疑+理由）

铁律（窗三）：
  - 回灌只作提示，不作结论
  - 逻辑边正常遍历 / 喻边不传递因果 / 玄边降权提示人文语境 / EXTENSION边降权标注创见
  - 回灌只召回与提示，不自动推导新结论

用法：
  python backfill_crystal.py --chapter 8 --graph ../machine-ledger/graph
  python backfill_crystal.py --chapter 8 --graph ... --json   # JSON 输出
"""

import argparse
import os
import json
import sys
from datetime import datetime
from pathlib import Path

# ============ schema v1.1 推理策略 ============
EDGE_POLICY = {
    "逻辑": {"weight": 1.0, "note": "正常遍历，承载因果"},
    "实": {"weight": 1.0, "note": "正常遍历"},
    "喻": {"weight": 0.5, "note": "不传递因果，仅标记相位相似"},
    "玄": {"weight": 0.2, "note": "降权，需人文语境，不可机械推断"},
}
EXTENSION_LABEL = "🟠创见"
ACTIVE_LABEL = "🔵文本"


def load_graphs(graph_dir: Path) -> dict:
    """加载图谱目录下所有 ch<N>.json"""
    graphs = {}
    if not graph_dir.exists():
        return graphs
    for f in sorted(graph_dir.glob("ch*.json")):
        try:
            g = json.loads(f.read_text(encoding="utf-8"))
            graphs[g["chapter"]] = g
        except (json.JSONDecodeError, KeyError):
            continue
    return graphs


def collect_entities(graphs: dict) -> dict:
    """收集全部实体 → {entity_base: [(chapter, brick), ...]}"""
    entities = {}
    for ch, g in graphs.items():
        for b in g.get("spo", []):
            for name in (b.get("subject_base"), b.get("object_base")):
                if not name:
                    continue
                entities.setdefault(name, []).append((ch, b))
    return entities


def recall_cross_chapter(entities: dict, chapter: int, exclude_self: bool = True) -> dict:
    """跨章召回：当前章实体在其他章的砖"""
    result = {}
    for entity, refs in entities.items():
        others = [(ch, b) for ch, b in refs if (not exclude_self or ch != chapter)]
        if others:
            result[entity] = others
    return result


def build_prompts(recalled: dict, chapter: int) -> list:
    """生成回灌提示（只提示，不结论）——按推理策略排序与标注"""
    prompts = []
    for entity, refs in sorted(recalled.items(), key=lambda x: -len(x[1])):
        for ch, b in refs[:5]:  # 每实体最多 5 条
            edge = b.get("edge_type", "实")
            policy = EDGE_POLICY.get(edge, EDGE_POLICY["实"])
            status_label = EXTENSION_LABEL if b.get("status") == "EXTENSION" else ACTIVE_LABEL
            prompt = {
                "entity": entity,
                "ref_chapter": ch,
                "predicate": b.get("predicate"),
                "edge_type": edge,
                "weight": policy["weight"],
                "status_label": status_label,
                "source": b.get("source", ""),
                "hint": f"第{ch}章有「{entity}」相关的{b['predicate']}关系（{status_label}，{edge}边），可参考其对「{entity}」的相位",
            }
            prompts.append(prompt)
    # 按权重排序（逻辑/实优先，玄/喻降权）
    prompts.sort(key=lambda p: -p["weight"])
    return prompts


def render_response_zone(chapter: int, prompts: list) -> str:
    """生成读解模板第二步的'回灌响应区'（强制响应机制）"""
    lines = [
        f"### 回灌响应区（第{chapter}章读解·第二步·收集实际）",
        "",
        "> 机备账图谱回灌提示（只作提示，不作结论）。请逐条响应：",
        "",
    ]
    if not prompts:
        lines.append("（本图谱暂无跨章同实体召回——回灌提示：无。）")
        lines.append("响应：采纳（无提示可采纳）/ 忽略 / 质疑？理由：____")
        return "\n".join(lines)

    for i, p in enumerate(prompts, 1):
        lines.append(f"{i}. {p['hint']}")
        lines.append(f"   （来源：{p['source']}，权重 {p['weight']}）")
    lines.append("")
    lines.append("**回灌响应（必填，≥10 字）**：")
    lines.append("> 回灌提示已阅：采纳 / 忽略 / 质疑（选一）")
    lines.append("> 理由：____")
    return "\n".join(lines)



TL_ROOT = Path(os.path.dirname(os.path.abspath(__file__))).parent  # twin_ledger/ 根（scripts/ 在根下）  # twin_ledger/ 根


def _resolve(p):
    """相对路径锚定到 twin_ledger/ 根（CWD 无关）"""
    if Path(p).is_absolute():
        return p
    return str(TL_ROOT / p)

def main():
    parser = argparse.ArgumentParser(description="P3 回灌：图谱→读解提示")
    parser.add_argument("--chapter", type=int, required=True, help="待读解章号")
    parser.add_argument("--graph", default="ml/graph", help="图谱目录")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--include-self", action="store_true", help="含当前章自身（默认排除）")
    args = parser.parse_args()

    graphs = load_graphs(Path(_resolve(args.graph)))
    if not graphs:
        print(f"错误: 图谱目录无数据 {args.graph}", file=sys.stderr)
        sys.exit(1)

    entities = collect_entities(graphs)
    recalled = recall_cross_chapter(entities, args.chapter, exclude_self=not args.include_self)
    prompts = build_prompts(recalled, args.chapter)

    if args.json:
        out = {"chapter": args.chapter, "prompts": prompts,
               "policy": EDGE_POLICY, "generated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")}
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return

    print("=" * 68)
    print(f"P3 回灌 | backfill_crystal.py | 第{args.chapter}章读解")
    print("=" * 68)
    print(f"[图谱] {len(graphs)} 章已入库")
    print(f"[召回] {len(recalled)} 个实体跨章命中")

    # Markdown 提示 + 响应区
    print(f"\n[回灌提示] {len(prompts)} 条（按权重排序，逻辑/实优先，玄/喻降权）")
    for i, p in enumerate(prompts, 1):
        label = p["status_label"]
        print(f"  {i}. [{p['edge_type']}/{p['weight']}] {p['hint'][:60]}…")
    print()
    print(render_response_zone(args.chapter, prompts))
    print("=" * 68)


if __name__ == "__main__":
    main()
