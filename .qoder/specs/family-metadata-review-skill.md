# Family Metadata Review Skill — 实施文档

> **版本**：v1.1  
> **最后更新**：2026-05-12  
> **状态**：Phase 1–6 全部实施完成，已上线生产  
> **对应 Skill**：`.qoder/skills/family-metadata-review/SKILL.md`

---

## 一、系统概览

`family-metadata-review` Skill 实现了"提取 → 审核 → 批准 → 缓存"的完整工作流。核心组件：

```
┌─────────────────────────────────────────────────┐
│  admin/family-review.html (审核控制台 SPA)        │
│  admin/family-review.css  admin/family-review.js │
└──────────────────┬──────────────────────────────┘
                   │ fetch /api/metadata/*
┌──────────────────▼──────────────────────────────┐
│  server.js (本地开发服务器)                        │
│  · 鉴权中间件 (ADMIN_TOKEN)                       │
│  · GET  /api/metadata/stats                      │
│  · GET  /api/metadata            列表/详情        │
│  · PUT  /api/metadata            状态转换/编辑    │
│  · DELETE /api/metadata?chapter=N  删除           │
└──────────────────┬──────────────────────────────┘
                   │ load / save
┌──────────────────▼──────────────────────────────┐
│  api/_shared/metadata-store.js (规范实现)          │
│  · loadMetadata / saveMetadata                    │
│  · validateTransition / appendHistory             │
│  · getStats / getChapterList / updateChapter      │
│  · 5 秒文件缓存 TTL                               │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  data/family_metadata.json                       │
│  · 81 章元数据（45 approved + 35 pending + 1 revision_needed）│
│  · _version: "1.1"                               │
└─────────────────────────────────────────────────┘
```

---

## 二、文件变更清单

### 新增文件

