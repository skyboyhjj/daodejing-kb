#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
furnace_review.py —— 审阅炉：机器预检 + LLM 义理抽检
========================================================
双账本架构中审阅炉的自动化实现。分两阶段：
  阶段一：机器预检（validate_batch1.py 的 A1-A5 检查）
  阶段二：LLM 义理抽检（A4 跨章一致性裁定 + A5 静默真实性复核）

支持多模型对比：
  python furnace_review.py --model glm-5.3
  python furnace_review.py --model kimi-k3
  python furnace_review.py --model glm-5.3 --model kimi-k3  # 双模型对比

模型配置（OpenAI 兼容 API）：
  glm-5.2:  base_url=https://ark.cn-beijing.volces.com/api/v3, model=glm-5-2-260617
  kimi-k3:  base_url=https://api.moonshot.cn/v1, model=moonshot-v1-8k

环境变量：
  ARK_API_KEY    — 火山方舟 API Key
  KIMI_API_KEY   — 月之暗面 API Key

用法：
  python furnace_review.py                          # 默认模型（DeepSeek）
  python furnace_review.py --model glm-5.2           # 仅 GLM-5.2
  python furnace_review.py --model glm-5.2,kimi-k3   # 双模型对比
  python furnace_review.py --json                    # JSON 输出
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ============ 路径 ============
PROJECT_ROOT = Path(__file__).resolve().parent.parent
GRAPH_DIR = PROJECT_ROOT / "ml" / "graph"
PURITY_DIR = PROJECT_ROOT / "ml" / "purity"
SILENT_LOG = PURITY_DIR / "silent_log.md"
REVIEW_DIR = PROJECT_ROOT / "ml" / "review"
ENV_FILE = PROJECT_ROOT.parent / ".env"

# ============ 模型配置 ============
MODEL_CONFIGS = {
    "deepseek": {
        "name": "DeepSeek-V4",
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "env_key": "DEEPSEEK_API_KEY",
    },
    "glm-5.2": {
        "name": "GLM-5.2 (火山方舟)",
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "model": "glm-5-2-260617",
        "env_key": "ARK_API_KEY",
    },
    "kimi-k3": {
        "name": "kimi-k3",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "kimi-k3",
        "env_key": "KIMI_API_KEY",
        "temperature": 1.0,
        "top_p": None,
        "max_tokens": 16000,
        "reasoning_effort": "low",
    },
}

# 审阅炉参数（低温度，高确定性）
REVIEW_TEMPERATURE = 0.2
REVIEW_TOP_P = 0.8
REVIEW_MAX_TOKENS = 4096


# ============ 工具函数 ============
def load_api_key(env_key: str) -> str:
    """加载 API Key，优先环境变量，其次 .env 文件"""
    key = os.environ.get(env_key, "")
    if key:
        return key
    if ENV_FILE.exists():
        with open(ENV_FILE, encoding="utf-8") as f:
            for line in f:
                if line.startswith(f"{env_key}="):
                    val = line.strip().split("=", 1)[1].strip()
                    if val and not val.endswith("here"):
                        return val
    return ""


def load_graphs(chapters: list) -> dict:
    """加载所有章的图谱数据"""
    data = {}
    for ch in chapters:
        path = GRAPH_DIR / f"ch{ch}.json"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data[ch] = json.load(f)
    return data


def load_silent_log() -> str:
    """加载静默日志"""
    if SILENT_LOG.exists():
        return SILENT_LOG.read_text(encoding="utf-8")
    return ""


