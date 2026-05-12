#!/usr/bin/env python3
"""
亲子对话缓存预热脚本 (warmup_cache.py)
==========================================
读取 data/family_metadata.json 中已审核（review_status: "approved"）的章节，
按章节 × 年龄段（3 个）× 轮次（首 3 轮）组合调用本地 API，
生成并保存对话缓存。

缓存输出: data/family_chat_cache.json
用法:
  python scripts/warmup_cache.py
  python scripts/warmup_cache.py --rounds 2    # 只预热前 2 轮
  python scripts/warmup_cache.py --port 8080   # 指定服务器端口
"""

import os
import re
import sys
import json
import time
import signal
import argparse
import subprocess
import urllib.request
import urllib.error

# ===== 路径配置 =====
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METADATA_FILE = os.path.join(PROJECT_ROOT, 'data', 'family_metadata.json')
CACHE_FILE = os.path.join(PROJECT_ROOT, 'data', 'family_chat_cache.json')
SERVER_SCRIPT = os.path.join(PROJECT_ROOT, 'server.js')

# ===== 年龄组 =====
AGE_GROUPS = ['age_4_6', 'age_7_9', 'age_10_12']

# 用于模拟孩子回答的占位文本（每个年龄段风格不同）
CHILD_RESPONSES = {
    'age_4_6': [
        '嗯嗯！小水滴好有趣！',
        '我也想像水一样！',
        '我懂了！'
    ],
    'age_7_9': [
        '我觉得水很厉害，因为它很柔软但很有力量。',
        '我想到了妈妈，她做了很多事但从来不说。',
        '嗯，我明白了，不争不是胆小，是另一种强大。'
    ],
    'age_10_12': [
        '老子说的"不争"和现代社会的竞争好像有矛盾，怎么理解呢？',
        '我觉得"处众人之所恶"需要很大的勇气。',
        '这些道理放在今天，好像还是很有用。'
    ]
}


