#!/usr/bin/env python3
"""
亲子共读元数据提取脚本 (extract_meta.py)
============================================
读取 chapters/ch{XX}.html 中的白话版 (L1) 内容，调用 DeepSeek API
提取亲子对话元数据，输出为标准 JSON 格式追加到 data/family_metadata.json。

用法:
  # 单章测试模式
  python scripts/extract_meta.py --chapter 8
  python scripts/extract_meta.py -c 8

  # 批量模式（20 章核心章节）
  python scripts/extract_meta.py --batch
  python scripts/extract_meta.py -b

  # 自定义章节列表
  python scripts/extract_meta.py --chapters 3,7,9,11,12
"""

import os
import re
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

# ===== 路径配置 =====
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAPTERS_DIR = os.path.join(PROJECT_ROOT, 'chapters')
METADATA_FILE = os.path.join(PROJECT_ROOT, 'data', 'family_metadata.json')

# ===== DeepSeek API 配置 =====
DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
DEEPSEEK_MODEL = 'deepseek-chat'

# 第一批核心章节（20 章，不含已审核的第 1、2、8 章）
CORE_CHAPTERS = [3, 7, 9, 11, 12, 14, 16, 22, 25, 33,
                 38, 42, 44, 48, 55, 63, 67, 71, 78, 81]


def load_api_key():
    """加载 DeepSeek API Key（优先环境变量，其次 .env 文件）"""
    key = os.environ.get('DEEPSEEK_API_KEY', '')
    if key:
        return key

    # 尝试从 .env 文件读取
    env_file = os.path.join(PROJECT_ROOT, '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('DEEPSEEK_API_KEY='):
                    val = line.split('=', 1)[1].strip()
                    if val:
                        return val
    return ''


def load_metadata():
    """加载现有元数据文件"""
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'chapters': {}, '_version': '1.0', '_updated': ''}


def save_metadata(metadata):
    """保存元数据文件"""
    metadata['_updated'] = time.strftime('%Y-%m-%d')
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=4)
    print(f'  元数据已保存至: {METADATA_FILE}')


def extract_chapter_info(html_content):
    """从章节 HTML 提取标题、原文、概念标签和 L1 白话内容"""
    info = {
        'chapter_num': None,
        'title': 'Unknown',
        'original_text': '',
        'concepts': [],
        'l1_content': ''
    }

    # 提取标题（从 <h1> 标签）
    # 格式: <h1>\n        💧 第8章 · 上善若水\n        <span class="subtitle">...
    title_match = re.search(
        r'<h1>\s*.*?第(\d+)章\s*·\s*(.+?)(?:\s*<span|\s*\n|<)',
        html_content, re.DOTALL
    )
    if title_match:
        info['chapter_num'] = int(title_match.group(1))
        info['title'] = title_match.group(2).strip()

    # 提取原文（<div class="original-text">）
    orig_match = re.search(
        r'<div class="original-text">(.*?)</div>',
        html_content, re.DOTALL
    )
    if orig_match:
        raw = orig_match.group(1).strip()
        raw = re.sub(r'<br\s*/?>', '\n', raw)
        raw = re.sub(r'<[^>]+>', '', raw)
        info['original_text'] = raw.strip()

    # 提取概念标签
    concept_matches = re.findall(
        r'<span class="concept-tag\s+\w+">([^<]+)</span>',
        html_content
    )
    info['concepts'] = list(dict.fromkeys(concept_matches))  # 去重保序

    # 提取所有 L1 白话版内容块
    # 每个 L1 块: <div class="level-block level-l1" data-level="l1">
    #                <h4>👶 大白话版</h4>
    #                <p>...</p>
    #             </div>
    l1_pattern = re.compile(
        r'<div class="level-block level-l1" data-level="l1">\s*'
        r'<h4>.*?</h4>\s*'
        r'(.*?)'
        r'</div>',
        re.DOTALL
    )
    l1_blocks = l1_pattern.findall(html_content)

    l1_texts = []
    for block in l1_blocks:
        p_matches = re.findall(r'<p>(.*?)</p>', block, re.DOTALL)
        for p in p_matches:
            clean = re.sub(r'<[^>]+>', '', p).strip()
            if clean:
                l1_texts.append(clean)

    info['l1_content'] = '\n\n'.join(l1_texts)
    return info


