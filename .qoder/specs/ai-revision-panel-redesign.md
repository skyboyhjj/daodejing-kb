# AI 修改面板重构计划

## Context

当前管理控制台缺少对 AI 暂存修订数据的可视化管理和操作界面。AI 修订写入 `family_metadata_staging.json` 后，管理员只能通过同步栏模糊感知其存在，无法：
- 在列表中浏览所有待处理 AI 修订
- 查看 AI 修订的具体内容
- 单独操作某个章节的 AI 修订（查看/同步/丢弃）
- 删除不需要的 AI 修订

需要新增独立的 "AI 修改" 视图模式来解决这些问题。

## 修改文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `api/_shared/metadata-reviser.js` | 新增函数 | `removeFromStaging()` |
| `server.js` | 增强 + 新增路由 | 增强 GET staging、新增 DELETE staging |
| `admin/family-review.html` | 新增 1 行 | AI 修改按钮 |
| `admin/family-review.css` | 新增样式 | AI 模式视觉主题 |
| `admin/family-review.js` | 核心改动 | 状态管理 + 渲染 + 事件 |

## 实现步骤

### Step 1: metadata-reviser.js — 新增 `removeFromStaging()`

- 加载 `family_metadata_staging.json`
- 删除 `chapters[String(chapterNum)]`
- 更新 `_updated` 时间戳
- 写回文件
- 导出该函数

### Step 2: server.js — 增强 `GET /api/metadata/staging`

- 新增 `?chapter=N` 查询参数支持 → 返回该章节的完整暂存数据
- 在列表模式的返回中增加 `_items` 数组，包含每个暂存章节的预览信息（chapter, title, core_idea_preview 前60字, _staged_at, _staged_model, _production_status），避免前端逐章查询

### Step 3: server.js — 新增 `DELETE /api/metadata/staging`

- 路由：`DELETE /api/metadata/staging?chapter=N`
- 需要 admin auth
- 调用 `removeFromStaging(chapterNum)`
- 返回 `{ ok, removed }` 或错误

### Step 4: family-review.html — 新增 AI 修改按钮

在 `.filter-row` 末尾（"需修改"按钮之后）添加：
```html
<button class="filter-btn" data-filter="ai">AI 修改</button>
```

### Step 5: family-review.css — AI 模式样式

- `.filter-btn[data-filter="ai"]` — 橙色主题，active 时填充 `--status-revision`
- `.staging-status` — AI 修订章节列表状态标签
- `.ai-action-bar` — AI 操作按钮栏（橙色虚线边框）
- `.ai-detail-card` — AI 详情卡片（橙色左边框）
- `.staging-meta-box` — 暂存元信息盒子（模型、时间）

### Step 6: family-review.js — 状态扩展

在 `state` 对象中新增：
- `aiMode: false` — 是否处于 AI 模式
- `stagingChapters: []` — 暂存章节列表（来自 API `_items`）
- `currentStagingChapter: null` — 当前查看的暂存章节完整数据

### Step 7: family-review.js — 新增 API 函数

- `loadStagingList()` — `GET /api/metadata/staging`，存入 `state.stagingChapters`，刷新列表
- `loadStagingDetail(chapterNum)` — `GET /api/metadata/staging?chapter=N`，存入 `state.currentStagingChapter`，渲染 AI 详情
- `removeFromStaging(chapterNum)` — `DELETE /api/metadata/staging?chapter=N`，成功后刷新列表

### Step 8: family-review.js — 筛选按钮逻辑修改

在现有 filter button click handler 中增加 AI 模式处理：
- `data-filter="ai"` → `state.aiMode = true`，调用 `loadStagingList()`
- 其他 filter → `state.aiMode = false`，恢复 `loadAllChapters()`
- 模式切换时清除 `state.currentChapter` / `state.currentStagingChapter`

### Step 9: family-review.js — `renderChapterList()` 双路径

- **AI 模式路径**：遍历 `state.stagingChapters`，渲染带 `<span class="staging-status">AI 修订</span>` 标签的章节条目，`data-mode="ai"` 属性
- **普通路径**：保持现有逻辑不变
- AI 模式空状态：显示 "暂存区无待处理修订" 提示

### Step 10: family-review.js — 章节点击处理修改

在 `chapterList` click handler 中判断 `data-mode="ai"`：
- AI 模式 → `loadStagingDetail(chapterNum)` → `renderAIStagingDetail()`
- 普通模式 → 现有 `loadChapterDetail(chapterNum)` → `renderDetail()`

### Step 11: family-review.js — AI 详情渲染 `renderAIStagingDetail()`

渲染结构：
1. **AI 操作栏**（`.ai-action-bar`）：三个按钮
   - "同步到生产"（绿色）→ 调用 `syncChapterToProduction()`
   - "重新审核"（主色）→ 调用 `performAction(chapter, 'reviewing')`，成功后从暂存区删除
   - "删除"（红色）→ 确认模态框 → 调用 `removeFromStaging()`
2. **暂存元信息盒子**（`.staging-meta-box`）：显示模型、修订时间、原生产状态
3. **AI 详情卡片**（`.ai-detail-card`）：渲染 `core_idea`、`safety_notes`、`interaction_points`、`parent_tips`
4. 不渲染安全检查表、修订面板、diff 视图、历史时间线（这些是审核模式专属）

### Step 12: family-review.js — 搜索和键盘导航适配

- AI 模式下搜索过滤 `state.stagingChapters`（按 title / core_idea_preview / chapter 号）
- 键盘导航（ArrowUp/ArrowDown/j/k）自动适配 AI 模式下的章节列表

## 验证方案

1. **重启 server.js**（加载新路由代码）
2. **打开管理控制台** → 确认侧栏出现"AI 修改"按钮
3. **点击 AI 修改** → 确认列表显示暂存章节（第53章）
4. **点击第53章** → 确认右侧显示 AI 修订内容，操作栏有三个按钮
5. **测试同步** → 点击"同步到生产" → 确认章节从列表消失，生产数据已更新
6. **重新触发修订** → 在 revision_needed 状态下等待 / 手动触发 AI 修订 → 确认重新出现在 AI 修改列表
7. **测试删除** → 点击"删除" → 确认确认弹窗 → 确认章节从列表消失
8. **测试重新审核** → 点击"重新审核" → 确认生产章节状态变为 reviewing，从暂存区删除
