---
name: ai-intent-router
description: AI 对话意图路由 — 前缀注入模式。当用户需要在单个 AI Chat API 端点下实现多种意图识别和行为切换（如普通对话/特殊流程/反馈收集），而不引入额外的 NLU 模型或 LLM 首次判断开销时使用本 Skill。适用于基于 System Prompt 控制的 DeepSeek/OpenAI 等 LLM API。
---

# AI 对话意图路由 — 前缀注入模式

> **源码参考**：`js/huihui-chat.js`（前端）、`api/_shared/system-prompt.js`（后端）  
> **已验证场景**：`[MIRROR:EVENT]` 镜鉴、`[MIRROR:EVENING]` 晚间回顾、`[FEEDBACK]` 反馈邮件  
> **宪法依据**：第五条（减法优先）—— 单端点多行为，不新建 API。

---

## 1. 前置条件（强制性）

**必须在执行前了解以下内容：**

1. 目标 LLM API 的消息格式（System Prompt + User Messages 数组）
2. 前端聊天组件的消息发送流程（如何构建 `messages` 数组）
3. 目标项目的目录结构（前端 JS 文件位置 + 后端 API 端点位置）

**技术依赖**：
- 已有可用的 LLM API 端点（如 `/api/chat` → DeepSeek）
- 前端聊天组件使用 `fetch` POST `messages` 数组
- 后端 System Prompt 支持条件分支（`if msg starts with [PREFIX]`）

---

## 2. 模式定义

### 2.1 核心思想

在 **不增加 API 端点、不引入 NLU 模型、不增加 LLM 首次调用** 的前提下，通过前端注入语义前缀 + 后端 System Prompt 匹配的方式，实现单个 `/api/chat` 端点下的多种 AI 行为切换。

### 2.2 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                         前端 (huihui-chat.js)                      │
│                                                                    │
│  detectIntent(msg) ──→ handleMirrorIntent(intent, msg)             │
│       │                        │                                   │
│       │  识别用户意图             │  注入语义前缀                    │
│       ▼                        ▼                                   │
│  "做个镜鉴" ──────────→ "[MIRROR:EVENT] 做个镜鉴"                  │
│  "晚间回顾" ──────────→ "[MIRROR:EVENING] 晚间回顾"                │
│                                                                    │
└────────────────────────────────────┬───────────────────────────────┘
                                     │
                                     │  POST /api/chat
                                     │  { messages: [...], level: "L2" }
                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      后端 (api/chat.js)                            │
│                                                                    │
│  messages: [                                                       │
│    { role: 'system', content: buildSystemPrompt(level) },          │
│    { role: 'user', content: '[MIRROR:EVENT] 做个镜鉴' },           │
│    ...                                                             │
│  ]                                                                 │
│                                                                    │
│  System Prompt 中：                                                │
│    "当用户消息以 [MIRROR:EVENT] 开头时 → 启动镜鉴流程"              │
│    "当用户消息以 [MIRROR:EVENING] 开头时 → 启动晚间回顾"            │
│                                                                    │
└────────────────────────────────────┬───────────────────────────────┘
                                     │
                                     │  DeepSeek API
                                     ▼
                             AI 按匹配到的流程回复
```

### 2.3 关键优势

| 特性 | 说明 |
|:---|:---|
| **零额外延迟** | 无 NLU 判断、无二次 LLM 调用。前缀匹配在 System Prompt 的纯文本规则中完成 |
| **零额外端点** | 所有行为共用同一个 `/api/chat` endpoint，减少部署和维护成本 |
| **前端可控** | 意图判断逻辑在前端，可以随时调整触发条件而不改后端 |
| **AI 原生流式** | 前缀作为普通文本嵌入 `content` 字段，不影响流式输出（SSE） |
| **易于扩展** | 新增意图只需：前端增加 `[PREFIX]` → 后端 System Prompt 增加匹配规则 |

---

## 3. 实现规范

### 3.1 前端：意图检测函数

```javascript
/**
 * 检测用户消息中的意图类型
 * @param {string} userMessage - 用户输入的原始消息
 * @returns {string|null} - 意图类型标识符，无匹配返回 null
 */
function detectMirrorIntent(userMessage) {
    var msg = userMessage.trim();

    // 精确匹配：事件镜鉴
    if (msg === '做个镜鉴') {
        return 'event';
    }
    // 精确匹配：晚间回顾
    if (msg === '晚间回顾') {
        return 'evening';
    }
    return null;
}
```

**设计要点**：
- 使用 **精确匹配**（`===`），避免误触发（如用户说"我们做个镜鉴好不好"不应触发）
- 返回 **短标识符**（`'event'` / `'evening'`），而非直接返回前缀字符串，便于后续统一处理
- 各意图独立 `if` 判断，互不干扰，易于增删

### 3.2 前端：前缀注入函数

```javascript
/**
 * 根据意图类型生成带前缀的消息
 * @param {string} intentType - detectMirrorIntent 的返回值
 * @param {string} userMessage - 用户输入的原始消息
 * @returns {string} - 带前缀的完整消息
 */
