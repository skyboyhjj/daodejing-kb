# 亲子时光 · 连续学习 + 自由探索模式 实施方案

## Context

当前「亲子时光」页面（`family.html` + `js/family.js`）仅支持 **硬编码的 3 章对话流程**（第8章 → 第1章 → 第2章），无学习进度持久化（页面刷新丢失），用户每次都需要从头开始。需要扩展为：

1. **连续学习模式**：从第1章到第81章顺序学习，自动保存进度，支持暂停恢复
2. **指定章节学习模式**：用户自由选择任意章节（1-81），与连续模式共享相同的学习体验

全部 81 章均支持（已审核章使用慧惠 AI 对话；未审核章降级为五步读解法页面链接）。

## 变更文件

| 文件             | 操作         | 说明                                                                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------- |
| `js/family.js`   | **重度修改** | 核心逻辑：扩展 state、进度持久化、模式切换、81章选择器、恢复会话                |
| `family.html`    | **中度修改** | 新增 DOM：模式切换、章节输入、恢复提示、进度条容器                              |
| `css/family.css` | **中度修改** | 新增样式：mode-switch、resume-prompt、chapter-input、progress-bar、chapter-grid |
| `server.js`      | **轻量修改** | 预留 `/api/family_progress` 路由框架（返回 501）+ TODO 注释                     |

**不修改的文件：** `data/family_metadata.json`（只读）、`chapters/chXX.html`（只链接跳转）、`css/daodejing-styles.css`、`api/family_chat.js`

---

## 一、数据模型

### 1.1 localStorage 键

`daodejing-family-progress`（遵循 `level-filter.js` 中 `daodejing-level-preference` 命名约定）

### 1.2 进度数据结构

```javascript
{
  mode: 'continuous' | 'free',        // 学习模式
  age: '4-6' | '7-9' | '10-12',      // 年龄组
  currentChapter: 5,                   // 当前章节号 (1-81)
  completedChapters: [1, 2, 3, 4],    // 已完成章节号（有序）
  lastAccessDate: '2026-05-13',       // 最后访问日期
  totalRoundsToday: 12,               // 今日累计对话轮次
  sessionStarted: 'ISO时间戳'          // 会话开始时间
}
```

### 1.3 与现有 state 的映射

| localStorage 字段   | `state` 字段                 | 方向     |
| ------------------- | ---------------------------- | -------- |
| `mode`              | `state.mode`                 | 双向同步 |
| `age`               | `state.age`                  | 双向同步 |
| `currentChapter`    | `state.chapterNum`           | 双向同步 |
| `completedChapters` | `state.allChaptersCompleted` | 双向同步 |

---

## 二、state 对象扩展

在现有 `js/family.js:52-63` 的 state 声明末尾追加以下字段：

```javascript
// ===== 新增字段 =====
mode: 'free',                   // 'continuous' | 'free'
chapterNum: 8,                  // 当前章节号（与 chapter 同步）
isResumed: false,               // 是否为恢复的会话
allChaptersCompleted: [],       // 历史累计完成的章节号列表
lastAccessDate: '',             // 'YYYY-MM-DD'
metadataCache: null             // 元数据缓存（减少重复 fetch）
```

---

## 三、DOM 增量（family.html）

### 3.1 导航栏模式切换（插入 `.family-nav` 内）

```html
<div class="family-nav-mode-switch" id="mode-switch">
  <button class="mode-segment active" data-mode="continuous">⏯ 连续学习</button>
  <button class="mode-segment" data-mode="free">🔍 自由探索</button>
</div>
```
位置：`.family-nav-back` 之后、`.family-nav-title` 之前

### 3.2 恢复提示（插入 `.huihui-welcome` 内，默认隐藏）

```html
<div class="resume-prompt" id="resume-prompt" style="display:none;">
  <div class="resume-prompt-title" id="resume-text"></div>
  <div class="resume-prompt-actions">
    <button class="resume-btn" id="resume-continue-btn">🚀 继续学习</button>
    <button class="resume-btn resume-btn-secondary" id="resume-reset-btn">🔄 重新开始</button>
  </div>
</div>
```

### 3.3 章节号输入（插入 `.huihui-welcome` 内，默认隐藏）

