#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
purify_crystal.py —— P2 净化钩子：静默审查前置 + silent_log 空白日志
================================================================
双账本架构接口②（●静默）的落地实现。

功能：
  1. 静默审查前置：铸砖前，先问"这一章哪句/哪个词决定不提取？"
  2. silent_log 空白日志：记录每章静默晶体（不入图谱、不参与推理）
  3. silent_count 元数据：仅监控，不算机备账机制（缝5）

铁律（三扇窗）：
  - 净化只提醒，不裁决（Validator 权限守界）
  - 真正的静默不入库（silent_log 是空白日志，非图谱文件）
  - 道永远半冻结（回灌只提示不结论）

用法：
  python purify_crystal.py --md "<读解报告.md>" --chapter 8
  python purify_crystal.py --md "<读解报告.md>" --chapter 8 --view   # 仅查看不写入
"""

import argparse
import os
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# ============ 静默审查三问（小澄真·Validator 前置） ============
PURITY_QUESTIONS = [
    "这一章，哪一句/哪个词，是我决定'不提取'的？",
    "这条边/这颗晶体，是文本直陈，还是我的推演？",
    "若在推演，我是否已准备标注为'🟠创见延伸'而非'🔵文本事实'？",
]


# ============ 静默晶体提取（自动，从读解文本） ============
def extract_silent_auto(md_text: str) -> list:
    """从读解中自动提取静默晶体（●标记 + 一句止语 + 损去浮尘）"""
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
    # 格式3：损去浮尘（~~划掉~~的内容）
    for m in re.finditer(r"~~(.+?)~~", md_text):
        item = m.group(1).strip()
        if item and len(item) > 3:
            silent.append({"●": f"损去浮尘：{item}", "reason": "过度解读，划掉不说"})
    return silent


# ============ 静默审查（人工/交互式三问） ============
def run_purity_review(chapter: int, md_text: str, silent_auto: list) -> dict:
    """执行静默审查：自动提取 + 三问确认。返回审查记录"""
    review = {
        "chapter": chapter,
        "reviewed_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "questions": PURITY_QUESTIONS,
        "auto_silent": silent_auto,
        "manual_silent": [],  # 人工补充的静默（--add 参数）
        "reviewed": False,
        "note": "",
    }
    return review


# ============ silent_log 空白日志（不入图谱，仅记录） ============
# 三类静默分开记录（DeepSeek 反馈：止语/损去浮尘 ≠ 静默晶体）
SILENT_LOG_HEADER = """# ● 静默日志（silent_log）

> 此日志记录每一章"决定不提取"的静默晶体。
> **它不属于机备账图谱，不参与任何推理，不接受任何版本冻结。**
> 窗在纸外，此页留白。
>
> **三类分列（不混同）**：
> - **A 止语边界**：写作者"不说"的话（自我约束）
> - **B 损去浮尘**：被划掉的过度解读（去断见）
> - **C 静默晶体**：不提取的原文"妙"（不入库的专指）

