---
name: family-metadata-extraction
description: 亲子共读元数据自动提取工作流。读取 chapters/ch{XX}.html 中的白话版 (L1) 内容，调用 DeepSeek API 提取亲子对话元数据（core_idea、safety_notes、interaction_points、parent_tips），输出为标准 JSON 追加到 data/family_metadata.json。支持单章测试、批量 20 章核心章节、全量 81 章、以及自定义章节列表四种模式。自动跳过已有元数据的章节。当用户需要为章节生成亲子对话元数据、批量提取 metadata、或建立亲子阅读内容库时使用本 Skill。
---

# 亲子共读元数据提取

通过 `extract_meta.py` 从章节 HTML 中提取 L1 白话内容，调用 DeepSeek API 生成结构化的亲子对话元数据。是亲子时光（Family Chat）功能的**数据基础**。

## 1. 架构

### 1.1 数据流

```
chapters/ch{XX}.html
        │
        │ 提取: 标题, 原文, 概念标签, L1 白话内容
        ▼
   构建提取提示词 (build_extraction_prompt)
        │
        │ 含: 章节信息 + L1 全文 + JSON schema + 安全约束
        ▼
   DeepSeek API (POST /v1/chat/completions)
        │
        │ model: deepseek-chat
        │ response_format: json_object
        ▼
   JSON 响应解析 + 验证 (parse_metadata_response)
        │
        │ 验证: 必填字段, interaction_points 数量, safety_notes 数量
        ▼
   data/family_metadata.json
   (review_status: "pending" → 等待审核)
```

### 1.2 元数据结构

```json
{
  "chapters": {
    "8": {
      "chapter": 8,
      "title": "上善若水",
      "core_idea": "最高的善就像水一样，水默默滋养万物却从不争抢，总是流向大家不愿意去的低处，却最有力量。",
      "safety_notes": [
        "避免将'处众人之所恶'曲解为自我贬低或忍受欺凌",
        "避免引发对深水/洪水的恐惧联想"
      ],
      "interaction_points": [
        {
          "topic": "水像什么？",
          "age_4_6": "和孩子一起观察水龙头流水、下雨时的水洼，问'水去了哪里？'",
          "age_7_9": "和孩子聊聊'水为什么总能找到最低的地方'，引导思考不争的意义",
          "age_10_12": "引入'上善若水'的原文，讨论为什么老子用'水'而不是'石头'或'风'来比喻最高善"
        },
        {
          "topic": "把智慧带入生活",
          "age_4_6": "鼓励孩子在帮妈妈倒水、给花浇水时想起'水的好'",
          "age_7_9": "邀请孩子和父母聊聊'最近有没有像水一样默默帮助别人的时刻'",
          "age_10_12": "提醒孩子'上善若水'的精神可以慢慢体会，不必急于理解"
        }
      ],
      "parent_tips": "今天可以和孩子一起倒杯水，看着水静静流淌，什么也不说。那种安静本身就是一种力量。",
      "review_status": "pending",
      "reviewed_by": "",
      "reviewed_at": ""
    }
  },
  "_version": "1.0",
  "_updated": "2026-05-14"
}
```

### 1.3 安全约束体系（慧惠最高产品宪法第十一条）

DeepSeek API 调用时强制注入以下约束：

| 约束类别 | 具体规则                                                   |
| -------- | ---------------------------------------------------------- |
| 灾害规避 | 不涉及洪水、溺水、地震、战争、死亡等可能引发儿童恐惧的话题 |
| 术语净化 | 不使用「不可知论」「虚无主义」「相对主义」等哲学术语       |
| 积极导向 | 不将任何概念曲解为消极逃避或放弃努力                       |
| 外在比较 | 不涉及身体外貌、身材等可能引发儿童焦虑的比较               |
| 道德评判 | 不对任何孩子可能有的行为做道德评判                         |
| 语气要求 | 所有表述必须温暖、包容、积极                               |

---

## 2. 前置条件