def build_extraction_prompt(chapter_info):
    """构建发送给 DeepSeek 的提取提示词"""
    prompt = f"""你是一位深谙《道德经》与儿童教育的专家。请根据以下第{chapter_info['chapter_num']}章的白话版内容，
提取亲子共读所需的元数据。

## 章节基本信息
- 章节号: 第{chapter_info['chapter_num']}章
- 标题: {chapter_info['title']}
- 核心概念: {', '.join(chapter_info['concepts']) if chapter_info['concepts'] else '无'}

## 原文
{chapter_info['original_text']}

## 白话版全文（L1 儿童友好版）
{chapter_info['l1_content']}

## 需要提取的元数据结构
请严格输出以下 JSON 格式（不要包含任何其他内容，不要用 markdown 代码块包裹）:

{{
  "chapter": {chapter_info['chapter_num']},
  "title": "{chapter_info['title']}",
  "core_idea": "用一句话（不超过80字）概括本章的核心智慧，必须用孩子和家长都能懂的自然语言，不用任何哲学术语。像在讲故事一样表述。",
  "safety_notes": [
    "列出 2-4 条亲子对话中必须避免的话题或表述方式，每条一句话。关注: 避免引发儿童恐惧、焦虑、或道德困惑的内容"
  ],
  "interaction_points": [
    {{
      "topic": "互动话题名（3-6个字）",
      "age_4_6": "针对4-6岁孩子的引导方向，用大自然、小动物、日常生活中的比喻，具体到孩子能用手指出或学一句动物叫的程度。如果此话题不适合该年龄段，设为 null",
      "age_7_9": "针对7-9岁孩子的引导方向，可以引入简单概念但必须用实例说明，用开放式提问。如果此话题不适合该年龄段，设为 null",
      "age_10_12": "针对10-12岁孩子的引导方向，可以带有思辨性，引入原文和抽象概念，鼓励孩子提出自己的理解。如果此话题不适合该年龄段，设为 null"
    }},
    {{
      "topic": "第二个互动话题名",
      "age_4_6": "...或 null",
      "age_7_9": "...或 null",
      "age_10_12": "...或 null"
    }},
    {{
      "topic": "把智慧带入生活",
      "age_4_6": "引导孩子在日常小事中体验本章智慧（如洗澡时、吃饭时、玩耍时）",
      "age_7_9": "邀请孩子和父母聊聊与本章相关的家庭生活话题",
      "age_10_12": "提醒孩子本章深意可以慢慢聊，不急于求成"
    }}
  ],
  "parent_tips": "给家长的一句温暖提示（不超过60字），告诉他们在共读之外可以怎么做。不说教，不指导，只是轻轻提醒。像朋友在耳边说的话。"
}}

## 安全约束（必须严格遵守）
- 不涉及洪水、溺水、地震、战争、死亡等可能引发儿童恐惧的话题
- 不使用「不可知论」「虚无主义」「相对主义」等哲学术语
- 不将任何概念曲解为消极逃避或放弃努力
- 不涉及身体外貌、身材等可能引发儿童焦虑的外在比较
- 不对任何孩子可能有的行为做道德评判
- 所有表述必须温暖、包容、积极

## 重要提醒
- core_idea 必须像在讲故事，不能像在写教科书
- 每个 interaction_point 的 topic 要具体、有趣、孩子一听就懂
- parent_tips 必须是给家长的温暖陪伴式提醒，不是指导性的"你应该"
- 至少提供 2 个互动话题，最多 3 个（第三个固定为「把智慧带入生活」）
- 输出必须是合法的 JSON，不要包含 markdown 标记```
"""
    return prompt