function handleMirrorIntent(intentType, userMessage) {
    var prefix = '';
    switch (intentType) {
        case 'event':
            prefix = '[MIRROR:EVENT] ';
            break;
        case 'evening':
            prefix = '[MIRROR:EVENING] ';
            break;
    }
    return prefix + userMessage;
}
```

**设计要点**：
- 前缀格式：`[NAMESPACE:ACTION] `（全大写、冒号分隔、末尾空格）
- `switch` 语句确保新增意图时显式处理，避免遗漏
- 前缀与原始消息用空格连接，保持可读性

### 3.3 前端：集成到发送流程

```javascript
// 在 sendMessage() 中，构建 messages 数组时：
var mirrorIntent = detectMirrorIntent(text);

// 构建 API 请求
fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        messages: (function () {
            var msgs = getMessages();
            if (mirrorIntent) {
                // 找到最后一条用户消息，注入前缀
                for (var k = msgs.length - 1; k >= 0; k--) {
                    if (msgs[k].role === 'user') {
                        msgs[k].content = handleMirrorIntent(
                            mirrorIntent,
                            msgs[k].content
                        );
                        break;
                    }
                }
            }
            return msgs;
        })(),
        level: getSavedLevel()
    })
});
```

**关键细节**：
- 前缀注入发生在消息**已添加到 UI** 之后——用户看到的仍是原始输入（"做个镜鉴"）
- 使用 IIFE 构建 messages 数组，确保注入逻辑封装在请求构造阶段
- 从数组末尾向前搜索最后一条用户消息，避免影响历史消息

### 3.4 后端：System Prompt 匹配

```javascript
// 在 buildSystemPrompt(level) 中：
var SYSTEM_PROMPT = '...' +
    '\n\n' +
    '当用户消息以 [MIRROR:EVENT] 开头时，启动事件镜鉴流程：\n' +
    '1. 引导用户先描述发生了什么\n' +
    '...\n' +
    '\n' +
    '当用户消息以 [MIRROR:EVENING] 开头时，启动晚间回顾流程：\n' +
    '1. 统计今日镜鉴事件数量\n' +
    '...';
```

**设计要点**：
- 匹配逻辑**完全由 LLM 在 System Prompt 约束下自动完成**，无需代码层面的字符串匹配
- 每个意图的指令**完整自包含**，LLM 不需要跨意图推理
- 使用自然语言描述（"当用户消息以...开头时"），不做正则或 parser

### 3.5 前缀命名规范

| 约定 | 说明 | 示例 |
|:---|:---|:---|
| 格式 | `[NAMESPACE:ACTION]` | `[MIRROR:EVENT]` |
| 大小写 | 全大写 | `[FEEDBACK]` |
| NAMESPACE | 功能模块名（3-10 字符） | `MIRROR`、`SKILLUP` |
| ACTION | 具体行为（3-15 字符） | `EVENT`、`EVENING` |
| 后缀空格 | 必须有，分隔前缀与消息正文 | `'[MIRROR:EVENT] '` |
| 唯一性 | 每个前缀在整个项目中唯一 | 不与 `[FEEDBACK]`、`[MIRROR:EVENT]` 重复 |

---

## 4. 已验证的实现案例

### 4.1 案例 A：每日镜鉴（事件镜鉴）

| 组件 | 详情 |
|:---|:---|
| **前缀** | `[MIRROR:EVENT]` |
| **触发词** | `做个镜鉴`（精确匹配） |
| **前端文件** | `js/huihui-chat.js` — `detectMirrorIntent()` / `handleMirrorIntent()` |
| **后端文件** | `api/_shared/system-prompt.js` — `buildSystemPrompt()` |
| **API 端点** | `api/chat.js` — DeepSeek 代理 |
| **System Prompt 行** | "当用户消息以 [MIRROR:EVENT] 开头时，启动事件镜鉴流程" |
| **AI 行为** | 引导描述事件 → 逐一评分四维 → 生成四层镜鉴反馈 |

### 4.2 案例 B：每日镜鉴（晚间回顾）

| 组件 | 详情 |
|:---|:---|
| **前缀** | `[MIRROR:EVENING]` |
| **触发词** | `晚间回顾`（精确匹配） |
| **AI 行为** | 第一轮：统计事件数 + 提问 → 等待 → 第二轮：生成小结 |

### 4.3 案例 C：用户反馈邮件

| 组件 | 详情 |
|:---|:---|
| **前缀** | `[FEEDBACK]` |
| **触发方式** | 用户点击反馈入口 → 前端预填 `[FEEDBACK] ` |
| **后端处理** | `api/chat.js` 第 63 行：`content.indexOf('[FEEDBACK]') === 0` → `sendFeedbackEmail()` |
| **AI 行为** | 无特殊行为（AI 正常回复，邮件异步发送） |

---

## 5. 使用示例

### 5.1 新增一个意图（以"晨间定志"为例）

**步骤 1：前端 — 添加关键词检测**

```javascript
function detectMirrorIntent(userMessage) {
    var msg = userMessage.trim();
    if (msg === '做个镜鉴')      return 'event';
    if (msg === '晚间回顾')      return 'evening';
    if (msg === '晨间定志')      return 'morning';  // ← 新增
    return null;
}
```

**步骤 2：前端 — 添加前缀映射**

```javascript
function handleMirrorIntent(intentType, userMessage) {
    var prefix = '';
    switch (intentType) {
        case 'event':   prefix = '[MIRROR:EVENT] ';   break;
        case 'evening': prefix = '[MIRROR:EVENING] '; break;
        case 'morning': prefix = '[MIRROR:MORNING] '; break;  // ← 新增
    }
    return prefix + userMessage;
}
```

**步骤 3：后端 — System Prompt 添加匹配规则**

```javascript
'当用户消息以 [MIRROR:MORNING] 开头时，启动晨间定志流程：\n' +
'1. 引导用户从四个维度中选择今日重点\n' +
'2. 生成今日心法（一句话的提醒）\n'
```

**完成**：无需新增 API、无需改数据库、无需调整前端其他逻辑。

### 5.2 调试技巧

```bash
# 直接通过 curl 测试前缀注入效果（绕过前端）
curl -X POST https://huihui-skill.org/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {"role": "user", "content": "[MIRROR:MORNING] 晨间定志"}
    ],
    "level": "L2"
  }'