### 2.1 必需条件

- Python 3.6+
- `chapters/ch{XX}.html` 文件存在且包含 L1 白话内容（`<div class="level-block level-l1" data-level="l1">`）
- L1 内容长度 ≥ 50 字符（否则脚本自动跳过）
- DeepSeek API Key 已配置

### 2.2 API Key 配置

```bash
# 方式一：环境变量（推荐）
export DEEPSEEK_API_KEY="sk-<your-api-key>"

# 方式二：.env 文件
echo "DEEPSEEK_API_KEY=sk-<your-api-key>" > .env
```

加载顺序：环境变量优先 → `.env` 文件回退。

### 2.3 依赖

无需额外安装 Python 库。脚本仅使用标准库：`os`, `re`, `sys`, `json`, `time`, `argparse`, `urllib.request`, `urllib.error`。

---

## 3. 执行步骤

### 3.1 单章测试模式

```bash
# 测试单个章节（验证流程和输出格式）
python scripts/extract_meta.py --chapter 8
python scripts/extract_meta.py -c 8
```

**执行流程：**
1. 读取 `chapters/ch08.html`
2. 提取章节号、标题、原文、概念标签、L1 白话内容
3. 检查 L1 内容长度（≥ 50 字符）
4. 构建提取提示词（约 2000+ 字符）
5. 调用 DeepSeek API（`deepseek-chat` 模型，temperature=0.7，max_tokens=2000）
6. 解析 JSON 响应，验证字段完整性
7. 设置 `review_status: "pending"`
8. 保存到 `data/family_metadata.json`

**输出示例：**
```
DEEPSEEK_API_KEY: sk-xxxxxxxx...xxxx
目标章节: [8]
已有元数据的章节: [1, 2]
需处理的章节: [8]

[1/1] 处理第8章...
  章节: 第8章 · 上善若水
  L1 内容长度: 847 字符
  概念: 水, 不争, 处下
  提示词长度: 2341 字符
  正在调用 DeepSeek API...
  响应长度: 1856 字符
  core_idea: 最高的善就像水一样...
  safety_notes: 3 条
  interaction_points: 3 个
  parent_tips: 今天可以和孩子一起倒杯水...
  元数据已保存至: data/family_metadata.json
  [OK] 第8章元数据已生成并保存

============================================================
汇总报告
============================================================
处理章节数: 1
成功: 1
失败: 0
元数据总计: 3 章（已审核: 2, 待审核: 1）
输出文件: data/family_metadata.json

[!] 所有新生成的元数据 review_status 均为 "pending"
```

### 3.2 批量模式（20 章核心章节）

```bash
# 处理 20 章核心章节
python scripts/extract_meta.py --batch
python scripts/extract_meta.py -b
```

**默认核心章节列表**（不含已审核的第 1、2、8 章）：
```
3, 7, 9, 11, 12, 14, 16, 22, 25, 33,
38, 42, 44, 48, 55, 63, 67, 71, 78, 81
```

- 自动跳过已存在于 `family_metadata.json` 中的章节
- 每章之间间隔 2 秒（避免 DeepSeek API 限流）

### 3.3 全量模式（81 章）

```bash
# 处理全部 81 章
python scripts/extract_meta.py --all
python scripts/extract_meta.py -a
```

- 遍历第 1-81 章
- 已有元数据的章节自动跳过
- 每章之间间隔 2 秒
- 预计耗时：约 10-15 分钟（取决于已有章节数）

### 3.4 自定义章节列表

```bash
# 逗号分隔
python scripts/extract_meta.py --chapters 3,7,9,11,12

# 等价于
python scripts/extract_meta.py -c 3,7,9,11,12
```

---

## 4. 参数参考

| 参数         | 简写 | 类型 | 说明                         |
| ------------ | ---- | ---- | ---------------------------- |
| `--chapter`  | `-c` | str  | 单章号或逗号分隔的章节号列表 |
| `--batch`    | `-b` | flag | 批量模式，处理 20 章核心章节 |
| `--all`      | `-a` | flag | 全量模式，处理全部 81 章     |
| `--chapters` | —    | str  | 自定义章节号列表（逗号分隔） |

