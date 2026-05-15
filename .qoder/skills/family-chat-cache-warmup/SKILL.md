---
name: family-chat-cache-warmup
description: 亲子对话缓存预热工作流。读取 data/family_metadata.json 中所有已审核（review_status: approved）的章节，按章节 × 年龄段（3 个）× 轮次组合调用本地 /api/family_chat 端点，预生成并保存对话缓存到 data/family_chat_cache.json。支持自定义轮次数、端口、章节范围，可自动启动/停止本地服务器或使用已有服务器。当用户需要预热缓存、优化亲子时光首次响应速度、或在部署后预构建对话缓存时使用本 Skill。
---

# 亲子对话缓存预热

通过 `warmup_cache.py` 批量调用本地 API，为所有已审核章节预生成亲子对话缓存，消除首次对话的 DeepSeek API 调用延迟。

## 1. 架构

### 1.1 工作原理

```
data/family_metadata.json
        │
        │ 筛选 review_status: "approved"
        ▼
   已审核章节列表 (chapters)
        │
        ├── 第1章 ─┬─ age_4_6 ── round_1, round_2, round_3
        │          ├─ age_7_9 ── round_1, round_2, round_3
        │          └─ age_10_12 ─ round_1, round_2, round_3
        │
        ├── 第2章 ── ...
        │
        └── ...
        │
        ▼
   POST /api/family_chat (本地 server.js)
        │
        ▼
   data/family_chat_cache.json
```

### 1.2 缓存文件结构

```json
{
  "_version": "1.0",
  "_updated": "2026-05-14",
  "_generated_by": "warmup_cache.py",
  "entries": {
    "1": {
      "age_4_6": {
        "round_1": "小水滴说...",
        "round_2": "我们再想想...",
        "round_3": "水还有一个秘密..."
      },
      "age_7_9": { "...": "..." },
      "age_10_12": { "...": "..." }
    },
    "2": { "...": "..." }
  }
}
```

### 1.3 对话轮次模拟机制

预热脚本通过模拟孩子回答来推进多轮对话：

| 年龄段    | 模拟回答风格         | 示例                                                     |
| --------- | -------------------- | -------------------------------------------------------- |
| age_4_6   | 简单、感性、充满想象 | "嗯嗯！小水滴好有趣！"                                   |
| age_7_9   | 带有理解、联系生活   | "我觉得水很厉害，因为它很柔软但很有力量。"               |
| age_10_12 | 思辨、质疑、深度思考 | "老子说的'不争'和现代社会的竞争好像有矛盾，怎么理解呢？" |

每轮对话后，慧惠的回答作为 `role: "huihui"` 加入历史，模拟的孩子回答作为 `role: "user"` 加入历史，下一轮基于完整历史生成。

---

## 2. 前置条件

### 2.1 必需条件

- `data/family_metadata.json` 存在且至少包含一个 `review_status: "approved"` 的章节
- 本地 Node.js 开发服务器可启动（`server.js`），或已有服务器运行中
- `server.js` 能正常调用 DeepSeek API（`DEEPSEEK_API_KEY` 已配置）

### 2.2 可选条件

- 已安装 Python 3.6+（脚本为 Python 实现）

### 2.3 前置检查

```bash
# 1. 确认有已审核的章节
python -c "
import json
with open('data/family_metadata.json') as f:
    d = json.load(f)
approved = [k for k,v in d.get('chapters',{}).items() if v.get('review_status')=='approved']
print(f'已审核章节: {len(approved)} 个 — {sorted(map(int, approved))}')
"

# 2. 确认 server.js 可启动
node -c server.js  # 语法检查，无输出 = OK
```

---

## 3. 执行步骤

### 3.1 基础预热（推荐）

```bash
# 预热所有已审核章节，默认每章 3 轮对话
python scripts/warmup_cache.py
```

脚本会自动：
1. 加载 `data/family_metadata.json`，筛选 `approved` 章节
2. 查找可用端口（默认从 8080 开始）
3. 启动 `server.js`
4. 逐章调用 `/api/family_chat`，3 个年龄段 × 3 轮 = 每章 9 次 API 调用
5. 每章完成后立即保存缓存（防止中断丢失）
6. 完成后自动停止服务器