def build_review_prompt(graphs: dict, silent_log: str, machine_results: dict) -> str:
    """构建审阅炉提示词（短上下文：只读提交物摘要）"""

    # 汇总统计
    total_spo = sum(len(d.get("spo", [])) for d in graphs.values())
    total_active = sum(
        sum(1 for s in d.get("spo", []) if s.get("status") == "ACTIVE")
        for d in graphs.values()
    )

    # 逐章摘要
    chapter_summaries = []
    for ch in sorted(graphs.keys()):
        d = graphs[ch]
        spo = d.get("spo", [])
        active = sum(1 for s in spo if s.get("status") == "ACTIVE")
        ext = sum(1 for s in spo if s.get("status") == "EXTENSION")
        silent = d.get("silent_count", 0)
        predicates = set(s.get("predicate", "") for s in spo)
        chapter_summaries.append(
            f"ch{ch}: {len(spo)}砖 ({active}ACTIVE/{ext}EXTENSION), "
            f"{silent}静默, 谓词={sorted(predicates)}"
        )

    # A4 跨章实体（从机器预检结果提取）
    a4_section = ""
    if machine_results:
        a4_data = machine_results.get("A4", {})
        conflicts = a4_data.get("conflicts", [])
        if conflicts:
            a4_section = "## A4 跨章实体边型差异（需裁定）\n\n"
            for c in conflicts:
                a4_section += f"- **{c['entity']}**: 跨章 {c['chapters']}, 边型={c['edge_types']}\n"
                for detail in c.get("details", []):
                    a4_section += f"  - ch{detail[0]} `{detail[1]}` edge_type={detail[2]} pred={detail[3]}\n"
            a4_section += "\n请逐项裁定：是否属于'同实体不同语境下合理边型差异'（XUAN），还是'标注错误'（INVALID）？\n"

    # A5 静默日志
    a5_section = ""
    if silent_log:
        # 截取前 3000 字符
        a5_section = f"## A5 静默日志（silent_log.md 摘要）\n\n```\n{silent_log[:3000]}\n```\n\n"
    a5_section += "请逐章检查：silent_count 与 silent_crystals 数组长度是否一致？静默日志中是否有各章记录？"

    prompt = f"""# 批1 审阅炉检查点 · 义理抽检

你是小澄真 Validator，负责对《道德经》双账本架构批1（ch1-ch10）机备账图谱进行审阅。

## 审阅对象
- 10 章图谱，共 {total_spo} 砖，{total_active} ACTIVE
- Schema: machine_ledger_v1.3（37 谓词集）
- 审阅协议: VAL-B1-2026-001（A1-A5 五项边界检查）

## 机器预检结果
A1 ACTIVE纯度: ✅ 通过
A2 谓词合规: ✅ 通过（37 谓词集）
A3 若字subtype: ✅ 通过

## 逐章统计
{chr(10).join(chapter_summaries)}

{a4_section}

{a5_section}

## 输出格式
请按以下格式输出审阅报告：

```
## 审阅结论

### A4 跨章一致性裁定
| 实体 | 涉及章 | 边型 | 裁定 | 理由 |
|------|--------|------|------|------|
| ... | ... | ... | VALID/XUAN/INVALID | ... |

### A5 静默真实性复核
| 章 | 判定 | 备注 |
|----|------|------|
| ... | VALID/XUAN | ... |

### 总体结论
- 批1 审阅: VALID / INVALID（附理由）
- G6a 污染级: N 项 / 0 项
- G6b 优化级: N 项（列出）

### 选型评价
- 审阅一致性: [高/中/低]
- 边界敏感度: [高/中/低]
- 对审阅炉的适用性: [适合/需调整/不适合]
```
"""
    return prompt


