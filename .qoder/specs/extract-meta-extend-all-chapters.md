# 扩展 extract_meta.py 支持全量 81 章处理

## Context

当前 `extract_meta.py` 只处理 `CORE_CHAPTERS`（20 章），需要扩展以支持全量 1-81 章。`family_metadata.json` 中已有 36 章（全 `approved`），缺失 45 章。所有 81 章的 HTML 文件均存在于 `chapters/` 目录。

## Approach

仅修改章节选择层（"前门"），不触及提取流水线（L1 提取 → DeepSeek API → JSON 解析 → 保存）。脚本已有的跳过逻辑会自动过滤掉已存在的 36 章，`--all` 实际只处理 45 个缺失章节。

## Changes to `scripts/extract_meta.py`

### 1. 修复重复的 `if __name__ == '__main__':` 块（行 483-489）

删除行 483-486（重复的 `main()` 调用和冗余 print），保留行 488-489。这会导致脚本运行两次的 bug。

### 2. 添加 `--all` / `-a` 命令行参数

在 `--chapters` 参数之后添加：

```python
parser.add_argument('-a', '--all', action='store_true',
                    help='全量模式，处理全部 81 章（已有元数据的章节自动跳过）')
```

### 3. 添加 `--all` 的章节列表解析

在 `if args.batch:` 分支之后添加：

```python
elif args.all:
    chapter_list = list(range(1, 82))
    print(f'全量模式: 将处理全部 81 章（已有元数据的章节自动跳过）')
```

### 4. 更新文档字符串

在模块 docstring 的用法示例中添加：

```
  # 全量模式（全部 81 章，自动跳过已有章节）
  python scripts/extract_meta.py --all
  python scripts/extract_meta.py -a
```

### 5. 更新 argparse epilog

添加示例行：`python extract_meta.py --all             # 全量 81 章`

## 不需要修改的部分

- `process_chapter()` — 不变
- `build_extraction_prompt()` — 不变
- `call_deepseek()` — 不变
- `parse_metadata_response()` — 不变（已设置 `review_status: 'pending'`）
- `save_metadata()` — 不变
- 现有 `--batch`、`--chapter`、`--chapters` 模式 — 完全保留

## 关键文件

- `scripts/extract_meta.py` — 唯一需修改的文件（5 处改动）
- `data/family_metadata.json` — 参考（确认 36 章已有，45 章缺失）
- `chapters/ch{XX}.html` — 参考（确认 81 个文件均存在）

## Verification

1. `python scripts/extract_meta.py --help` — 确认 `--all`/`-a` 出现在帮助中
2. `python scripts/extract_meta.py -c 1` — 确认 main() 只运行一次（无重复输出）
3. `python scripts/extract_meta.py -a` — 端到端运行（需 API key），验证：
   - 已有 36 章被正确跳过
   - 新生成 45 章元数据的 `review_status` 均为 `"pending"`
   - 汇总报告统计一致
   - 现有 `approved` 章节元数据未被修改