### 3.2 自定义预热轮次

```bash
# 只预热前 2 轮对话（减少 API 调用量）
python scripts/warmup_cache.py --rounds 2

# 只预热第 1 轮（快速模式）
python scripts/warmup_cache.py --rounds 1
```

### 3.3 指定章节范围

```bash
# 只预热特定章节
python scripts/warmup_cache.py --chapters 1,8,16,25

# 范围写法
python scripts/warmup_cache.py --chapters 3-9,11,14

# 组合其他参数
python scripts/warmup_cache.py --chapters 1-10 --rounds 2
```

注意：指定的章节必须在 `family_metadata.json` 中且 `review_status` 为 `approved`，否则会被跳过。

### 3.4 使用已有服务器

```bash
# 先手动启动服务器
node server.js &
# 或: node scripts/reviser-service.js &

# 预热时跳过启动/停止服务器
python scripts/warmup_cache.py --no-server --port 8080
```

### 3.5 指定服务器端口

```bash
# 使用 3000 端口
python scripts/warmup_cache.py --port 3000
```

---

## 4. 参数参考

| 参数          | 类型 | 默认值           | 说明                                  |
| ------------- | ---- | ---------------- | ------------------------------------- |
| `--rounds`    | int  | 3                | 预热的对话轮次数                      |
| `--port`      | int  | 0（自动查找）    | 本地服务器端口                        |
| `--no-server` | flag | false            | 不启动/停止服务器，使用已有实例       |
| `--chapters`  | str  | ""（全部已审核） | 指定章节范围，支持逗号分隔和 `-` 范围 |

---

## 5. 输出与验证

### 5.1 运行时日志

```
已审核章节: [1, 2, 3, 5, 7, 8, ...]
年龄组: ['age_4_6', 'age_7_9', 'age_10_12']
每章轮次: 3
预估 API 调用次数: 234

第1章 · 道可道
    年龄段: age_4_6
      第 1 轮... OK (generated)
      第 2 轮... OK (generated)
      第 3 轮... OK (generated)
    年龄段: age_7_9
      第 1 轮... OK (cached)     ← 若已有缓存则显示 cached
      ...
```

### 5.2 汇总报告

```
============================================================
汇总报告
============================================================
处理章节数: 78
年龄组数: 3
每章轮次: 3
总成功: 702
总失败: 0
输出文件: data/family_chat_cache.json
缓存文件大小: 456.3 KB
```

### 5.3 验证缓存有效性

```bash
# 检查缓存文件结构和条目数
python -c "
import json
with open('data/family_chat_cache.json') as f:
    c = json.load(f)
entries = c.get('entries', {})
total = sum(
    sum(1 for r in age.values() if r is not None)
    for ch in entries.values()
    for age in ch.values()
)
print(f'章节: {len(entries)}, 有效对话: {total}')
print(f'更新时间: {c.get(\"_updated\", \"unknown\")}')
"
```

---

## 6. 性能参考

| 指标          | 3 轮/章                 | 1 轮/章       |
| ------------- | ----------------------- | ------------- |
| 每章 API 调用 | 9 次（3 年龄段 × 3 轮） | 3 次          |
| 78 章 × 3 轮  | 702 次 API 调用         | —             |
| 预计耗时      | 15-20 分钟              | 5-8 分钟      |
| 缓存大小      | ~450 KB                 | ~150 KB       |
| 首次对话加速  | 0ms（纯缓存）           | 0ms（纯缓存） |

> 耗时受 DeepSeek API 响应速度和网络延迟影响。脚本在每章之间无额外延迟（与 `extract_meta.py` 不同），API 调用在轮次之间有 0.5 秒间隔。

---

## 7. 缓存机制

### 7.1 缓存命中逻辑

`api/family_chat.js` 中的缓存逻辑：