| 文件                                                      | 说明                                       |
| --------------------------------------------------------- | ------------------------------------------ |
| `admin/family-review.html`                                | 审核控制台页面（左侧面板 + 右侧详情）      |
| `admin/family-review.css`                                 | 水墨主题样式 (墨绿 #2e5f5f / 宣纸 #faf8f0) |
| `admin/family-review.js`                                  | 纯原生 JS SPA (IIFE, 无框架)               |
| `api/_shared/metadata-store.js`                           | 元数据 CRUD 规范实现 (ESM exports)         |
| `data/family_metadata_v1.0_backup.json`                   | 迁移前完整备份                             |
| `.qoder/skills/family-metadata-review/SKILL.md`           | Skill 清单                                 |
| `.qoder/skills/family-metadata-review/review-workflow.md` | 审核工作流详细说明                         |
| `.qoder/skills/family-metadata-review/api-spec.md`        | API 端点规范                               |

### 修改文件

| 文件                        | 变更摘要                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| `server.js`                 | 新增 4 个 API 端点 + admin 鉴权 + 状态机验证 (约 150 行)                      |
| `data/family_metadata.json` | 所有章节添加 `review_history[]`，`_version` → "1.1"，全量 81 章覆盖           |
| `.env`                      | 新增 `ADMIN_TOKEN=huihui-admin-local`                                         |
| `.gitignore`                | 新增 `data/*_backup.json` 和 `__pycache__/`                                   |
| `scripts/warmup_cache.py`   | 自动扫描预热所有 `approved` 章节；`--no-server` + `--port` 支持复用已有服务器 |

---

## 三、审核状态机（实施后）

```
    ┌──────────┐    开始审核    ┌───────────┐
    │  pending  │──────────────→│ reviewing  │ (软锁定 reviewed_by)
    └──────────┘               └─────┬──────┘
         ↑                          │
         │ 退回待审              ┌───┴────┐
         │                      │        │
         │                 审核通过  需要修改
         │                      │        │
         │                 ┌────▼──┐ ┌──▼──────────┐
         └─────────────────│approved│ │revision_needed│
                          └───────┘ └──────┬───────┘
                              │            │
                              │            │ 重新审核
                              │            └──→ reviewing
                              │ 改为需修改
                              └──→ revision_needed
```

### 状态转换规则（代码实现）

| 当前状态          | 允许的目标状态                             |
| ----------------- | ------------------------------------------ |
| `pending`         | `reviewing`                                |
| `reviewing`       | `approved` / `revision_needed` / `pending` |
| `approved`        | `revision_needed`                          |
| `revision_needed` | `reviewing`                                |

实现位置：[server.js:65-70](server.js:65-70) 和 [api/_shared/metadata-store.js:20-25](api/_shared/metadata-store.js:20-25)。

### 软锁定机制

- 进入 `reviewing` 时自动设置 `reviewed_by` = 操作者标识
- 非锁定者修改已锁定章节时返回 HTTP 423
- `approved` / `revision_needed` / `pending` 时清除锁定

---

## 四、API 端点

| 方法   | 路径                    | 认证   | 功能                                                                               |
| ------ | ----------------------- | ------ | ---------------------------------------------------------------------------------- |
| GET    | /api/metadata/stats     | 否     | 统计摘要（total / approved / pending / reviewing / revision_needed / by_reviewer） |
| GET    | /api/metadata           | 否     | 列表查询，支持 `?status=` `?search=` `?limit=`                                     |
| GET    | /api/metadata?chapter=N | 否     | 单章详情，含完整 `review_history[]`                                                |
| PUT    | /api/metadata           | Bearer | 状态转换或内容更新；请求体 `{ chapter, updates: { review_status, review_notes } }` |
| DELETE | /api/metadata?chapter=N | Bearer | 删除章节（`approved` 状态禁止删除）                                                |

认证：`Authorization: Bearer <ADMIN_TOKEN>`，Token 默认值 `huihui-admin-local`。

---

## 五、审核控制台

### 控制台访问
打开预览面板或直接访问 http://localhost:8080/admin/family-review.html，输入 Token huihui-admin-local 即可使用。

### 界面布局

```
┌─────────────────────────────────────────────────────────┐
│  Topbar: 图标 · 标题 · 统计(待审/N/审核中/N/已通过/N/需修改/N)    │
├──────────────────────┬──────────────────────────────────┤
│  SIDEBAR (340px)      │  MAIN CONTENT                    │
│                       │                                  │
│  🔍 搜索输入框         │  [操作按钮栏] ← 按状态显示不同按钮    │
│  [全部] [待审核] ...   │  [审核备注 textarea]              │
│                       │                                  │
│  ┌─────────────────┐  │  ┌──────────────────────────┐   │
│  │ Ch3 · 不尚贤     │  │  │ 基本信息卡片               │   │
│  │ pending          │  │  │ · 核心思想                │   │
│  ├─────────────────┤  │  │ · 安全注意事项             │   │
│  │ Ch7 · 天长地久   │  │  │ · 亲子互动点               │   │
│  │ approved         │  │  │ · 家长提示                 │   │
│  ├─────────────────┤  │  └──────────────────────────┘   │
│  │ ...              │  │                                  │
│  └─────────────────┘  │  ┌──────────────────────────┐   │
│                       │  │ 🛡 安全检查表 (Article 11)  │   │
│  (支持 j/k 键导航)    │  │ ☑ 8 项逐条确认             │   │
│                       │  └──────────────────────────┘   │
│                       │  ┌──────────────────────────┐   │
│                       │  │ 📝 审核历史时间线          │   │
│                       │  │ 按时间倒序展示             │   │
│                       │  └──────────────────────────┘   │
└──────────────────────┴──────────────────────────────────┘
```

### 操作按钮（按状态）

| 当前状态          | 按钮                             |
| ----------------- | -------------------------------- |
| `pending`         | [开始审核]                       |
| `reviewing`       | [审核通过] [需要修改] [退回待审] |
| `approved`        | [改为需修改] ← **双重确认弹窗**  |
| `revision_needed` | [重新审核]                       |

### 安全确认

- **删除操作**：弹窗确认章节名
- **approved → revision_needed**：双重确认（警告已上线 + 确认章节名）
- **审核通过未全勾选安全检查表**：弹窗二次确认

### 安全检查表状态

- 非 approved 章节：交互式 checkbox，可自由勾选
- approved 章节：所有项预勾选 + 禁用 + 半透明锁定

---

## 六、亲子守护（Article 11）安全检查表

依据《慧惠数字生命 · 最高产品宪法》第十一条「亲子守护原则」制定。

> "面向未成年用户的任何交互，须以保护而非获取为目的。"
> "AI 面向儿童的内容须避免恐怖、暴力、成人主题。"
> "面向儿童的功能不包含任何形式的成瘾性设计。"

### 11 项检查项

| #   | 检查项                                                                           | 宪法依据                               |
| --- | -------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | 无死亡/灾难/暴力相关内容                                                         | 第十一条：避免恐怖、暴力               |
| 2   | 无成人主题或不适宜儿童的内容                                                     | 第十一条：避免成人主题                 |
| 3   | 无成瘾性设计或诱导性语言                                                         | 第十一条：无成瘾性设计                 |
| 4   | 语言难度匹配目标年龄段（4-12 岁）                                                | 第六条减法原则：以用户能理解的深度呈现 |
| 5   | 无负面引导（不鼓励攀比、撒谎、自私等）                                           | 第二条：不是说教者                     |
| 6   | 无身体焦虑（不涉及身材/容貌评价）                                                | 第二条：不告诉用户"你应该"             |
| 7   | 无道德绑架或评判式语言                                                           | 第二条：不评判                         |
| 8   | 语气温暖、尊重儿童主体性                                                         | 第四条：恩泽，润物无声                 |
| 9   | 无道德误读风险（不将"无为""返璞归真"等概念与不守规则、不讲礼貌等不良行为相关联） | 第二条：不是说教者 + 第九条：坦诚透明  |
| 10  | 不对孩子行为做道德评判（保持客观描述，不将行为定性为"好"或"坏"）                 | 第二条：不评判                         |
| 11  | 不良行为有正确的回应策略（平常心回应情绪，不借机说教或美化）                     | 第十一条：以保护而非获取为目的         |

审核通过前必须 11 项全部确认。

安全分析参考：见 `docs/01-亲子时光/` 目录下的「第 38 章 · 上德不德 亲子时光安全注意事项」文档，该文档以第 38 章为例，详细展示了亲子对话安全约束在具体章节中的应用方式，包括潜在风险识别、安全提示措辞及各年龄段互动中的安全问题应对策略，该分析方法可推广至全部 81 章的审核流程。

---
## 七、与现有系统集成

| 系统              | 集成方式                                                              | 状态   |
| ----------------- | --------------------------------------------------------------------- | ------ |
| `extract_meta.py` | 新章节自动设 `pending`，不覆盖已有章节；支持 `--all` 全量 81 章模式   | 已完成 |
| `family_chat API` | 第 550 行 `review_status !== 'approved'` 守卫，仅服务 approved 章节   | 已完成 |
| `warmup_cache.py` | 自动扫描所有 `approved` 章节预热；`--no-server` + `--port` 复用服务器 | 已完成 |
| `validate.js`     | `npm run validate` 检查所有 81 章 HTML；1782/1782 通过                | 已完成 |
| `build-index.js`  | 搜索索引独立于元数据状态；hash: `fd017271bd3b6a98`                    | 已完成 |
| `npm run ci`      | validate + build-index --check 串联检查                               | 全通过 |

### warmup_cache.py 用法

```
# 预热全部 approved 章节（自动扫描 family_metadata.json）
python scripts/warmup_cache.py --no-server --port 8080

# 该操作幂等安全，会刷新所有已批准章节的缓存
```

---

## 八、数据模型

### family_metadata.json 章节条目完整结构

```json
{
  "3": {
    "chapter": 3,
    "title": "不尚贤",
    "core_idea": "不总说谁最棒...",
    "safety_notes": ["避免将'不争'理解为消极退缩..."],
    "interaction_points": [
      {
        "topic": "小动物不争",
        "age_4_6": "宝宝，你看小猫咪...",
        "age_7_9": "如果森林里的小动物...",
        "age_10_12": "老子说'不尚贤'..."
      }
    ],
    "parent_tips": "和孩子一起读时...",
    "review_status": "approved",
    "reviewed_by": "",
    "reviewed_at": "2026-05-12",
    "review_history": [
      { "action": "created", "by": "extract_meta.py", "at": "2026-05-12T00:00:00Z", "notes": "AI generated - awaiting review" },
      { "action": "reviewing", "by": "admin", "at": "2026-05-12T09:21:23Z", "notes": "" },
      { "action": "approved", "by": "admin", "at": "2026-05-12T09:21:40Z", "notes": "何继杰" }
    ]
  }
}
```

`_version`: "1.1"  
`_updated`: "2026-05-12"

---

## 九、当前状态

```
总章节: 81（全量覆盖）
已审核: 45
待审核: 35
审核中: 0
需修改: 1

元数据提取脚本已扩展 --all 全量模式（自动跳过已有章节）
审核通过章节已通过 warmup_cache.py 预热，保证首访流畅体验
```

---

## 十、Bug 修复记录 (v1.1)

| Bug | 问题                                                       | 修复                                                             | 影响文件                                 |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| #1  | `approved → revision_needed` 无确认弹窗                    | 增加**双重 confirm**（警告上线 + 确认章节名）                    | admin/family-review.js                   |
| #2  | `revision_needed` 只能回到 `pending`，无法进入 `reviewing` | 修正为 `revision_needed → reviewing`；`reviewing` 增加 `pending` | server.js, api/_shared/metadata-store.js |
| #3  | approved 章节安全检查表仍显示未勾选                        | approved 章节 checkbox 预勾选 + 禁用 + 半透明锁定                | admin/family-review.js                   |
| #4  | 审核备注未持久化（前后端字段名不一致）                     | 统一为 `review_notes`                                            | admin/family-review.js                   |

---

## 十一、参考文件索引

| 文件                                                      | 内容                             |
| --------------------------------------------------------- | -------------------------------- |
| `.qoder/skills/family-metadata-review/SKILL.md`           | Skill 清单 + 快速开始            |
| `.qoder/skills/family-metadata-review/review-workflow.md` | 状态机详情 + 审核历史 + 删除策略 |
| `.qoder/skills/family-metadata-review/api-spec.md`        | 5 个端点完整规格                 |
| `docs/慧惠数字生命 · 最高产品宪法.md`                     | 第十一条 · 亲子守护原则          |
| `admin/family-review.html`                                | 控制台页面 (端口 8080)           |
| `admin/family-review.css`                                 | 控制台样式                       |
| `admin/family-review.js`                                  | 控制台逻辑                       |
| `api/_shared/metadata-store.js`                           | 元数据 CRUD 规范实现             |
| `scripts/warmup_cache.py`                                 | 缓存预热脚本                     |
| `data/family_metadata.json`                               | 元数据存储 (v1.1)                |
