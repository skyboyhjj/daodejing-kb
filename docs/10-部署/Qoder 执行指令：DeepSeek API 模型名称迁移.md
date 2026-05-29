# Qoder 执行指令：DeepSeek API 模型名称迁移

**任务编号**：DEEPSEEK-V4-MIGRATE-01  
**任务名称**：将 DeepSeek API 模型从已弃用 `deepseek-chat` 迁移至 `deepseek-v4-flash`  
**优先级**：P0（紧急）  
**预估工时**：0.5天  
**依赖**：无

---

## 一、任务背景

根据 DeepSeek 官方公告，当前使用的 `deepseek-chat` 和 `deepseek-reasoner` 模型将于 **2026年7月24日** 正式停用并无法访问。需在截止日期前完成模型名称迁移。

## 二、任务目标

将项目中所有调用 DeepSeek API 的 `model` 参数从 `deepseek-chat` 替换为 `deepseek-v4-flash`。**V4 系列完全兼容 OpenAI ChatCompletions 接口格式，现有代码逻辑无需修改。**

## 三、操作文件

| 文件 | 操作 | 说明 |
|:---|:---|:---|
| `functions/api/chat.js` | **修改** | 将 `model: 'deepseek-chat'` 改为 `model: 'deepseek-v4-flash'` |
| `functions/api/family_chat.js` | **修改** | 同上 |
| `server.js`（如存在本地开发服务器） | **修改** | 同上 |

**其他文件不变。**

## 四、补充说明

如果 `api/chat.js` 或 `api/family_chat.js` 中使用了环境变量来指定模型名称（例如 `env.DEEPSEEK_MODEL`），则需要额外处理：在 Cloudflare Pages Dashboard → Settings → Environment variables 中，将 `DEEPSEEK_MODEL` 的值从 `deepseek-chat` 更新为 `deepseek-v4-flash`，代码本身无需修改。

## 五、验收标准

- [ ] 慧惠主聊天功能正常工作
- [ ] 亲子共读对话功能正常工作
- [ ] API 调用返回正常，无模型不存在或 404 错误

## 六、注意事项

- 旧模型将于 **2026年7月24日 UTC 15:59** 停用，此为硬性截止时间
- V4 系列 API 完全兼容 OpenAI ChatCompletions 接口，现有代码逻辑无需修改
- 新模型 `deepseek-v4-flash` 价格更低、性能更强

## 七、《最高宪法》自查

| 宪法条款 | 是否通过 | 说明 |
|:---|:---|:---|
| 第五条·减法优先 | ✅ | 仅修改模型名称字符串，不做其他变更 |
| 第十条·外挂增强 | ✅ | 不修改任何核心业务逻辑 |

---

*请执行。*