def call_llm(prompt: str, config: dict, api_key: str) -> dict:
    """调用 LLM API（OpenAI 兼容格式）"""
    url = f"{config['base_url']}/chat/completions"
    payload = {
        "model": config["model"],
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是小澄真 Validator，审阅炉的义理抽检执行者。"
                    "你只做边界检查，不裁决义理。"
                    "你的判定只有三种：VALID（合规）、INVALID（污染，须退回）、XUAN（边界模糊，交人工）。"
                    "输出必须严格遵循指定格式。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": config.get("temperature", REVIEW_TEMPERATURE),
        "max_tokens": config.get("max_tokens", REVIEW_MAX_TOKENS),
    }
    top_p = config.get("top_p", REVIEW_TOP_P)
    if top_p is not None:
        payload["top_p"] = top_p
    if "reasoning_effort" in config:
        payload["reasoning_effort"] = config["reasoning_effort"]

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        content = result["choices"][0]["message"]["content"]
        usage = result.get("usage", {})
        return {
            "success": True,
            "content": content,
            "usage": usage,
            "model": result.get("model", config["model"]),
        }
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        return {"success": False, "error": f"HTTP {e.code}: {body[:500]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def run_machine_precheck(chapters: list) -> dict:
    """运行机器预检（阶段一）"""
    # 导入 validate_batch1 的检查逻辑
    sys.path.insert(0, str(Path(__file__).parent))
    from validate_batch1 import (
        check_a1_active_purity,
        check_a2_predicate_compliance,
        check_a3_ruo_subtype,
        check_a4_cross_chapter,
        check_a5_silent_integrity,
        check_schema_version,
        check_direct_evidence_format,
    )

    graphs = load_graphs(chapters)
    results = {}

    for ch, data in graphs.items():
        spo = data.get("spo", [])
        silent_crystals = data.get("silent_crystals", [])
        silent_count = data.get("silent_count", 0)

        results[ch] = {
            "chapter": ch,
            "spo_count": len(spo),
            "A1": check_a1_active_purity(spo, ch),
            "A2": check_a2_predicate_compliance(spo),
            "A3": check_a3_ruo_subtype(spo),
            "A5": check_a5_silent_integrity(spo, silent_crystals, silent_count, ch),
            "schema_check": check_schema_version(data, ch),
            "de_format": check_direct_evidence_format(spo),
        }

    # A4 跨章
    a4_result = check_a4_cross_chapter(graphs)

    return {
        "per_chapter": results,
        "A4": a4_result,
        "total_spo": sum(r["spo_count"] for r in results.values()),
    }


def run_review(model_keys: list, chapters: list, output_json: bool = False):
    """执行审阅炉：机器预检 + LLM 义理抽检"""
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    # 阶段一：机器预检
    print("=" * 68)
    print("审阅炉 | 阶段一：机器预检（A1-A5）")
    print("=" * 68)
    machine_results = run_machine_precheck(chapters)

    g6a_count = 0
    for ch, r in machine_results["per_chapter"].items():
        a1_ok = r["A1"]["passed"]
        a2_ok = r["A2"]["passed"]
        a3_ok = r["A3"]["passed"]
        flags = []
        if not a1_ok: flags.append("A1")
        if not a2_ok: flags.append("A2")
        if not a3_ok: flags.append("A3")
        if flags:
            g6a_count += len(flags)
            print(f"  ch{ch}: ❌ {', '.join(flags)}")
        else:
            print(f"  ch{ch}: ✅ A1/A2/A3 通过")
    print(f"  A4 跨章实体: {machine_results['A4']['cross_chapter_entities']} 个, "
          f"冲突: {len(machine_results['A4']['conflicts'])} 个")
    print(f"  G6a 污染级: {g6a_count} 项")

    # 阶段二：LLM 义理抽检
    graphs = load_graphs(chapters)
    silent_log = load_silent_log()
    prompt = build_review_prompt(graphs, silent_log, machine_results)

    all_reports = {}
    for mk in model_keys:
        config = MODEL_CONFIGS.get(mk)
        if not config:
            print(f"\n[错误] 未知模型: {mk}，可用: {list(MODEL_CONFIGS.keys())}")
            continue

        api_key = load_api_key(config["env_key"])
        if not api_key:
            print(f"\n[跳过] {config['name']}: 未配置 {config['env_key']} 环境变量")
            all_reports[mk] = {"success": False, "error": f"未配置 {config['env_key']}"}
            continue

        masked = api_key[:6] + "..." + api_key[-4:]
        print(f"\n{'=' * 68}")
        print(f"审阅炉 | 阶段二：LLM 义理抽检 → {config['name']}")
        print(f"  model={config['model']}, "
              f"temperature={config.get('temperature', REVIEW_TEMPERATURE)}, "
              f"top_p={config.get('top_p', REVIEW_TOP_P)}, "
              f"max_tokens={config.get('max_tokens', REVIEW_MAX_TOKENS)}")
        print(f"  api_key={masked}")
        print(f"{'=' * 68}")

        t0 = time.time()
        result = call_llm(prompt, config, api_key)
        elapsed = time.time() - t0

        if result["success"]:
            print(f"  [完成] {result['usage'].get('total_tokens', '?')} tokens, "
                  f"{elapsed:.1f}s")
            # 保存报告
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_path = REVIEW_DIR / f"review_batch1_{mk}_{timestamp}.md"
            report_path.write_text(result["content"], encoding="utf-8")
            print(f"  [报告] {report_path}")
            result["report_path"] = str(report_path)
        else:
            print(f"  [失败] {result['error']}")

        all_reports[mk] = result

    # 多模型对比（如果运行了多个模型）
    if len(all_reports) >= 2:
        print(f"\n{'=' * 68}")
        print("审阅炉 | 多模型对比")
        print(f"{'=' * 68}")
        for mk, r in all_reports.items():
            name = MODEL_CONFIGS.get(mk, {}).get("name", mk)
            if r.get("success"):
                usage = r.get("usage", {})
                content_len = len(r.get("content", ""))
                print(f"  {name}: {usage.get('total_tokens', '?')} tokens, "
                      f"{content_len} 字, 报告={r.get('report_path', 'N/A')}")
            else:
                print(f"  {name}: 失败 - {r.get('error', 'N/A')}")

    if output_json:
        print(json.dumps(all_reports, ensure_ascii=False, indent=2, default=str))

    return all_reports


def main():
    parser = argparse.ArgumentParser(description="审阅炉：机器预检 + LLM 义理抽检")
    parser.add_argument("--model", default="deepseek",
                        help="模型标识，逗号分隔多个: deepseek,glm-5.3,kimi-k3")
    parser.add_argument("--chapters", default="1-10",
                        help="章节范围，如 1-10 或 1,2,3")
    parser.add_argument("--json", action="store_true", help="JSON 格式输出")
    parser.add_argument("--precheck-only", action="store_true",
                        help="仅运行机器预检，跳过 LLM 抽检")
    args = parser.parse_args()

    # 解析模型
    model_keys = [m.strip() for m in args.model.split(",")]

    # 解析章节
    chapters = []
    for part in args.chapters.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            chapters.extend(range(int(a), int(b) + 1))
        else:
            chapters.append(int(part))

    if args.precheck_only:
        machine_results = run_machine_precheck(chapters)
        if args.json:
            print(json.dumps(machine_results, ensure_ascii=False, indent=2, default=str))
        else:
            print(f"机器预检完成: {machine_results['total_spo']} 砖")
            print(f"A4 跨章冲突: {len(machine_results['A4']['conflicts'])} 个")
        return

    run_review(model_keys, chapters, args.json)


if __name__ == "__main__":
    main()