---
"""


def classify_silent(item: dict) -> str:
    """静默类型分类：A 止语边界 / B 损去浮尘 / C 静默晶体"""
    text = item.get("●", "")
    reason = item.get("reason", "")
    if "止语" in reason or "最想强调" in text:
        return "A"
    if "损去" in text or "划掉" in reason or "过度解读" in reason:
        return "B"
    return "C"  # 静默晶体（不提取的原文妙词）


def append_silent_log(log_path: Path, review: dict) -> Path:
    """将审查记录追加到 silent_log.md（空白日志，非图谱），三类分列"""
    if not log_path.exists():
        log_path.write_text(SILENT_LOG_HEADER, encoding="utf-8")

    sections = {"A": [], "B": [], "C": []}
    for s in review.get("auto_silent", []) + review.get("manual_silent", []):
        cls = classify_silent(s)
        item = s.get("●", "").replace("|", "\\|").strip()
        reason = s.get("reason", "").replace("|", "\\|").strip()
        sections[cls].append(f"| {review['chapter']} | {item} | {reason} |")

    if any(sections.values()):
        with log_path.open("a", encoding="utf-8") as f:
            for cls, label in [("A", "A · 止语边界"), ("B", "B · 损去浮尘"), ("C", "C · 静默晶体")]:
                if sections[cls]:
                    f.write(f"\n### {label}\n")
                    f.write("| 章 | 静默内容 | 理由 |\n|---|---|---|\n")
                    f.write("\n".join(sections[cls]) + "\n")
    return log_path


def write_purity_report(review: dict, out_dir: Path) -> Path:
    """将审查记录写入章节净化报告（供回收站读取 silent_count）"""
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"purity_ch{review['chapter']}.json"
    path.write_text(json.dumps(review, ensure_ascii=False, indent=1), encoding="utf-8")
    return path



TL_ROOT = Path(os.path.dirname(os.path.abspath(__file__))).parent  # twin_ledger/ 根（scripts/ 在根下）  # twin_ledger/ 根


def _resolve(p):
    """相对路径锚定到 twin_ledger/ 根（CWD 无关）"""
    if Path(p).is_absolute():
        return p
    return str(TL_ROOT / p)

def main():
    parser = argparse.ArgumentParser(description="P2 净化钩子：静默审查 + 空白日志")
    parser.add_argument("--md", required=True, help="五步读解报告路径")
    parser.add_argument("--chapter", type=int, required=True, help="章号")
    parser.add_argument("--add", action="append", default=[], help="人工补充静默（可多次）：--add '句子' --add '理由' 成对使用")
    parser.add_argument("--log", default="silent_log.md", help="空白日志路径")
    parser.add_argument("--report-dir", default="ml/purity", help="净化报告输出目录")
    parser.add_argument("--view", action="store_true", help="仅查看，不写入日志")
    args = parser.parse_args()

    md_path = Path(_resolve(args.md))
    if not md_path.exists():
        print(f"错误: 读解文件不存在 {md_path}", file=sys.stderr)
        sys.exit(1)
    md_text = md_path.read_text(encoding="utf-8")

    # 静默审查前置（小澄真三问）
    print("=" * 68)
    print("P2 净化钩子 | purify_crystal.py")
    print("=" * 68)
    print("\n[静默审查三问]")
    for i, q in enumerate(PURITY_QUESTIONS, 1):
        print(f"  {i}. {q}")

    # 自动提取
    silent_auto = extract_silent_auto(md_text)
    print(f"\n[自动提取] 静默晶体 {len(silent_auto)} 枚")
    for s in silent_auto:
        print(f"  ● {s['●'][:50]}  |  {s['reason']}")

    # 人工补充（成对 --add）
    manual = []
    adds = args.add
    for i in range(0, len(adds) - 1, 2):
        manual.append({"●": adds[i], "reason": adds[i + 1]})
    if manual:
        print(f"[人工补充] {len(manual)} 枚")
        for s in manual:
            print(f"  ● {s['●'][:50]}  |  {s['reason']}")

    review = run_purity_review(args.chapter, md_text, silent_auto)
    review["manual_silent"] = manual
    review["reviewed"] = True
    review["note"] = "静默审查已执行：自动提取 + 人工补充。真正的静默不入库，此日志仅记录'不提取'的痕迹。"

    if args.view:
        print(f"\n[查看模式] 不写入。共 {len(silent_auto) + len(manual)} 枚静默晶体。")
        return

    # 写入空白日志 + 净化报告
    log_path = append_silent_log(Path(_resolve(args.log)), review)
    report_path = write_purity_report(review, Path(_resolve(args.report_dir)))
    print(f"\n[空白日志] {log_path}（追加 {len(silent_auto) + len(manual)} 行）")
    print(f"[净化报告] {report_path}")
    print(f"[silent_count] {len(silent_auto) + len(manual)}（仅监控元数据，不入图谱推理）")
    print("=" * 68)


if __name__ == "__main__":
    main()