```

---

## 6. 与其他方案的对比

| 方案 | 延迟 | 复杂度 | 准确性 | 适用场景 |
|:---|:---|:---|:---|:---|
| **前缀注入（本方案）** | 0ms | 低 | 100%（精确匹配） | 明确关键词触发的流程化交互 |
| 首次 LLM 判断 | +1 次 API 调用 | 低 | 90-95% | 模糊意图的场景 |
| NLU 模型（如 Rasa） | 0ms | 高 | 85-98% | 复杂多意图、需实体提取 |
| 多 endpoint | 0ms | 中 | 100% | 后端架构允许独立路由 |

---

## 7. 注意事项

1. **前缀不可见原则**：前缀仅存在于 API 请求的 `messages` 数组中。UI 展示的消息和对话历史（`getMessages()` 返回前）不应包含前缀。
2. **精确匹配优先**：前端检测建议使用精确匹配（`===`），避免子串匹配导致的误触发。
3. **System Prompt 指令完整**：每个意图的行为指令必须自包含。LLM 在看到 `[PREFIX]` 后应知道完整的交互流程，不应依赖其他意图的上下文。
4. **不适用于开放式意图**：本模式适合"用户明确知道自己要什么"的场景（点击按钮、输入关键词）。不适合"AI 猜测用户意图"的场景（如情感分析、自动识别事件）。

---

## 8. 验收标准

- [ ] 发送关键词后，前端注入正确前缀，API 请求中 `content` 以 `[PREFIX]` 开头
- [ ] 后端 System Prompt 识别前缀并启动对应流程
- [ ] UI 中显示的消息不含前缀（用户看到的是原始输入）
- [ ] 新增一个意图仅需修改 3 处（前端检测 + 前端映射 + System Prompt），< 10 行代码
- [ ] 误触发率为 0（精确匹配保证）

---

## 9. 相关代码文件引用

| 文件 | 行号/函数 | 作用 |
|:---|:---|:---|
| `js/huihui-chat.js` | `detectMirrorIntent()` (L278-289) | 前端意图检测 |
| `js/huihui-chat.js` | `handleMirrorIntent()` (L291-302) | 前缀注入 |
| `js/huihui-chat.js` | `sendMessage()` (L348-378) | 集成到发送流程 |
| `api/_shared/system-prompt.js` | `buildSystemPrompt()` (L48-95) | System Prompt 匹配规则 |
| `api/chat.js` | `handler()` (L63-69) | `[FEEDBACK]` 检测与邮件发送 |

---

*Skill 规格结束。本模式已在 daodejing-kb 项目中三次验证（镜鉴事件/晚间回顾/反馈邮件），可直接复用于任何基于 System Prompt 的 LLM API 意图路由场景。*