1. 接收请求时检查 `family_chat_cache.json`
2. 按 `chapter` + `age_group` + `round_num`（从 `conversation_history` 长度推断）查找
3. 命中 → 直接返回缓存内容，跳过 DeepSeek API 调用
4. 未命中 → 调用 DeepSeek API，**并将新生成的响应追加到缓存文件中**

### 7.2 缓存更新

- 预热脚本基于已审核章节生成
- 服务端在每次 API 调用后自动更新缓存文件
- 缓存没有 TTL，仅在预热脚本重新运行时更新

### 7.3 中断恢复

预热脚本每章完成后**立即保存**到文件，支持中断后从中断点继续：

```bash
# 预热到一半时中断 (Ctrl+C)
^C
# 重新运行，已缓存的章节会显示 (cached) 状态
python scripts/warmup_cache.py
```

---

## 8. 故障排除

### 8.1 "未找到已审核的章节"

**原因**：`family_metadata.json` 中没有 `review_status: "approved"` 的章节。

**解决**：
1. 运行 `python scripts/extract_meta.py --all` 生成元数据
2. 打开 `admin/family-review.html` 审核各章节
3. 将元数据的 `review_status` 改为 `"approved"`

### 8.2 API 调用失败

**症状**：`第 N 轮... FAIL` 或 `HTTP 500`

**原因**：server.js 中 DeepSeek API 配置问题或 API Key 无效

**排查**：
```bash
# 1. 确认 server.js 能正常启动
node server.js &
sleep 2

# 2. 手动测试 family_chat API
curl -X POST http://127.0.0.1:8080/api/family_chat \
  -H "Content-Type: application/json" \
  -d '{"chapter":1,"age_group":"age_4_6","conversation_history":[]}'

# 3. 检查环境变量
echo $DEEPSEEK_API_KEY | cut -c1-12
```

### 8.3 "服务器启动失败"

**原因**：Node.js 未安装、端口被占用、server.js 语法错误

**排查**：
```bash
# 检查 Node.js
node --version

# 检查语法
node -c server.js

# 检查端口占用（Windows）
netstat -ano | findstr :8080

# 使用其他端口
python scripts/warmup_cache.py --port 3000
```

### 8.4 某章节预热失败导致后续轮次中断

脚本设计为：某章节某年龄段的某轮次失败后，该章节后续轮次无法继续（因依赖前一轮历史），但**不中断**整个预热流程。下一章节会继续处理。

---

## 9. 典型工作流

### 9.1 新章节审核后预热

```bash
# 1. 生成/更新元数据
python scripts/extract_meta.py --chapter 53

# 2. 审核通过后，预热新章节的缓存
python scripts/warmup_cache.py --chapters 53 --rounds 3

# 3. 验证缓存
python -c "
import json
with open('data/family_chat_cache.json') as f:
    c = json.load(f)
print('第53章缓存:', '53' in c.get('entries', {}))
"
```

### 9.2 部署后全量预热

```bash
# 1. 确认已审核章节数量
python -c "
import json
with open('data/family_metadata.json') as f:
    d = json.load(f)
approved = sum(1 for v in d.get('chapters',{}).values() if v.get('review_status')=='approved')
print(f'已审核: {approved} 章')
"

# 2. 后台运行预热（注意：这会占用 API 额度）
python scripts/warmup_cache.py --rounds 3

# 3. 部署时将缓存文件一起部署
vercel --prod --yes --token <TOKEN>
```

### 9.3 轻量级预热（最少 API 调用）

```bash
# 仅第 1 轮，快速覆盖所有已审核章节
python scripts/warmup_cache.py --rounds 1
```

---

## 附录：快速命令参考

```bash
# 标准全量预热
python scripts/warmup_cache.py

# 轻量预热
python scripts/warmup_cache.py --rounds 1

# 指定章节
python scripts/warmup_cache.py --chapters 1,8,16,25

# 使用已有服务器
python scripts/warmup_cache.py --no-server --port 8080

# 验证缓存状态
python -c "
import json
with open('data/family_chat_cache.json') as f:
    c = json.load(f)
print(f'章节: {len(c.get(\"entries\",{}))}, 更新: {c.get(\"_updated\")}')
"
```
