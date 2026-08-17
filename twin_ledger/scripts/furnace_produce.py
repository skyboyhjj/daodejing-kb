#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
furnace_produce.py —— 生产炉：调用 DeepSeek API 直接生成五步读解
==================================================================
绕过 TRAE 对话界面的 983 内容限制，通过 DeepSeek API 直接生成读解。

工作流：
  ① 读取 hl/chapters/ch{N:02d}.md（原文模板）
  ② 加载 烧火童子01 系统提示词
  ③ 调用 DeepSeek API（chat/completions）
  ④ 将返回的完整读解写入 hl/chapters/ch{N:02d}.md（替换模板）
  ⑤ 可选：自动链入 batch_produce.py 管线

用法：
  # 单章生产
  python scripts/furnace_produce.py --chapter 4

  # 单章生产 + 自动管线
  python scripts/furnace_produce.py --chapter 4 --pipeline

  # 生产 + 管线 + 提交
  python scripts/furnace_produce.py --chapter 4 --pipeline --commit

  # 批量生产（多章）
  python scripts/furnace_produce.py --chapters 4,5,6,7 --pipeline --commit

前置条件：
  - DEEPSEEK_API_KEY 已配置（环境变量或 daodejing-kb/.env）
  - 烧火童子01 提示词文件存在
  - hl/chapters/ch{N:02d}.md 模板已就绪（含原文）
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ===== 路径配置 =====
TL_ROOT = Path(os.path.dirname(os.path.abspath(__file__))).parent
PROJECT_ROOT = TL_ROOT.parent  # daodejing-kb/
PROMPT_FILE = Path(os.environ.get(
    "FURNACE_PROMPT",
    str(TL_ROOT / "prompts" / "烧火童子01_读解生成20260815.md")
))

# ===== DeepSeek API 配置 =====
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-v4-pro"  # 需要强推理能力
MAX_TOKENS = 16384
TEMPERATURE = 0.8
TOP_P = 0.9

# 章节名映射
CHAPTER_NAMES = {
    1: "道可道", 2: "天下皆知", 3: "不尚贤", 4: "道冲",
    5: "天地不仁", 6: "谷神不死", 7: "天长地久", 8: "上善若水",
    9: "持而盈之", 10: "载营魄抱一",
}


def load_api_key():
    """加载 DeepSeek API Key（优先环境变量，其次 .env 文件）"""
    key = os.environ.get("DEEPSEEK_API_KEY", "")
    if key and key != "sk-your-deepseek-api-key-here":
        return key

    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DEEPSEEK_API_KEY="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val and val != "sk-your-deepseek-api-key-here":
                        return val
    return ""


def load_prompt():
    """加载烧火童子01 系统提示词"""
    if not PROMPT_FILE.exists():
        print(f"  [ERROR] 提示词文件不存在: {PROMPT_FILE}")
        print(f"  请确认路径或设置环境变量 FURNACE_PROMPT")
        return ""
    return PROMPT_FILE.read_text(encoding="utf-8")


def load_template(chapter: int) -> str:
    """加载章节模板（含原文）"""
    md_path = TL_ROOT / "hl" / "chapters" / f"ch{chapter:02d}.md"
    if not md_path.exists():
        print(f"  [ERROR] 模板文件不存在: {md_path}")
        return ""
    content = md_path.read_text(encoding="utf-8")
    if "待生产炉产出" not in content:
        print(f"  [WARN] 模板已无'待生产炉产出'标记，可能已产出。继续执行将覆盖现有内容。")
    return content


def call_deepseek(system_prompt: str, user_message: str, api_key: str,
                  chapter: int) -> str | None:
    """调用 DeepSeek API 生成读解"""
    name = CHAPTER_NAMES.get(chapter, "")

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
        "top_p": TOP_P,
        "stream": False,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(DEEPSEEK_API_URL, data=data)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")

    print(f"  [API] 调用 DeepSeek API ({DEEPSEEK_MODEL})...")
    print(f"  [API] temperature={TEMPERATURE}, top_p={TOP_P}, max_tokens={MAX_TOKENS}")
    print(f"  [API] System prompt: {len(system_prompt)} chars")
    print(f"  [API] User message: {len(user_message)} chars")
    print(f"  [API] 等待响应（可能需要 60-120 秒）...")

    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            elapsed = time.time() - start
            result = json.loads(resp.read().decode("utf-8"))

            # 检查 API 错误
            if "error" in result:
                print(f"  [ERROR] API 返回错误: {result['error']}")
                return None

            # 提取内容
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"  [OK] 响应完成 ({elapsed:.0f}s)")
            print(f"  [API] tokens: prompt={usage.get('prompt_tokens', '?')}, "
                  f"completion={usage.get('completion_tokens', '?')}, "
                  f"total={usage.get('total_tokens', '?')}")
            print(f"  [API] 输出长度: {len(content)} chars")
            return content

    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        body = e.read().decode("utf-8", errors="replace")
        print(f"  [ERROR] HTTP {e.code} ({elapsed:.0f}s): {body[:500]}")
        return None
    except urllib.error.URLError as e:
        elapsed = time.time() - start
        print(f"  [ERROR] 网络错误 ({elapsed:.0f}s): {e.reason}")
        return None
    except json.JSONDecodeError as e:
        elapsed = time.time() - start
        print(f"  [ERROR] JSON 解析失败 ({elapsed:.0f}s): {e}")
        return None
    except Exception as e:
        elapsed = time.time() - start
        print(f"  [ERROR] 未知错误 ({elapsed:.0f}s): {e}")
        return None


