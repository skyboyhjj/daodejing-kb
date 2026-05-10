# GenericAgent (GA) Session 管理机制技术报告

> **分析日期**：2026-05-07  
> **分析对象**：`agent_loop.py`、`agentmain.py`、`llmcore.py`  
> **项目地址**：https://github.com/lsdefine/GenericAgent  
> **适用范围**：作为《GA技术调查报告》的补充章节，深入分析GA的会话生命周期管理机制  

---

## 一、总体架构概述

GA 的 Session 管理并未采用一个集中的“会话管理器”，而是通过**三层协同机制**来实现：

| 层级 | 文件 | 职责 | 核心机制 |
|:---|:---|:---|:---|
| **底层** | `llmcore.py` | LLM 交互与对话历史存储 | `history` 列表维护、`trim_messages_history` 上下文裁剪 |
| **中间层** | `agent_loop.py` | 感知-思考-行动主循环 | “胖客户端，瘦循环”：每轮只传增量，完整历史由底层维护 |
| **顶层** | `agentmain.py` | 任务调度与会话编排 | 任务队列、工作记忆跨任务传递、`/resume` 会话恢复 |

这三层从内到外，共同保证 GA 在长程任务中既能利用全部历史，又不会因上下文膨胀而崩溃。

---

## 二、`llmcore.py`：底层会话记忆

### 2.1 对话历史的存储方式

`llmcore.py` 是 GA 与 LLM 交互的底层封装。对话历史的核心存储在 **Session 类** 的内部属性中：

```python
self.history = []  # 对话历史列表
```

每条历史消息遵循标准的 LLM 对话格式，支持 `role`（system/user/assistant）和 `content`（文本或多模态块）。

### 2.2 上下文窗口管理

GA 的上下文管理非常独特——它并不依赖 LLM 原生的上下文窗口（如 128K），而是通过主动裁剪来实现**信息密度最大化**：

```python
def trim_messages_history(history, context_win):
    compress_history_tags(history)
    cost = sum(len(json.dumps(m, ensure_ascii=False)) for m in history)
    if cost > context_win * 3:
        compress_history_tags(history, keep_recent=4, force=True)
        target = context_win * 3 * 0.6
        while len(history) > 5 and cost > target:
            history.pop(0)
            while history and history[0].get('role') != 'user':
                history.pop(0)
```

**核心策略**：

| 策略 | 触发条件 | 行为 |
|:---|:---|:---|
| **主动压缩** | 每 5 轮调用自动触发 | 压缩旧消息中的 `<thinking>`、`<tool_use>`、`<tool_result>` 等标签内容，保留最近 10 轮完整信息 |
| **强制裁剪** | 上下文超过 `context_win * 3` | 仅保留最近 4 轮对话，再逐条移除最旧消息，直至降至目标阈值（`context_win * 3 * 0.6`） |
| **角色保持** | 裁剪后 | 确保历史中第一条消息来自 `user` 角色，保证对话格式正确 |

### 2.3 多客户端支持与历史传递

GA 支持同时配置多个 LLM 后端（Claude、GPT、Kimi 等），并通过 `MixinSession` 实现故障转移。切换 LLM 时，对话历史会被显式传递：

```python
# agentmain.py: next_llm()
self.llmclient.backend.history = lastc.backend.history
```

这确保了即使切换到备用 LLM，对话的连续性不会中断。

---

## 三、`agent_loop.py`：中间层会话调度

### 3.1 核心循环结构

`agent_loop.py` 实现了 GA 的“感知-思考-行动”主循环，核心逻辑约 76 行：

```python
def agent_runner_loop(client, system_prompt, user_input, handler,
                       tools_schema, max_turns=40, ...):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]
    turn = 0
    while turn < handler.max_turns:
        turn += 1
        response_gen = client.chat(messages=messages, tools=tools_schema)
        response = yield from response_gen

        if not response.tool_calls:
            tool_calls = [{'tool_name': 'no_tool', 'args': {}}]
        else:
            tool_calls = [{'tool_name': tc.function.name, 'args': ...}]

        for tc in tool_calls:
            outcome = handler.dispatch(tc['tool_name'], tc['args'], ...)
            tool_results.append({'tool_use_id': tc['id'], 'content': ...})

        # 关键：每轮只传递本轮的新结果
        messages = [{"role": "user", "content": next_prompt, "tool_results": tool_results}]
```

**关键设计决策**：