```html
<div class="chapter-input-area" id="chapter-input-area" style="display:none;">
  <label>📖 输入你想学的章节号（1-81）</label>
  <div class="chapter-input-row">
    <input type="number" id="chapter-num-input" min="1" max="81" placeholder="章节号">
    <button id="chapter-input-btn">开始学习</button>
  </div>
  <button class="browse-all-btn" id="browse-all-btn">📋 浏览全部 81 章 ▼</button>
</div>
```

### 3.4 进度条容器（作为 `.dialogue-area` 第一个子元素，默认隐藏）

```html
<div class="chapter-progress" id="chapter-progress" style="display:none;">
  <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
  <div class="progress-text" id="progress-text"></div>
</div>
```

---

## 四、CSS 增量（family.css）

全部使用已有 CSS 变量 (`--family-accent`, `--family-border`, `--family-bg`, `--family-text`, `--family-radius` 等)。

### 4.1 模式切换 `.family-nav-mode-switch`

```css
.family-nav-mode-switch {
  display: flex; border-radius: var(--family-radius-sm);
  border: 1px solid var(--family-border); overflow: hidden;
  margin: 0 12px;
}
.mode-segment {
  padding: 5px 14px; font-size: 0.85em; cursor: pointer;
  background: transparent; border: none; color: var(--family-text-light);
  transition: background 0.2s, color 0.2s;
}
.mode-segment.active {
  background: var(--family-accent); color: #faf8f0;
}
```

### 4.2 恢复提示 `.resume-prompt`

居中卡片风格，与 `.huihui-welcome` 一致。两个按钮：主按钮（accent 背景）+"重新开始"（透明边框）。

### 4.3 章节输入 `.chapter-input-area`

- 标签文字居中，灰色
- `.chapter-input-row` flex 水平排列：`<input type=number>` + 提交按钮
- `input[type=number]` 样式与 `.user-input` 一致
- 提交按钮 `.send-btn` 样式

### 4.4 进度条 `.chapter-progress`

- 固定在对话区顶部（`position: sticky; top: 0`）
- `.progress-bar`：高 6px，圆角，背景 `var(--family-border)`
- `.progress-fill`：`background: var(--family-accent)`，宽度由 JS 动态设置 `style.width = percentage + '%'`，过渡动画 `transition: width 0.5s ease`

### 4.5 81 章网格 `.chapter-grid` / `.chapter-mini-card`

- 按 13 个主题板块分组，每组标题 `.theme-group-title`
- `.chapter-mini-card`：30×30px 小方块，grid 布局 `grid-template-columns: repeat(auto-fill, minmax(30px, 1fr))`
- 状态变体：
  - `.done`：绿色边框 `border-color: #5a8a7a; background: #e8f5e9`
  - `.locked`：黄色边框 `border-color: #d4c9a8; opacity: 0.6; cursor: pointer`
  - 正常：墨绿边框，白色背景
- 响应式：`@media (max-width: 600px)` 卡片更紧凑

---

## 五、核心逻辑（js/family.js）

### 5.1 新增辅助函数

```javascript
// 章节号转换
function chapterToKey(num) { return 'chapter' + num; }   // 5 → 'chapter5'
function chapterToNum(key) { return parseInt(key.replace('chapter', ''), 10); }

// 从元数据判断章节是否已审核（首次调用时缓存到 state.metadataCache）
function isChapterApproved(chapterNum) { ... }

// 从元数据获取章节标题和 icon（用于展示）
function getChapterDisplayInfo(chapterNum) { ... }
```

### 5.2 进度持久化（API 预留接口）

```javascript
// Phase 1: localStorage 实现
// Phase 2: 替换为 POST/GET/DELETE /api/family_progress
function saveProgress(callback) { ... }
function loadProgress(callback) { ... }
function resetProgress() { ... }
```

`callback` 签名：`function(err, result)`。`result` 包含 `{ saved: true, backend: 'localStorage' }`。

### 5.3 模式管理

```javascript
function switchMode(mode) {
  state.mode = mode; updateModeSwitchUI(); saveProgress();
  if (mode === 'continuous') showChapterProgress(); else hideChapterProgress();
}
```

### 5.4 恢复会话

```javascript
function resumeSession(progress) {
  state.age = progress.age; state.chapterNum = progress.currentChapter;
  state.allChaptersCompleted = progress.completedChapters || [];
  state.isResumed = true;
  selectChapterByNum(progress.currentChapter); // 直接进入章节学习
}
```