def validate_output(content: str, chapter: int) -> bool:
    """验证输出是否包含必要的结构"""
    name = CHAPTER_NAMES.get(chapter, "")
    checks = []

    # 检查关键结构标记
    checks.append(("第零步", "第零步：静默观心" in content or "第零步" in content))
    checks.append(("第一步", "第一步：目标确立" in content or "第一步" in content))
    checks.append(("第五步", "第五步：强力执行" in content or "第五步" in content))
    checks.append(("静默晶体", "静默晶体" in content))
    checks.append(("结语", "结语" in content or "方舟已成" in content))
    checks.append(("SPO JSON", "```json" in content))
    checks.append(("章标题", f"第{chapter}章" in content or name in content))

    all_ok = True
    for label, ok in checks:
        status = "OK" if ok else "MISSING"
        if not ok:
            all_ok = False
            print(f"  [VALIDATE] {label}: {status}")

    if all_ok:
        print(f"  [VALIDATE] 全部 7 项检查通过")
    return all_ok


def save_output(content: str, chapter: int):
    """将读解写入 hl/chapters/ch{N:02d}.md"""
    md_path = TL_ROOT / "hl" / "chapters" / f"ch{chapter:02d}.md"
    md_path.write_text(content, encoding="utf-8")
    print(f"  [SAVE] 已写入: {md_path}")


def run_pipeline(chapter: int, do_commit: bool = False):
    """链入 batch_produce.py 管线"""
    import subprocess

    batch_script = str(TL_ROOT / "scripts" / "batch_produce.py")
    cmd = [sys.executable, batch_script, "--chapter", str(chapter)]
    if do_commit:
        cmd.append("--commit")

    print(f"\n  [PIPELINE] 启动 batch_produce.py...")
    result = subprocess.run(cmd, cwd=str(TL_ROOT))
    return result.returncode == 0


def produce_chapter(chapter: int, api_key: str, do_pipeline: bool = False,
                    do_commit: bool = False):
    """生产单章：读解生成 → 保存 → 可选管线"""
    name = CHAPTER_NAMES.get(chapter, "")
    print(f"\n{'='*60}")
    print(f"  生产炉 · 第{chapter}章 · {name}  |  ch{chapter:02d}.md")
    print(f"{'='*60}")

    # 1. 加载模板
    print(f"\n  [1/4] 加载模板...")
    template = load_template(chapter)
    if not template:
        return False
    print(f"  [OK] 模板长度: {len(template)} chars")

    # 2. 加载提示词
    print(f"\n  [2/4] 加载提示词...")
    system_prompt = load_prompt()
    if not system_prompt:
        return False
    print(f"  [OK] 提示词长度: {len(system_prompt)} chars")

    # 3. 调用 API
    print(f"\n  [3/4] 调用 DeepSeek API...")
    content = call_deepseek(system_prompt, template, api_key, chapter)
    if not content:
        return False

    # 4. 验证并保存
    print(f"\n  [4/4] 验证并保存...")
    if not validate_output(content, chapter):
        print(f"  [WARN] 输出验证未完全通过，但仍保存以便人工检查")
    save_output(content, chapter)

    # 5. 可选管线
    if do_pipeline:
        print(f"\n  [PIPELINE] 链入 batch_produce.py...")
        ok = run_pipeline(chapter, do_commit)
        if not ok:
            print(f"  [WARN] 管线执行返回非零状态")
    else:
        print(f"\n  [INFO] 跳过管线（使用 --pipeline 启用）")

    print(f"\n  {'─'*40}")
    print(f"  第{chapter}章 · {name} 生产完成")
    print(f"  {'─'*40}")
    return True


def main():
    parser = argparse.ArgumentParser(description="生产炉：DeepSeek API 读解生成")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--chapter", type=int, help="单章编号")
    group.add_argument("--chapters", type=str, help="多章编号，逗号分隔")
    parser.add_argument("--pipeline", action="store_true",
                        help="生成后自动链入 batch_produce.py 管线")
    parser.add_argument("--commit", action="store_true",
                        help="管线完成后自动 git commit + push")
    parser.add_argument("--dry-run", action="store_true",
                        help="仅检查 API Key 和文件，不实际调用")
    args = parser.parse_args()

    # 检查 API Key
    api_key = load_api_key()
    if not api_key:
        print("=" * 60)
        print("  [ERROR] 未找到有效的 DEEPSEEK_API_KEY")
        print("")
        print("  请配置以下任一方式：")
        print(f"  1. 编辑 {PROJECT_ROOT / '.env'}，替换占位 Key")
        print("  2. 设置环境变量: set DEEPSEEK_API_KEY=sk-...")
        print("=" * 60)
        sys.exit(1)

    masked = api_key[:6] + "..." + api_key[-4:]
    print(f"  [AUTH] DEEPSEEK_API_KEY: {masked}")

    # 检查提示词
    if not PROMPT_FILE.exists():
        print(f"  [ERROR] 提示词文件不存在: {PROMPT_FILE}")
        sys.exit(1)
    print(f"  [PROMPT] {PROMPT_FILE}")

    if args.dry_run:
        print("\n  [DRY-RUN] 检查通过，可以执行")
        sys.exit(0)

    # 解析章节
    if args.chapter:
        chapters = [args.chapter]
    else:
        chapters = [int(c.strip()) for c in args.chapters.split(",")]

    # 逐章生产
    results = {}
    for ch in chapters:
        ok = produce_chapter(ch, api_key, args.pipeline, args.commit)
        results[ch] = ok

    # 汇总
    print(f"\n{'='*60}")
    print(f"  生产炉汇总")
    print(f"{'='*60}")
    for ch, ok in results.items():
        name = CHAPTER_NAMES.get(ch, "")
        print(f"  第{ch}章 · {name}: {'✅' if ok else '❌'}")
    all_ok = all(results.values())
    print(f"\n  总计: {sum(1 for v in results.values() if v)}/{len(results)} 章成功")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()