- **“胖客户端，瘦循环”**：`agent_loop.py` 不维护完整的对话历史。每轮循环只向 LLM 发送**本轮的结果**作为新消息。完整的对话历史由 `client`（即 `llmcore` 的 Session 对象）在内部维护，并通过 `chat()` 方法自动拼接。
- **工具执行在循环内**：每一轮的 `tool_calls` 解析、分发、执行和结果收集全部在 `while` 循环内完成。

### 3.2 每 10 轮重置的工具描述

```python
if turn % 10 == 0:
    client.last_tools = ''  # 每10轮重置一次工具描述
```

这是一个精妙的优化：定期清空工具描述缓存，避免因上下文过大导致的模型性能下降。

### 3.3 退出条件

| 退出条件 | 触发方式 |
|:---|:---|
| **主动退出** | 工具返回 `StepOutcome.should_exit == True` |
| **任务完成** | 工具返回 `StepOutcome.next_prompt == None` |
| **超过轮次** | `turn >= max_turns`，返回 `MAX_TURNS_EXCEEDED` |

---

## 四、`agentmain.py`：顶层会话编排

### 4.1 任务队列与会话隔离

`agentmain.py` 通过 `GeneraticAgent` 类实现任务调度。每个 `GeneraticAgent` 实例拥有独立的：

```python
self.history = []       # 用户交互的摘要历史
self.handler = None     # 当前任务的处理器
self.task_queue = queue.Queue()  # 待处理任务队列
self.llmclient          # 当前 LLM 客户端
```

关键点在于，**LLM 的完整对话历史存储在 `self.llmclient.backend.history` 中，而非 GA 自身**。注释中明确指出：

```python
# although new handler, the **full** history is in llmclient, so it is full history!
```

### 4.2 跨任务的工作记忆传递

GA 支持跨任务的“工作记忆”传递，通过 `handler.working` 字典实现：

```python
if self.handler and 'key_info' in self.handler.working:
    ki = re.sub(r'\n\[SYSTEM\] 此为.*?工作记忆[。\n]*', '',
                self.handler.working['key_info'])
    handler.working['key_info'] = ki
    handler.working['passed_sessions'] = ps = \
        self.handler.working.get('passed_sessions', 0) + 1
    if ps > 0:
        handler.working['key_info'] += \
            f'\n[SYSTEM] 此为 {ps} 个对话前设置的key_info，若已在新任务，先更新或清除工作记忆。\n'
```

**工作流程**：
- 每个任务完成后，`key_info` 被保留在 `handler.working` 中
- 新任务开始时，前一个 `handler` 的 `key_info` 被传递给新的 `handler`
- 如果工作记忆经过多个会话传递，系统会追加提醒信息

### 4.3 运行时参数调整：`/session.xxx` 命令

GA 支持通过 `/session.xxx=value` 命令在运行时动态调整 Session 参数：

```python
if _sm := re.match(r'/session\.(\w+)=(.*)', raw_query.strip()):
    k, v = _sm.group(1), _sm.group(2)
    setattr(self.llmclient.backend, k, v)
```

这是 GA 的“万能接口”——通过动态设置 `self.llmclient.backend` 的属性，可以在不重启的情况下调整温度、思考预算等参数。

### 4.4 会话恢复：`/resume` 命令

`/resume` 并非硬编码的命令，而是一个**LLM 驱动的会话检索任务**。GA 会把一个复杂的提示词注入消息队列，让 LLM 自动完成以下步骤：

```python
if raw_query.strip() == '/resume':
    return r'帮我看看最近有哪些会话可以恢复。读model_responses/目录，按修改时间取最近10个文件，从每个文件里找最后一个<history>...</history>块，用一句话总结每个会话在聊什么，列表给我选。注意读文件后要把字面的\n替换成真换行才能正确匹配。'
```

**`/resume` 机制的核心特征**：

| 特征 | 说明 |
|:---|:---|
| **LLM 担任“会话管理员”** | 检索、总结、选择全部由 LLM 自主完成 |
| **进程级隔离** | 每个 GA 进程有独立的 `model_responses_{pid}.txt`，互不干扰 |
| **非结构化恢复** | 不依赖任何数据库或索引，直接读取原始日志文件 |

### 4.5 三种运行模式对应的会话生命周期

`agentmain.py` 支持三种运行模式，每种模式的会话生命周期不同：

| 模式 | 使用方式 | 会话生命周期 | 适用场景 |
|:---|:---|:---|:---|
| **交互模式** | `python agentmain.py` | 进程级别，启动后一直运行直到退出 | 日常对话 |
| **任务模式** | `python agentmain.py --task {id} --input "..."` | 单任务级别，任务完成后等待下一个任务 | 批量处理 |
| **反射模式** | `python agentmain.py --reflect script.py` | 持续监控，外部脚本触发任务 | 自动化运维 |