> 四个参数必须指定其一，否则打印帮助信息。

---

## 5. API 调用详情

### 5.1 请求结构

```python
{
    "model": "deepseek-chat",
    "messages": [
        {
            "role": "system",
            "content": "你是一位深谙《道德经》的儿童教育专家..."
        },
        {
            "role": "user",
            "content": "<构建的提取提示词（含 L1 全文 + schema + 约束）>"
        }
    ],
    "temperature": 0.7,
    "max_tokens": 2000,
    "response_format": {"type": "json_object"}
}
```

### 5.2 Token 估算

| 环节                     |  约 Token 数   |
| ------------------------ | :------------: |
| System Prompt            |      ~200      |
| 提取提示词（含 L1 全文） |   ~800-1500    |
| JSON 响应                |    ~400-800    |
| **单次总计**             | **~1400-2500** |

### 5.3 费用估算

基于 DeepSeek Chat API 定价（$0.14/1M input tokens, $0.28/1M output tokens）：

| 模式         | 章节数 | 预估费用 |
| ------------ | :----: | -------- |
| 单章测试     |   1    | < $0.001 |
| 批量 (20 章) |   20   | ~$0.01   |
| 全量 (81 章) |   81   | ~$0.04   |

---

## 6. 响应解析与验证

### 6.1 JSON 提取策略

脚本支持两种响应格式：

1. **纯 JSON** — 直接解析
2. **Markdown 包裹** — 正则匹配 ` ```json ... ``` ` 后解析

### 6.2 字段验证规则

| 字段                   | 验证规则            | 失败处理 |
| ---------------------- | ------------------- | -------- |
| `chapter`              | 必须存在            | 跳过该章 |
| `title`                | 必须存在            | 跳过该章 |
| `core_idea`            | 必须存在            | 跳过该章 |
| `safety_notes`         | ≥ 1 条              | 跳过该章 |
| `interaction_points`   | ≥ 2 个              | 跳过该章 |
| 每个 interaction_point | 必须有 `topic` 字段 | 跳过该章 |

### 6.3 审核状态自动设置

所有新生成的元数据自动标记：
```json
{
  "review_status": "pending",
  "reviewed_by": "",
  "reviewed_at": ""
}
```

生成后需通过 `admin/family-review.html` 进行人工审核，手动将 `review_status` 改为 `"approved"` 后才能在生产环境使用。

---

## 7. 元数据维护

### 7.1 重新生成某章

```bash
# 1. 从 family_metadata.json 中手动删除目标章节的条目
#    或在 admin/family-review.html 中将 status 标记为 revision_needed

# 2. 重新运行提取
python scripts/extract_meta.py --chapter 8
```

如果目标章节已存在于 `family_metadata.json` 中，脚本会自动跳过。需要先手动删除或修改状态。

### 7.2 增量更新

```bash
# 只提取新增的章节（自动跳过已有的）
python scripts/extract_meta.py --all

# 或指定新增的章节范围
python scripts/extract_meta.py --chapters 76-81
```

### 7.3 查看元数据统计

```bash
python -c "
import json
with open('data/family_metadata.json') as f:
    d = json.load(f)
chapters = d.get('chapters', {})
approved = sum(1 for v in chapters.values() if v.get('review_status') == 'approved')
pending = sum(1 for v in chapters.values() if v.get('review_status') == 'pending')
revision = sum(1 for v in chapters.values() if v.get('review_status') == 'revision_needed')
print(f'总计: {len(chapters)} 章')
print(f'已审核: {approved} | 待审核: {pending} | 需修改: {revision}')
print(f'目标审核率: {approved}/81 = {approved/81*100:.1f}%')
"
```

---

## 8. 故障排除

### 8.1 "DEEPSEEK_API_KEY 未找到"

