# API 端点规范

## 基础信息

- **Base URL**: `http://localhost:8080`
- **Content-Type**: `application/json`
- **认证方式**: Bearer Token（`Authorization: Bearer <ADMIN_TOKEN>`）

---

## GET /api/metadata/stats

获取元数据统计摘要。

### 响应示例

```json
{
  "total": 23,
  "approved": 3,
  "pending": 20,
  "reviewing": 0,
  "revision_needed": 0,
  "by_reviewer": {
    "产品经理": 3
  },
  "_updated": "2026-05-12",
  "_version": "1.1"
}
```

---

## GET /api/metadata

获取章节列表，支持筛选、搜索和分页。

### 查询参数

| 参数    | 类型   | 必填 | 说明                                                             |
| ------- | ------ | ---- | ---------------------------------------------------------------- |
| status  | string | 否   | 按审核状态筛选：pending / reviewing / approved / revision_needed |
| search  | string | 否   | 在 title 和 core_idea 中模糊搜索                                 |
| limit   | int    | 否   | 返回条目数上限（默认 50）                                        |
| chapter | int    | 否   | 获取单章详情（同时返回 review_history）                          |

### 列表响应示例（?status=pending&limit=3）

```json
{
  "total": 20,
  "chapters": [
    {
      "chapter": 3,
      "title": "不尚贤",
      "core_idea": "...",
      "review_status": "pending",
      "reviewed_by": "",
      "reviewed_at": "",
      "safety_notes_count": 3,
      "interaction_points_count": 3
    }
  ]
}
```

### 详情响应示例（?chapter=8）

```json
{
  "chapter": 8,
  "title": "上善若水",
  "core_idea": "...",
  "safety_notes": [...],
  "interaction_points": [...],
  "parent_tips": "...",
  "review_status": "approved",
  "reviewed_by": "产品经理",
  "reviewed_at": "2026-05-11",
  "review_history": [
    {
      "action": "created",
      "by": "extract_meta.py",
      "at": "2026-05-11T00:00:00Z",
      "notes": "AI generated"
    },
    {
      "action": "approved",
      "by": "产品经理",
      "at": "2026-05-11T00:00:00Z",
      "notes": "Initial review"
    }
  ]
}
```

---

## PUT /api/metadata

更新章节元数据或审核状态。**需要 Bearer Token 认证。**

### 请求体

```json
{
  "chapter": 3,
  "updates": {
    "review_status": "reviewing",
    "notes": "开始逐项检查"
  }
}
```

### 字段说明

| 字段                  | 类型   | 说明                                 |
| --------------------- | ------ | ------------------------------------ |
| chapter               | int    | 章节编号（必填）                     |
| updates.review_status | string | 目标审核状态（需符合状态机转换规则） |
| updates.notes         | string | 审核备注（写入 review_history）      |

### 状态转换规则

| 当前状态        | 允许的目标状态                       |
| --------------- | ------------------------------------ |
| pending         | reviewing                            |
| reviewing       | approved / revision_needed / pending |
| approved        | revision_needed                      |
| revision_needed | reviewing                            |

### 成功响应

```json
{
  "ok": true,
  "chapter": {
    "chapter": 3,
    "title": "不尚贤",
    "review_status": "reviewing",
    "reviewed_by": "admin",
    "reviewed_at": "2026-05-12",
    "review_history": [...]
  }
}
```

### 错误响应

```json
{
  "error": "不允许的状态转换: pending → approved"
}
```

```json
{
  "error": "未授权，请提供有效的 ADMIN_TOKEN"
}
```

---

## DELETE /api/metadata?chapter=N

删除指定章节。**需要 Bearer Token 认证。**

### 查询参数

| 参数    | 类型 | 必填 | 说明     |
| ------- | ---- | ---- | -------- |
| chapter | int  | 是   | 章节编号 |

### 成功响应

```json
{
  "ok": true,
  "deleted": 7
}
```

### 限制

- `review_status: "approved"` 的章节不可删除

---

## 认证说明

- API 认证通过 HTTP 头 `Authorization: Bearer <token>` 实现
- Token 通过环境变量 `ADMIN_TOKEN` 配置（默认值：`huihui-admin-local`）
- 认证仅对 PUT 和 DELETE 端点生效
- GET 端点为公开访问