---

## 五、断网恢复场景推演

**场景设定**：
1. 用户正在与 A 模型聊天，此时断网
2. 联网后，用户启用备用 B 模型
3. 用户要求恢复之前的聊天

**推演过程**：

| 步骤 | 系统状态 | 关键机制 |
|:---|:---|:---|
| **断网前** | A 模型的对话历史存储在 `self.llmclient.backend.history` | 历史完全在 LLM 客户端内部，不依赖网络状态 |
| **断网期间** | GA 进程仍在运行，`history` 仍在内存中 | 进程未崩溃，历史未丢失 |
| **联网后切换** | 用户切换到 B 模型，`next_llm()` 执行 `self.llmclient.backend.history = lastc.backend.history` | B 模型继承了 A 模型的全部对话历史 |
| **继续对话** | 用户直接输入新消息，B 模型基于完整历史回答 | 无需 `/resume`，历史已无缝传递 |
| **进程崩溃后恢复** | 若进程崩溃，`model_responses_{pid}.txt` 文件残留 | 重启后使用 `/resume`，LLM 自动检索并总结可恢复的会话 |

---

## 六、核心设计原则总结

GA 的 Session 管理遵循以下核心原则：

1.  **“胖客户端，瘦循环”**：完整的对话历史存储在 LLM 客户端内部，Agent Loop 只传递增量更新。每轮循环的 `messages` 仅包含本轮的新结果，而 LLM 客户端自动将其拼接到已有的 `history` 中。

2.  **“主动控制优于被动填充”**：GA 不依赖 LLM 的原生上下文窗口，而是通过 `trim_messages_history` 主动裁剪历史，确保信息密度最大化。

3.  **“跨任务记忆独立维护”**：工作记忆（`key_info`）通过 `handler.working` 在任务间传递，而 LLM 的对话历史随 LLM 客户端的实例存储，两者互不干扰。

4.  **“故障转移时的历史传递”**：切换到备用 LLM 时，历史被显式传递，确保对话连续性。

5.  **“LLM 担任会话管理员”**：`/resume` 命令让 LLM 成为会话恢复的执行者，无需额外的索引或数据库。

---

## 七、对慧惠设计的启示

GA 的 Session 管理机制为慧惠提供了以下可直接借鉴或增强的方向：

| GA 机制 | 对慧惠的启示 |
|:---|:---|
| **“胖客户端，瘦循环”** | 慧惠的 AgentLoop 可借鉴此模式，将完整历史存储在 LLM 后端，循环只传递增量，降低内存负担 |
| **主动上下文裁剪** | 与我们设计的“归根审计”在哲学上高度一致——都是在后台静默维护信息密度 |
| **每 10 轮重置工具描述** | 慧惠的五层记忆系统可引入类似的定期维护逻辑 |
| **`/resume` 会话恢复** | 慧惠可通过 `/resume` 指令，让 LLM 自主检索 `model_responses_*.txt` 文件来恢复会话，无需额外开发会话管理模块 |
| **跨 LLM 无缝切换** | 慧惠当前使用单一 DeepSeek 后端，未来如需多后端支持，可直接沿用 GA 的 `MixinSession` 和历史传递机制 |

---

## 附录：关键术语速查

| 术语 | 定义 | 所在文件 |
|:---|:---|:---|
| `Session.history` | LLM 客户端内部存储的完整对话历史 | `llmcore.py` |
| `trim_messages_history` | 主动裁剪上下文，确保信息密度最大化 | `llmcore.py` |
| `agent_runner_loop` | GA 的感知-思考-行动主循环 | `agent_loop.py` |
| `GeneraticAgent` | GA 的顶层任务调度器 | `agentmain.py` |
| `handler.working` | 跨任务的工作记忆传递 | `agentmain.py` |
| `/session.xxx` | 运行时动态调整 Session 参数 | `agentmain.py` |
| `/resume` | LLM 驱动的会话检索与恢复 | `agentmain.py` |
| `MixinSession` | 多 LLM 后端的故障转移管理 | `llmcore.py` |
| `model_responses_{pid}.txt` | 进程级会话日志文件 | `llmcore.py` |

---

> **报告结束。** 本报告可作为《GA技术调查报告》的附录B：Session管理机制。如需合并至主报告，建议放在“核心架构：四大组件”之后，作为第五组件“会话管理”的详细展开。