def call_deepseek(prompt, api_key):
    """调用 DeepSeek API 生成元数据"""
    messages = [
        {
            'role': 'system',
            'content': (
                '你是一位深谙《道德经》的儿童教育专家，也是"慧惠"亲子体验营的内容顾问。'
                '你的任务是从《道德经》章节的白话版内容中提取亲子对话所需的元数据。'
                '你严格遵守儿童保护原则（慧惠最高产品宪法第十一条），'
                '所有输出都必须温暖、安全、包容。'
                '你只输出合法的 JSON，不输出任何其他内容。'
            )
        },
        {
            'role': 'user',
            'content': prompt
        }
    ]

    body = json.dumps({
        'model': DEEPSEEK_MODEL,
        'messages': messages,
        'temperature': 0.7,
        'max_tokens': 2000,
        'response_format': {'type': 'json_object'}
    }, ensure_ascii=False).encode('utf-8')

    req = urllib.request.Request(
        DEEPSEEK_API_URL,
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if resp.status != 200:
                print(f'  DeepSeek API 返回错误状态: {resp.status}')
                print(f'  详情: {data}')
                return None
            content = data['choices'][0]['message']['content']
            return content
    except urllib.error.HTTPError as e:
        print(f'  HTTP 错误: {e.code}')
        print(f'  详情: {e.read().decode("utf-8")[:500]}')
        return None
    except Exception as e:
        print(f'  请求异常: {e}')
        return None


def parse_metadata_response(response_text, chapter_num):
    """解析并验证 DeepSeek 返回的元数据 JSON"""
    # 尝试提取 JSON（DeepSeek 有时会用 markdown 代码块包裹）
    json_text = response_text.strip()

    # 尝试匹配 ```json ... ``` 包裹的情况
    code_block_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', json_text, re.DOTALL)
    if code_block_match:
        json_text = code_block_match.group(1).strip()

    try:
        meta = json.loads(json_text)
    except json.JSONDecodeError as e:
        print(f'  JSON 解析失败: {e}')
        print(f'  原始响应前 500 字符: {json_text[:500]}')
        return None

    # 验证必填字段
    required = ['chapter', 'title', 'core_idea', 'safety_notes', 'interaction_points', 'parent_tips']
    for field in required:
        if field not in meta:
            print(f'  缺少必填字段: {field}')
            return None

    # 修正章节号
    meta['chapter'] = int(meta['chapter'])

    # 添加审核状态
    meta['review_status'] = 'pending'
    meta['reviewed_by'] = ''
    meta['reviewed_at'] = ''

    # 验证 interaction_points
    if not meta['interaction_points'] or len(meta['interaction_points']) < 2:
        print(f'  互动话题数量不足（至少需要 2 个，当前: {len(meta.get("interaction_points", []))}）')
        return None

    for i, pt in enumerate(meta['interaction_points']):
        if 'topic' not in pt:
            print(f'  互动话题 #{i+1} 缺少 topic 字段')
            return None

    # 验证 safety_notes
    if not meta['safety_notes'] or len(meta['safety_notes']) < 1:
        print(f'  安全提示数量不足（至少需要 1 条）')
        return None

    return meta


def process_chapter(chapter_num, api_key):
    """处理单个章节的元数据提取"""
    chapter_file = os.path.join(CHAPTERS_DIR, f'ch{chapter_num:02d}.html')
    if not os.path.exists(chapter_file):
        print(f'  章节文件不存在: {chapter_file}')
        return None

    # 读取 HTML
    with open(chapter_file, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 提取章节信息
    info = extract_chapter_info(html_content)
    if not info['chapter_num']:
        print(f'  无法从 HTML 中提取章节号')
        return None

    print(f'  章节: 第{info["chapter_num"]}章 · {info["title"]}')
    print(f'  L1 内容长度: {len(info["l1_content"])} 字符')
    print(f'  概念: {", ".join(info["concepts"]) if info["concepts"] else "无"}')

    # 检查 L1 内容是否足够
    if len(info['l1_content']) < 50:
        print(f'  L1 内容太短（{len(info["l1_content"])} 字符），跳过')
        return None

    # 构建提示词
    prompt = build_extraction_prompt(info)
    print(f'  提示词长度: {len(prompt)} 字符')

    # 调用 DeepSeek API
    print(f'  正在调用 DeepSeek API...')
    response_text = call_deepseek(prompt, api_key)
    if not response_text:
        return None

    print(f'  响应长度: {len(response_text)} 字符')

    # 解析并验证
    meta = parse_metadata_response(response_text, chapter_num)
    if not meta:
        return None

    print(f'  core_idea: {meta.get("core_idea", "")[:60]}...')
    print(f'  safety_notes: {len(meta.get("safety_notes", []))} 条')
    print(f'  interaction_points: {len(meta.get("interaction_points", []))} 个')
    print(f'  parent_tips: {meta.get("parent_tips", "")[:60]}...')

    return meta


def main():
    parser = argparse.ArgumentParser(
        description='亲子共读元数据提取脚本 - 从章节 HTML 提取亲子对话元数据',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python extract_meta.py --chapter 8      # 单章测试
  python extract_meta.py --batch           # 批量处理 20 章核心章节
  python extract_meta.py -c 3,7,9          # 自定义章节列表
        """
    )
    parser.add_argument('-c', '--chapter', type=str,
                        help='单个章节号（测试模式），或逗号分隔的章节号列表')
    parser.add_argument('-b', '--batch', action='store_true',
                        help='批量模式，处理 20 章核心章节')
    parser.add_argument('--chapters', type=str,
                        help='自定义章节号列表（逗号分隔）')
    args = parser.parse_args()

    # 加载 API Key
    api_key = load_api_key()
    if not api_key:
        print('错误: 未找到 DEEPSEEK_API_KEY。请设置环境变量或在 .env 文件中配置。')
        sys.exit(1)
    print(f'DEEPSEEK_API_KEY: {api_key[:12]}...{api_key[-4:]}')

    # 确定要处理的章节列表
    chapter_list = []
    if args.batch:
        chapter_list = CORE_CHAPTERS
        print(f'批量模式: 将处理 {len(chapter_list)} 章核心章节')
    elif args.chapter:
        # 支持单章或逗号分隔列表
        if ',' in args.chapter:
            chapter_list = [int(c.strip()) for c in args.chapter.split(',') if c.strip()]
        else:
            chapter_list = [int(args.chapter)]
    elif args.chapters:
        chapter_list = [int(c.strip()) for c in args.chapters.split(',') if c.strip()]
    else:
        parser.print_help()
        print('\n提示: 请使用 --chapter 或 --batch 参数指定要处理的章节。')
        sys.exit(1)

    if not chapter_list:
        print('错误: 未指定有效的章节号')
        sys.exit(1)

    print(f'目标章节: {chapter_list}')

    # 加载现有元数据
    metadata = load_metadata()
    existing = set(metadata.get('chapters', {}).keys())
    print(f'已有元数据的章节: {sorted(existing, key=int) if existing else "无"}')

    # 跳过已存在的章节
    chapters_to_process = []
    for ch in chapter_list:
        key = str(ch)
        if key in existing:
            status = metadata['chapters'][key].get('review_status', 'unknown')
            print(f'  第{ch}章已存在（状态: {status}），跳过')
        else:
            chapters_to_process.append(ch)

    if not chapters_to_process:
        print('\n所有目标章节已有元数据，无需处理。')
        return

    print(f'\n需处理的章节: {chapters_to_process}\n')

    # 逐个处理
    success = 0
    failed = 0
    for i, ch in enumerate(chapters_to_process, 1):
        print(f'[{i}/{len(chapters_to_process)}] 处理第{ch}章...')
        try:
            meta = process_chapter(ch, api_key)
            if meta:
                metadata.setdefault('chapters', {})[str(ch)] = meta
                save_metadata(metadata)
                success += 1
                print(f'  [OK] 第{ch}章元数据已生成并保存\n')
            else:
                failed += 1
                print(f'  [FAIL] 第{ch}章元数据提取失败\n')
        except Exception as e:
            failed += 1
            print(f'  [FAIL] 第{ch}章处理异常: {e}\n')

        # 每章之间间隔 2 秒，避免 API 限流
        if i < len(chapters_to_process):
            time.sleep(2)

    # 输出汇总报告
    print('=' * 60)
    print('汇总报告')
    print('=' * 60)
    print(f'处理章节数: {len(chapters_to_process)}')
    print(f'成功: {success}')
    print(f'失败: {failed}')

    total = len(metadata.get('chapters', {}))
    pending = sum(
        1 for c in metadata.get('chapters', {}).values()
        if c.get('review_status') == 'pending'
    )
    approved = sum(
        1 for c in metadata.get('chapters', {}).values()
        if c.get('review_status') == 'approved'
    )
    print(f'元数据总计: {total} 章（已审核: {approved}, 待审核: {pending}）')
    print(f'输出文件: {METADATA_FILE}')
    print('\n[!] 所有新生成的元数据 review_status 均为 "pending"，需要人工审核后才能在生产环境使用。')
    print('审核流程: 检视 core_idea → 验证 safety_notes → 评估 interaction_points → 修改 review_status 为 "approved"')


if __name__ == '__main__':
    main()
    print('审核流程: 检视 core_idea → 验证 safety_notes → 评估 interaction_points → 修改 review_status 为 "approved"')


if __name__ == '__main__':
    main()