### 5.5 连续学习核心流

**章节完成标记原则**：`endChapter()` 是 `allChaptersCompleted.push()` 的**唯一权威来源**。`goToNextChapter()` 只负责导航（chapterNum 递增），绝不标记完成。这确保只有真正完成对话的章节才被计入统计。

```javascript
// endChapter() — 标记完成的唯一入口
function endChapter() {
    state.chaptersDone.push(state.chapter);
    if (state.mode === 'continuous') {
        state.allChaptersCompleted.push(state.chapterNum);  // 唯一标记点
        saveProgress();
        updateChapterProgress();
        setTimeout(goToNextChapter, 2000);  // 2秒后自动推进
    }
    // 自由探索模式只标记完成，不自动推进
    updateChapterProgress();
}

// goToNextChapter() — 仅负责导航，不标记完成
function goToNextChapter() {
    var next = state.chapterNum + 1;
    if (next > 81) { allChaptersDone(); return; }
    state.chapterNum = next;
    state.chapter = chapterToKey(next);
    saveProgress();
    updateChapterProgress();
    startChapter();
}
```

**设计理由**：早期版本 `goToNextChapter()` 中有一个"防御性"的 `allChaptersCompleted.push()`，创建了第二权威来源。这导致：1）`switchMode()` 在对话进行中切换到连续模式时，通过 `goToNextChapter()` 错误地将未完成章节标记为已读；2）章节完成统计不准确。修复后 `endChapter()` 为唯一权威。

> **Bug 修复记录**（`fbc7036`）：移除 `goToNextChapter()` 中的冗余 push；`switchMode()` 在 dialogue 阶段切换时不再调用 `goToNextChapter()`，改为保留当前章节并重新启用输入。

### 5.6 未审核章处理

```javascript
function handleUnapprovedChapter(num) {
  appendSystemMessage('本章正在由审核团队精心准备中');
  appendChapterCardWithLink(num);  // 渲染链接到 chapters/chXX.html
}
```

### 5.7 81 章选择器

```javascript
function showAllChaptersSelector() {
  // 按 13 个主题板块分组渲染
  // 主题分组来自 chapters.html 的 7+6 分类：
  // 上经：道体论、辩证法、修身论、无为论、处世论、治国论、上经回环
  // 下经：德论、德之用、德之反、德之归、治国续论、玄德论
  // 每章一个小卡片，标注完成状态和审核状态
}
```

### 5.8 修改现有函数

