---
name: family-metadata-review
description: [project] 亲子共读元数据审核与质量保障系统。提供 Web 可视化审核控制台、CRUD API 端点、状态机审核流程、Article 11 亲子守护安全检查表。用于审核通过 DeepSeek API 自动生成的章节元数据（core_idea、safety_notes、interaction_points、parent_tips），确保所有内容适合 4-12 岁儿童及其家长。支持 pending→reviewing→approved/revision_needed 状态转换，带有软锁定机制和历史追溯。管理端通过 ADMIN_TOKEN 认证。
---

# 亲子元数据审核（Family Metadata Review）

审核和管理道德经亲子共读元数据的标准化工作流。

## 快速开始

1. **访问审核控制台** — 打开 `http://localhost:8080/admin/family-review.html`
2. **输入管理员 Token** — 使用 `.env` 中配置的 `ADMIN_TOKEN`（默认 `huihui-admin-local`）
3. **浏览章节列表** — 左侧面板支持按状态筛选和关键词搜索
4. **点击章节** — 查看完整元数据详情
5. **完成安全检查表** — 勾选 11 项 Article 11 检查项
6. **执行审核操作** — 通过/退回/需修改

## 系统架构

```
┌─────────────────────────────────────────────────┐
│  admin/family-review.html (审核控制台 SPA)        │
│  admin/family-review.css  admin/family-review.js │
└──────────────────┬──────────────────────────────┘
                   │ fetch /api/metadata/*
┌──────────────────▼──────────────────────────────┐
│  server.js (本地开发服务器)                        │
│  - GET /api/metadata/stats    统计摘要            │
│  - GET /api/metadata          列表/详情            │
│  - PUT /api/metadata          更新/状态转换        │
│  - DELETE /api/metadata?chapter=N  删除           │
└──────────────────┬──────────────────────────────┘
                   │ load/save
┌──────────────────▼──────────────────────────────┐
│  api/_shared/metadata-store.js (规范实现)          │
│  data/family_metadata.json (元数据存储)            │
└─────────────────────────────────────────────────┘
```

## 数据模型

### family_metadata.json 结构

```json
{
  "chapters": {
    "8": {
      "chapter": 8,
      "title": "上善若水",
      "core_idea": "...",
      "safety_notes": [...],
      "interaction_points": [...],
      "parent_tips": "...",
      "review_status": "pending|reviewing|approved|revision_needed",
      "reviewed_by": "审核者标识",
      "reviewed_at": "ISO8601 时间戳",
      "review_history": [
        {
          "action": "created|reviewing|approved|revision_needed|deleted|updated",
          "by": "操作者",
          "at": "ISO8601",
          "notes": "备注"
        }
      ]
    }
  },
  "_version": "1.1",
  "_updated": "YYYY-MM-DD"
}
```

## 审核状态机

```
    ┌──────────┐    开始审核    ┌───────────┐
    │  pending  │──────────────→│ reviewing  │
    └──────────┘               └─────┬──────┘
         ↑                          │
         │ 退回待审              ┌───┴────┐
         │                      │        │
         │                 审核通过  需要修改
         │                      │        │
         │                 ┌────▼──┐ ┌──▼──────────┐
         └─────────────────│approved│ │revision_needed│
           (仅当审核员一致)  └───────┘ └──────────────┘
```

- **pending**: 初始状态，AI 生成后自动进入
- **reviewing**: 审核员已开始审核（软锁定，记录 `reviewed_by`）
- **approved**: 内容通过审核，可用于生产
- **revision_needed**: 需要修改后重新审核

详细说明见 [review-workflow.md](review-workflow.md)。

## API 规范

### 端点列表

| 方法   | 路径                    | 认证   | 说明                                 |
| ------ | ----------------------- | ------ | ------------------------------------ |
| GET    | /api/metadata/stats     | 否     | 获取统计摘要                         |
| GET    | /api/metadata           | 否     | 列表（支持 ?status=&search=&limit=） |
| GET    | /api/metadata?chapter=N | 否     | 获取单章详情（含审核历史）           |
| PUT    | /api/metadata           | Bearer | 更新章节元数据或状态                 |
| DELETE | /api/metadata?chapter=N | Bearer | 删除章节                             |

详细参数和响应格式见 [api-spec.md](api-spec.md)。

## Article 11 亲子守护安全检查表

审核通过前必须逐项确认以下 11 项：

1. **无死亡/灾难/暴力相关内容** — 不含战争、死亡、灾难、暴力等可能引发儿童恐惧的表述
2. **无成人主题** — 不含性、暴力、政治敏感等不适宜儿童的内容
3. **无成瘾性设计** — 语言不诱导沉迷、不制造焦虑依赖
4. **语言难度匹配** — 表述符合 4-12 岁儿童的认知水平
5. **无负面引导** — 不鼓励攀比、撒谎、自私、攻击等行为
6. **无身体焦虑** — 不涉及身材/容貌评价或比较
7. **无道德绑架** — 不使用评判式、威吓式语言
8. **语气温暖** — 尊重儿童主体性，语气亲和、鼓励而非说教
9. **无道德误读风险** — 不将《道德经》概念（无为、返璞归真、不争等）与不守规则、不讲礼貌等不良行为相关联
10. **不对孩子行为做评判** — 对话模板中不对孩子行为做道德评判，保持客观描述
11. **正确的不良行为回应策略** — 当孩子描述犯错或不听话时，平常心回应情绪，不借机说教或美化

## 审核控制台使用指南

### 界面布局

- **顶部统计栏**: 实时显示各状态章节数量
- **左侧面板**: 章节列表，支持状态筛选和关键词搜索
- **右侧主区域**: 章节详情、安全检查表、操作按钮、审核历史时间线

### 键盘快捷键

| 按键 | 功能       |
| ---- | ---------- |
| j/↓  | 下一个章节 |
| k/↑  | 上一个章节 |

### 管理员认证

- Token 通过 `ADMIN_TOKEN` 环境变量配置
- 控制台首次使用时需手动输入 Token
- Token 保存在浏览器 sessionStorage 中，刷新页面需重新输入
- API 请求头：`Authorization: Bearer <token>`

## 集成组件

| 组件                        | 角色                                                              |
| --------------------------- | ----------------------------------------------------------------- |
| `scripts/extract_meta.py`   | 元数据提取（调用 DeepSeek API 生成）；支持 `--all` 全量 81 章模式 |
| `scripts/warmup_cache.py`   | 缓存预热（生成对话上下文）                                        |
| `api/family_chat`           | 亲子聊天 API                                                      |
| `validate.js`               | 内容校验                                                          |
| `data/family_metadata.json` | 元数据持久化存储                                                  |

## 参考文件

- [review-workflow.md](review-workflow.md) — 审核工作流详细说明
- [api-spec.md](api-spec.md) — API 端点规范
- `admin/family-review.html` — 审核控制台实现
- `api/_shared/metadata-store.js` — 元数据 CRUD 规范实现
- `server.js` — 本地服务器路由实现
- `docs/01-亲子时光/` — 安全分析参考（含第 38 章详细安全注意事项）