def load_json(filepath):
    """加载 JSON 文件"""
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_json(filepath, data):
    """保存 JSON 文件"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'  缓存已保存至: {filepath}')


def get_approved_chapters():
    """获取已审核的章节列表"""
    metadata = load_json(METADATA_FILE)
    chapters = metadata.get('chapters', {})
    approved = {}
    for ch_key, ch_data in chapters.items():
        if ch_data.get('review_status') == 'approved':
            approved[int(ch_key)] = ch_data
    return approved


def find_free_port(start=8080, max_attempts=10):
    """查找可用端口"""
    import socket
    for port in range(start, start + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start


def start_server(port):
    """启动本地 Node.js 开发服务器"""
    print(f'  正在启动本地服务器（端口: {port}）...')
    try:
        proc = subprocess.Popen(
            ['node', SERVER_SCRIPT],
            cwd=PROJECT_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, 'PORT': str(port)}
        )
        # 等待服务器启动
        for _ in range(30):
            time.sleep(0.5)
            if proc.poll() is not None:
                # 进程已退出，读取错误
                _, stderr = proc.communicate()
                print(f'  服务器启动失败: {stderr.decode("utf-8", errors="replace")}')
                return None
            try:
                urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1)
                print(f'  服务器已就绪: http://127.0.0.1:{port}/')
                return proc
            except (urllib.error.URLError, ConnectionRefusedError, OSError):
                continue
        print('  服务器启动超时')
        proc.kill()
        return None
    except FileNotFoundError:
        print('  错误: 未找到 Node.js。请确保已安装 Node.js。')
        return None


def stop_server(proc):
    """停止服务器进程"""
    if proc:
        print('  正在停止服务器...')
        try:
            proc.send_signal(signal.SIGTERM)
            proc.wait(timeout=5)
        except (subprocess.TimeoutExpired, OSError):
            proc.kill()
            proc.wait()
        print('  服务器已停止')


def call_family_chat_api(port, chapter, age_group, conversation_history=None):
    """调用 /api/family_chat 端点"""
    if conversation_history is None:
        conversation_history = []

    body = json.dumps({
        'chapter': chapter,
        'age_group': age_group,
        'conversation_history': conversation_history
    }, ensure_ascii=False).encode('utf-8')

    req = urllib.request.Request(
        f'http://127.0.0.1:{port}/api/family_chat',
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if resp.status == 200:
                return data.get('huihui_response', ''), data.get('cached', False)
            else:
                print(f'    API 错误 ({resp.status}): {data.get("error", "Unknown")}')
                return None, False
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'    HTTP {e.code}: {body[:200]}')
        return None, False
    except Exception as e:
        print(f'    请求异常: {e}')
        return None, False


def warmup_chapter(port, chapter, chapter_data, num_rounds=3):
    """预热单个章节的所有年龄组 × 轮次"""
    results = {}

    for age_group in AGE_GROUPS:
        print(f'    年龄段: {age_group}')
        results[age_group] = {}

        # 模拟对话历史
        history = []

        for round_num in range(1, num_rounds + 1):
            print(f'      第 {round_num} 轮...', end=' ')

            response, was_cached = call_family_chat_api(
                port, chapter, age_group, history
            )

            if response is None:
                print('FAIL')
                results[age_group][f'round_{round_num}'] = None
                break  # 后续轮次依赖前一轮，无法继续

            status = '(cached)' if was_cached else '(generated)'
            print(f'OK {status}')
            results[age_group][f'round_{round_num}'] = response

            # 为下一轮构造对话历史
            history.append({'role': 'huihui', 'content': response})

            # 添加模拟的孩子回答
            child_resp_idx = (round_num - 1) % len(CHILD_RESPONSES[age_group])
            child_answer = CHILD_RESPONSES[age_group][child_resp_idx]
            history.append({'role': 'user', 'content': child_answer})

            # 轮次之间短暂延迟
            if round_num < num_rounds:
                time.sleep(0.5)

    return results


def main():
    parser = argparse.ArgumentParser(
        description='亲子对话缓存预热脚本 - 预生成亲子对话缓存'
    )
    parser.add_argument('--rounds', type=int, default=3,
                        help='预热的对话轮次数（默认: 3）')
    parser.add_argument('--port', type=int, default=0,
                        help='本地服务器端口（默认: 自动查找可用端口）')
    parser.add_argument('--no-server', action='store_true',
                        help='不启动服务器，使用已有服务器（需手动启动 server.js）')
    args = parser.parse_args()

    # 获取已审核的章节
    approved = get_approved_chapters()
    if not approved:
        print('未找到已审核的章节（review_status: "approved"）。')
        print('请先运行 extract_meta.py 生成元数据，然后人工审核后修改 review_status 为 "approved"。')
        sys.exit(1)

    chapter_list = sorted(approved.keys())
    print(f'已审核章节: {chapter_list}')
    print(f'年龄组: {AGE_GROUPS}')
    print(f'每章轮次: {args.rounds}')
    total_calls = len(chapter_list) * len(AGE_GROUPS) * args.rounds
    print(f'预估 API 调用次数: {total_calls}\n')

    # 加载已有缓存
    existing_cache = load_json(CACHE_FILE)
    if not existing_cache:
        existing_cache = {
            '_version': '1.0',
            '_updated': '',
            '_generated_by': 'warmup_cache.py',
            'entries': {}
        }
    existing_cache.setdefault('entries', {})

    server_proc = None
    port = args.port

    try:
        if not args.no_server:
            if port == 0:
                port = find_free_port()
            server_proc = start_server(port)
            if server_proc is None:
                sys.exit(1)

        print('=' * 60)
        print('开始缓存预热')
        print('=' * 60)

        total_success = 0
        total_failed = 0

        for chapter in chapter_list:
            chapter_data = approved[chapter]
            ch_key = str(chapter)
            title = chapter_data.get('title', 'Unknown')

            print(f'\n第{chapter}章 · {title}')

            results = warmup_chapter(port, chapter, chapter_data, args.rounds)

            # 统计结果
            for age_group in AGE_GROUPS:
                age_results = results.get(age_group, {})
                for round_key, value in age_results.items():
                    if value is not None:
                        total_success += 1
                    else:
                        total_failed += 1

            # 保存到缓存
            existing_cache['entries'][ch_key] = results
            existing_cache['_updated'] = time.strftime('%Y-%m-%d')

            # 每章完成后保存一次（防止中断丢失）
            save_json(CACHE_FILE, existing_cache)

        # 输出汇总
        print('\n' + '=' * 60)
        print('汇总报告')
        print('=' * 60)
        print(f'处理章节数: {len(chapter_list)}')
        print(f'年龄组数: {len(AGE_GROUPS)}')
        print(f'每章轮次: {args.rounds}')
        print(f'总成功: {total_success}')
        print(f'总失败: {total_failed}')
        print(f'输出文件: {CACHE_FILE}')

        # 统计缓存大小
        file_size = os.path.getsize(CACHE_FILE) if os.path.exists(CACHE_FILE) else 0
        print(f'缓存文件大小: {file_size / 1024:.1f} KB')

    finally:
        if server_proc:
            stop_server(server_proc)


if __name__ == '__main__':
    main()
