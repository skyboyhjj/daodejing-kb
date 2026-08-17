#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
batch_produce.py —— 批量生产脚本：读解 → 管线 → 追踪 → 提交
================================================================
P4 生产炉自动化工具。将"读解生成"与"管线执行"解耦：

  读解生成（AI 对话产出） → hl/chapters/ch{N:02d}.md
  管线执行（本脚本）      → purify → recycle → backfill → 追踪更新 → git

用法：
  # 单章生产
  python scripts/batch_produce.py --chapter 3

  # 单章生产 + 自动提交推送
  python scripts/batch_produce.py --chapter 3 --commit

  # 批量生产（多章）
  python scripts/batch_produce.py --chapters 3,4,5,6,7 --commit

  # 仅验证（不执行管线，只检查读解文件是否存在）
  python scripts/batch_produce.py --chapter 3 --check-only

前置条件：
  - hl/chapters/ch{N:02d}.md 已存在（含完整五步读解）
  - twin_ledger/ 为当前工作目录，或通过 --cwd 指定
"""

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# TL_ROOT 锚定
TL_ROOT = Path(os.path.dirname(os.path.abspath(__file__))).parent

# 章节名映射（用于追踪表备注）
CHAPTER_NAMES = {
    1: "道可道", 2: "天下皆知", 3: "不尚贤", 4: "道冲",
    5: "天地不仁", 6: "谷神不死", 7: "天长地久", 8: "上善若水",
    9: "持而盈之", 10: "载营魄抱一",
}


def run_script(script_name: str, args: list) -> tuple[int, str, str]:
    """运行一个管线脚本，返回 (exit_code, stdout, stderr)"""
    cmd = [sys.executable, str(TL_ROOT / "scripts" / script_name)] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True,
                                cwd=str(TL_ROOT), encoding="utf-8", errors="replace")
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return -1, "", str(e)


def parse_results(stdout: str) -> dict:
    """从脚本输出中提取关键指标"""
    info = {
        "silent": 0, "bricks": 0, "rejected": 0, "backfill": 0,
        "silent_zones": {}, "statuses": {},
    }
    # 静默数量
    m = re.search(r"静默晶体\s*(\d+)\s*枚", stdout)
    if m:
        info["silent"] = int(m.group(1))
    # 静默三区
    for zone in ["A", "B", "C"]:
        mz = re.search(rf"{zone}\s*止语.*?(\d+)", stdout)
        if mz:
            info["silent_zones"][zone] = int(mz.group(1))
    # 铸砖数量
    m = re.search(r"通过:\s*(\d+)\s*条", stdout)
    if m:
        info["bricks"] = int(m.group(1))
    # 拒收数量
    m = re.search(r"拒收:\s*(\d+)\s*条", stdout)
    if m:
        info["rejected"] = int(m.group(1))
    # ACTIVE / EXTENSION
    for status in ["ACTIVE", "EXTENSION", "XUAN", "SILENT"]:
        ms = re.search(rf"{status}:\s*(\d+)", stdout)
        if ms:
            info["statuses"][status] = int(ms.group(1))
    # 回灌提示
    m = re.search(r"回灌提示.*?(\d+)\s*条", stdout, re.DOTALL)
    if m:
        info["backfill"] = int(m.group(1))
    return info


def update_tracking_table(chapter: int, info: dict):
    """更新 PROJECT_CONTEXT.md 中的逐章追踪表"""
    ctx_path = TL_ROOT / "PROJECT_CONTEXT.md"
    content = ctx_path.read_text(encoding="utf-8")

    ch_key = f"ch{chapter:02d}"
    name = CHAPTER_NAMES.get(chapter, "")
    bricks = info.get("bricks", "?")
    rejected = info.get("rejected", "?")
    silent = info.get("silent", "?")
    backfill = info.get("backfill", "?")

    new_cell = f"{name} · {bricks}砖 {rejected}拒收 · {silent}静默 · {backfill}回灌"

    # 替换该行：ch02 | 有 | ⏳ | ⏳ | ⏳ | ⏳ | ... → 全部替换为 ✅
    pattern = rf"(\| {ch_key} \| 有 \|) ⏳ \| ⏳ \| ⏳ \| ⏳ \| [^|]+\|"
    replacement = rf"\1 ✅ | ✅ | ✅ | ✅ | {new_cell} |"

    new_content = re.sub(pattern, replacement, content)
    if new_content != content:
        ctx_path.write_text(new_content, encoding="utf-8")
        return True
    return False


def check_readout(chapter: int) -> bool:
    """检查读解文件是否存在且非空"""
    md_path = TL_ROOT / "hl" / "chapters" / f"ch{chapter:02d}.md"
    if not md_path.exists():
        print(f"  [ERROR] 读解文件不存在: {md_path}")
        return False
    content = md_path.read_text(encoding="utf-8")
    if "待生产炉产出" in content:
        print(f"  [ERROR] 读解文件仍为模板，尚未产出: {md_path}")
        return False
    return True


def git_commit_push(chapter: int, info: dict):
    """提交并推送"""
    bricks = info.get("bricks", "?")
    rejected = info.get("rejected", "?")
    silent = info.get("silent", "?")
    name = CHAPTER_NAMES.get(chapter, "")

    # 确定需要 git add 的文件
    files_to_add = [
        f"twin_ledger/hl/chapters/ch{chapter:02d}.md",
        f"twin_ledger/ml/graph/ch{chapter}.json",
        f"twin_ledger/ml/purity/purity_ch{chapter}.json",
        "twin_ledger/silent_log.md",
        "twin_ledger/PROJECT_CONTEXT.md",
    ]

    # 只 add 实际存在的文件
    git_root = TL_ROOT.parent.parent  # daodejing-kb/
    existing = []
    for f in files_to_add:
        if (git_root / f).exists():
            existing.append(f)

    if not existing:
        print("  [WARN] 没有可提交的文件")
        return False

    # git add
    cmd_add = ["git", "add"] + existing
    subprocess.run(cmd_add, cwd=str(git_root), capture_output=True)

    # git commit
    msg = (f"twin_ledger: batch1 ch{chapter:02d} production"
           f" - {bricks} bricks, {rejected} reject, {silent} silent")
    cmd_commit = ["git", "commit", "-m", msg]
    result = subprocess.run(cmd_commit, cwd=str(git_root), capture_output=True, text=True)

    if result.returncode != 0 and "nothing to commit" not in result.stdout + result.stderr:
        print(f"  [WARN] git commit 失败: {result.stderr.strip()}")
        return False

    # git push
    cmd_push = ["git", "push", "origin", "main"]
    result = subprocess.run(cmd_push, cwd=str(git_root), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [WARN] git push 失败: {result.stderr.strip()}")
        return False

    print(f"  [Git] 提交并推送成功")
    return True


def produce_chapter(chapter: int, do_commit: bool = False, check_only: bool = False):
    """生产单章：读解检查 → 管线 → 追踪 → 提交"""
    name = CHAPTER_NAMES.get(chapter, "")
    md_path = TL_ROOT / "hl" / "chapters" / f"ch{chapter:02d}.md"
    print(f"\n{'='*60}")
    print(f"  第{chapter}章 · {name}  |  ch{chapter:02d}.md")
    print(f"{'='*60}")

    # 0. 读解检查
    if not check_readout(chapter):
        return False
    if check_only:
        print(f"  [OK] 读解文件存在且已产出")
        return True

    # 1. 净化
    print(f"\n  [1/3] 净化钩子 (purify_crystal.py)...")
    rc, out, err = run_script("purify_crystal.py", [
        "--md", str(md_path), "--chapter", str(chapter)
    ])
    if rc != 0:
        print(f"  [ERROR] 净化失败 (exit={rc}): {err[:200]}")
        return False
    info = parse_results(out)
    print(f"  [OK] 静默晶体: {info['silent']} 枚")

    # 2. 回收站
    print(f"\n  [2/3] 回收站 (recycle_crystal.py)...")
    rc, out, err = run_script("recycle_crystal.py", [
        "--md", str(md_path), "--chapter", str(chapter)
    ])
    if rc != 0:
        print(f"  [ERROR] 回收站失败 (exit={rc}): {err[:200]}")
        return False
    info = parse_results(out)
    print(f"  [OK] 通过: {info['bricks']} 条 | 拒收: {info['rejected']} 条")
    if info.get("statuses"):
        print(f"  [STATUS] {info['statuses']}")

    # 3. 回灌
    print(f"\n  [3/3] 回灌 (backfill_crystal.py)...")
    rc, out, err = run_script("backfill_crystal.py", [
        "--chapter", str(chapter)
    ])
    if rc != 0:
        print(f"  [ERROR] 回灌失败 (exit={rc}): {err[:200]}")
        return False
    # 回灌提示数从输出中提取
    hint_count = len(re.findall(r"^\s*\d+\.", out, re.MULTILINE))
    info["backfill"] = hint_count
    print(f"  [OK] 回灌提示: {hint_count} 条")

    # 4. 更新追踪表
    print(f"\n  [追踪] 更新 PROJECT_CONTEXT.md...")
    updated = update_tracking_table(chapter, info)
    print(f"  [{'OK' if updated else 'SKIP'}] 追踪表{'已更新' if updated else '无需更新'}")

    # 5. Git 提交
    if do_commit:
        print(f"\n  [Git] 提交并推送...")
        git_commit_push(chapter, info)

    # 汇总
    print(f"\n  {'─'*40}")
    print(f"  第{chapter}章 · {name} 生产完成")
    print(f"  砖: {info['bricks']} | 拒收: {info['rejected']} | 静默: {info['silent']} | 回灌: {info['backfill']}")
    print(f"  {'─'*40}")
    return True


def main():
    parser = argparse.ArgumentParser(description="P4 批量生产脚本")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--chapter", type=int, help="单章编号 (如 3)")
    group.add_argument("--chapters", type=str, help="多章编号，逗号分隔 (如 3,4,5,6,7)")
    parser.add_argument("--commit", action="store_true", help="自动 git commit + push")
    parser.add_argument("--check-only", action="store_true", help="仅检查读解文件是否存在")
    parser.add_argument("--cwd", type=str, default=None, help="twin_ledger 根目录")
    args = parser.parse_args()

    # 解析章节列表
    if args.chapter:
        chapters = [args.chapter]
    else:
        chapters = [int(c.strip()) for c in args.chapters.split(",")]

    # 逐章生产
    results = {}
    for ch in chapters:
        ok = produce_chapter(ch, do_commit=args.commit, check_only=args.check_only)
        results[ch] = ok

    # 总汇总
    print(f"\n{'='*60}")
    print(f"  批量生产汇总")
    print(f"{'='*60}")
    for ch, ok in results.items():
        name = CHAPTER_NAMES.get(ch, "")
        print(f"  第{ch}章 · {name}: {'✅' if ok else '❌'}")
    all_ok = all(results.values())
    print(f"\n  总计: {sum(1 for v in results.values() if v)}/{len(results)} 章成功")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()