| 函数                         | 修改内容                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showWelcome()`              | 先调用 `loadProgress`，若有进度则显示 `.resume-prompt` 而非年龄选择；初始化模式切换事件                                                           |
| `selectAge(age)`             | 根据 `state.mode` 分流：continuous → 直接 startChapter（loadProgress 已有 currentChapter）；free → 显示 `.chapter-input-area`                     |
| `startChapter()`             | 将 `state.chapter` 和 `state.chapterNum` 同步（`chapterToKey/Num`）；调用前先 `isChapterApproved` 检查                                            |
| `endChapter()`               | 若 `mode === 'continuous'` → `allChaptersCompleted.push()` → `saveProgress()` → `setTimeout(goToNextChapter, 2000)`。**这是完成标记的唯一写入点** |
| `goToNextChapter()`          | 仅递增 `chapterNum` → 同步 `chapter` → `saveProgress()` → `startChapter()`。**不标记完成**                                                        |
| `switchMode()`               | dialogue 阶段切换到 continuous：就地继续，不跳过当前章节；切换到 free：显示全量选择器                                                             |
| `endSession()`               | 调用 `saveProgress()` 记录最终状态                                                                                                                |
| `showChapterSelector()`      | 替换为 `showAllChaptersSelector()`，渲染全部 81 章                                                                                                |
| `selectChapter(chapterKey)`  | 替换为 `selectChapterByNum(chapterNum)`                                                                                                           |
| `callFamilyChatAPI` 错误处理 | 403 → `handleUnapprovedChapter()`；404 → 提示"该章元数据不存在"                                                                                   |
| `appendChapterCard()`        | 保留，新增 `appendChapterCardWithLink()` 变体                                                                                                     |

---

## 六、章节分组（13 板块，与 chapters.html 一致）

**上经 · 道经 (1-37)**
1. 道体论：1, 4, 6, 14, 21, 25
2. 辩证法：2, 22, 36, 40
3. 修身论：7, 8, 10, 12, 15, 16, 20, 26
4. 无为论：3, 17, 19, 23, 29, 37, 48
5. 处世论：9, 13, 24, 27, 33
6. 治国论：5, 11, 18, 30, 31, 32, 35
7. 上经回环：28, 34

**下经 · 德经 (38-81)**
8-13：对应章节从 chapters.html 提取

---

## 七、实施步骤

### 阶段 1：数据层（js/family.js）

1. 在文件顶部添加常量 `PROGRESS_KEY`、辅助函数 `chapterToKey`/`chapterToNum`
2. 扩展 state 对象（新增 mode, chapterNum 等字段）
3. 实现 `saveProgress` / `loadProgress` / `resetProgress`
4. 实现 `isChapterApproved` / `getChapterDisplayInfo`（从 metadata fetch）
5. 构建 `CHAPTER_INFO_ALL`：遍历 1-81，从元数据 title/core_idea 生成显示信息
6. 构建 `CHAPTER_GROUPS`：13 个主题板块的章节号数组

### 阶段 2：UI 组件（family.html）

7. 在导航栏添加 `.family-nav-mode-switch` + 两个按钮
8. 添加 `.resume-prompt`（默认隐藏）
9. 添加 `.chapter-input-area`（默认隐藏）
10. 添加 `.chapter-progress`（默认隐藏）

### 阶段 3：样式（css/family.css）

11. 添加 `.family-nav-mode-switch` 及其子元素样式
12. 添加 `.resume-prompt` 样式
13. 添加 `.chapter-input-area` 样式
14. 添加 `.chapter-progress` / `.progress-bar` / `.progress-fill` 样式
15. 添加 `.chapter-grid` / `.theme-group` / `.chapter-mini-card` 样式及状态变体
16. 移动端适配 `@media (max-width: 600px)`

### 阶段 4：核心逻辑（js/family.js）

17. 实现 `switchMode` + 导航栏按钮事件绑定
18. 重构 `showWelcome`：加入 loadProgress 检查 + resume 提示逻辑
19. 实现 `resumeSession`（恢复进度直接进入）
20. 实现 `handleUnapprovedChapter`（未审核章降级处理）
21. 重构 `selectAge`（根据 mode 分流）
22. 重构 `startChapter`（chapter/chapterNum 同步 + 审核检查）
23. 实现 `selectChapterByNum`
24. 重构 `callFamilyChatAPI` 错误处理（403）
25. 重构 `endChapter`（连续模式自动下一章）
26. 实现 `goToNextChapter` + `allChaptersDone`
27. 实现 `showAllChaptersSelector`（13 板块 + 81 章网格）
28. 重构 `endSession`（追加 saveProgress 调用）

### 阶段 5：服务器预留（server.js）

29. 在 `server.js` 路由分发处添加：
```javascript
if (req.url.startsWith('/api/family_progress')) {
    res.writeHead(501, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify({ error: 'Not implemented yet', planned: 'Phase 2 - API-synced progress' }));
    return;
}
```
30. 添加 TODO 注释标注后续实现计划

### 阶段 6：验证

31. `npm run ci` 确保构建验证通过
32. 重启服务器 → 打开 family.html → 体验完整流程
33. 测试场景：
    - 首次访问 → 年龄选择 → 连续学习 → 从第 1 章开始
    - 对话 2 轮 → 关闭页面 → 重新打开 → 恢复提示出现 → 继续
    - 自由探索模式 → 输入 42 → 未审核 → 五步读解法链接
    - 自由探索模式 → 输入 8 → 已审核 → 正常 AI 对话
    - 切换连续/自由模式 → 刷新 → 模式保持
    - 移动端响应式检查

## 设计原则

- 最小侵入：现有 3 章流程（CHAPTER_INFO, selectAge, showChapterSelector）尽可能复用
- 降级优雅：未审核章不报错，引导到五步读解法页面
- 接口预留：saveProgress/loadProgress 的函数签名支持后续切换 API
- 命名一致：遵循项目现有的小驼峰变量名、中文注释、CSS 变量约定