**原因**：未设置环境变量且无 `.env` 文件。

**解决**：
```bash
# 方式一
export DEEPSEEK_API_KEY="sk-<your-api-key>"

# 方式二：创建 .env 文件
echo "DEEPSEEK_API_KEY=sk-<your-api-key>" > .env
```

### 8.2 "章节文件不存在"

**原因**：`chapters/ch{XX}.html` 文件缺失。

**解决**：确认章节 HTML 文件已生成。如需生成，使用 `daodejing-chapter-analysis` Skill。

### 8.3 "L1 内容太短（X 字符），跳过"

**原因**：章节 HTML 中 L1 白话内容不足 50 字符。

**解决**：检查章节 HTML 中 `<div class="level-block level-l1" data-level="l1">` 区块是否完整。

### 8.4 "JSON 解析失败"

**原因**：DeepSeek 返回的不是合法 JSON。

**常见问题和解决**：
- **Markdown 包裹** — 脚本已自动处理 ` ```json ``` ` 包裹的情况
- **尾部逗号** — 重新运行即可，DeepSeek 每次响应不同
- **字段缺失** — 检查 `parse_metadata_response` 的验证日志

### 8.5 "互动话题数量不足（至少需要 2 个）"

**原因**：DeepSeek 生成的 `interaction_points` 不足 2 个。

**解决**：重新运行该章节的提取。添加更多 L1 内容或调整提示词可能改善结果。

### 8.6 HTTP 错误

| 状态码 | 原因                | 解决                              |
| ------ | ------------------- | --------------------------------- |
| 401    | API Key 无效        | 检查 `DEEPSEEK_API_KEY` 是否正确  |
| 429    | 请求频率过高        | 等待后重试（脚本已内置 2 秒间隔） |
| 500    | DeepSeek 服务端错误 | 等待后重试                        |
| 超时   | 响应超过 60 秒      | 重试，或检查网络连接              |

---

## 9. 与其他工作流的关联

### 9.1 完整亲子阅读内容上线流程

```
daodejing-chapter-analysis     extract_meta.py
(Skill: 生成章节 HTML)  ────→  (本 Skill: 提取元数据)
                                       │
                                       ▼
                              family-metadata-review
                              (Skill: 审核元数据)
                                       │
                                review_status → "approved"
                                       │
                                       ▼
                              warmup_cache.py
                              (Skill: 预热缓存)
                                       │
                                       ▼
                              部署到 Vercel/CF Pages
```

### 9.2 与 `family-metadata-review` Skill 的分工

| 环节       | 使用 Skill                                 | 工具                       |
| ---------- | ------------------------------------------ | -------------------------- |
| 生成元数据 | **family-metadata-extraction**（本 Skill） | `extract_meta.py`          |
| 审核元数据 | `family-metadata-review`                   | `admin/family-review.html` |
| AI 修订    | —（由审核控制台触发的自动流程）            | `reviser-service.js`       |
| 缓存预热   | `family-chat-cache-warmup`                 | `warmup_cache.py`          |

---

## 附录：快速命令参考

```bash
# 单章测试
python scripts/extract_meta.py --chapter 8
python scripts/extract_meta.py -c 8

# 批量模式（20 章核心章节）
python scripts/extract_meta.py --batch
python scripts/extract_meta.py -b

# 全量模式（81 章）
python scripts/extract_meta.py --all
python scripts/extract_meta.py -a

# 自定义章节
python scripts/extract_meta.py --chapters 3,7,9,11,12
python scripts/extract_meta.py -c 3,7,9,11,12

# 查看元数据统计
python -c "
import json
with open('data/family_metadata.json') as f:
    d = json.load(f)
ch = d.get('chapters', {})
print(f'总计: {len(ch)} | 已审核: {sum(1 for v in ch.values() if v.get(\"review_status\")==\"approved\")}')
"

# API Key 配置
export DEEPSEEK_API_KEY="sk-<your-api-key>"
```
