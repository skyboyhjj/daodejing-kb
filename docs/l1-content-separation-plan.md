# L1 认知层级 URL 路由模式分离方案设计书

## 一、背景与目标

### 1.1 项目现状

当前项目采用**单文件多层级**架构：每一章 HTML 文件（`chapters/ch01.html` ~ `ch81.html`）内同时包含 L1-L4 四个认知层级的全部内容，通过 `level-filter.js` 在客户端动态显示/隐藏。

- L1 内容嵌入在 `<div class="level-block level-l1" data-level="l1">` 块中
- 每章有 5 个步骤 × 4 个层级 = 约 20 个 level-block
- 默认显示 L2+L3（精读版+应用版），L1 和 L4 初始隐藏
- 用户通过按钮切换层级，偏好存储在 localStorage

### 1.2 分离目标

在**不拆分章节文件、不创建独立部署**的前提下，通过 **URL 参数 + 路由模式** 实现 L1 优先浏览体验：

1. **URL 参数模式**：`chapters/ch01.html?level=l1` 自动激活 L1 筛选
2. **L1 专属首页**：`l1/index.html` 作为儿童友好的独立入口
3. **导航上下文保持**：L1 模式下，章节间导航自动携带 `?level=l1`
4. **L1 视觉增强**：L1 模式下加载专属 CSS（更大的字体、更友好的触控目标）

### 1.3 不做什么

- ❌ 不将 L1 内容从章节文件中提取出来
- ❌ 不创建独立的 L1 部署/子域名
- ❌ 不修改 81 个章节文件的 HTML 结构
- ❌ 不引入构建工具或框架依赖

---

## 二、技术架构设计

### 2.1 层级优先级规则

```
URL 参数 (?level=l1) > 用户按钮点击 > localStorage 偏好 > 默认值 (l2)
```

- URL 参数存在时：使用参数值，**不写入** localStorage（本次访问专属）
- 用户点击按钮时：写入 localStorage + 更新 URL
- 无参数字、无存储时：默认 L2

### 2.2 核心组件交互图

```
┌─────────────────────────────────────────────┐
│              level-filter.js (增强版)        │
│                                              │
│  ① getURLLevel()        解析 ?level= 参数    │
│  ② determineLevel()     确定有效层级          │
│  ③ applyLevel()         显示/隐藏 level-block │
│  ④ updateURL()          更新 URL 参数         │
│  ⑤ rewriteNavLinks()    重写导航链接          │
│  ⑥ setBodyClass()       设置 body class       │
│  ⑦ injectL1CSS()        按需加载 L1 专属样式   │
└─────────────────────────────────────────────┘
         │                │
         ▼                ▼
  ┌──────────────┐  ┌──────────────────┐
  │ localStorage │  │ l1-mode.css      │
  │ (偏好持久化)  │  │ (L1 视觉增强)     │
  └──────────────┘  └──────────────────┘
```

---

## 三、详细实施方案

### 3.1 level-filter.js 增强（核心改动）

**文件**：`e:\daodejing-kb\js\level-filter.js`（当前 124 行）

#### 新增函数

**a) `getURLLevel()` — 解析 URL 参数**

```javascript
function getURLLevel() {
    try {
        var params = new URLSearchParams(window.location.search);
        var level = params.get('level');
        if (level && ['l1','l2','l3','l4','all'].indexOf(level) !== -1) {
            return level;
        }
    } catch(e) {}
    return null;
}
```

**b) `updateURL(level)` — 更新 URL 参数（不创建历史记录）**

```javascript
function updateURL(level) {
    try {
        var params = new URLSearchParams(window.location.search);
        params.set('level', level);
        var newSearch = params.toString();
        var newURL = window.location.pathname + (newSearch ? '?' + newSearch : '');
        history.replaceState(null, '', newURL);
    } catch(e) {}
}
```

**c) `rewriteNavLinks(level)` — 重写导航链接保持 L1 上下文**

需要重写的链接选择器：
- `.nav-chapters a` — 底部"上一章/下一章"导航
- `.chapter-nav a` — 顶部导航栏
- `.back-home a` — chapters.html 上的返回首页链接

重写规则：
- 章节间链接（`href="chXX.html"`）：追加 `?level=<level>`
- "回到首页"链接（`href` 含 `index.html`）：当 level=l1 时，改写为 `l1/index.html`
- 已有 `?level=` 的链接：更新为当前 level
- 锚点链接（`href="#step1"`）：不处理
- 外部链接和 `chapters.html` 引用：追加 `?level=<level>`

**d) `setBodyClass(level)` — 设置 body CSS class**

```javascript
function setBodyClass(level) {
    document.body.classList.remove('level-l1','level-l2','level-l3','level-l4','level-all');
    document.body.classList.add('level-' + level);
}
```

**e) `injectL1CSS()` — 按需加载 L1 专属样式**

```javascript
function injectL1CSS() {
    if (document.getElementById('l1-mode-css')) return; // 已加载
    var link = document.createElement('link');
    link.id = 'l1-mode-css';
    link.rel = 'stylesheet';
    link.href = resolveL1CSSPath();
    document.head.appendChild(link);
}

function resolveL1CSSPath() {
    // 根据当前页面路径深度计算相对路径
    var path = window.location.pathname;
    if (path.indexOf('/chapters/') !== -1 || path.indexOf('/l1/') !== -1) {
        return '../css/l1-mode.css';
    }
    return 'css/l1-mode.css';
}
```

#### 修改的初始化流程

```
原流程: restorePreference() → applyLevel('l2')
新流程: getURLLevel() → 有?用参数 / 无?restorePreference() → applyLevel()
       → setBodyClass() → injectL1CSS(if l1) → rewriteNavLinks() → dispatchEvent()
```

#### applyLevel() 修改点

在 `applyLevel()` 中：
1. **URL 参数模式下不写 localStorage**（通过参数 `fromURL` 控制）
2. 增加 `setBodyClass(level)` 调用
3. 按钮点击时调用 `updateURL(level)`

### 3.2 L1 专属 CSS 文件

**新文件**：`e:\daodejing-kb\css\l1-mode.css`

```css
/* L1 儿童友好模式 — 视觉增强 */
/* 通过 body.level-l1 作用域控制，仅在 L1 模式下生效 */

body.level-l1 {
    font-size: 1.1em;
}

/* 更大的标题 */
body.level-l1 h1 { font-size: 1.8em; }
body.level-l1 h2 { font-size: 1.4em; }
body.level-l1 h3 { font-size: 1.2em; }

/* L1 内容块更大间距 */
body.level-l1 .level-block.level-l1 {
    padding: 18px 22px;
    font-size: 1.05em;
    line-height: 1.9;
}

/* 更大的触控目标 */
body.level-l1 .level-btn {
    padding: 8px 18px;
    font-size: 0.95em;
}

/* 章节导航按钮放大 */
body.level-l1 .nav-chapters a {
    padding: 12px 22px;
    font-size: 1em;
}

/* 原文区域放大 */
body.level-l1 .original-text {
    font-size: 1.2em;
    line-height: 2.5;
}

/* 金句区域放大 */
body.level-l1 .golden-quote .quote-text {
    font-size: 1.3em;
}
```

### 3.3 L1 专属首页

**新文件**：`e:\daodejing-kb\l1\index.html`

核心设计：
- **问候语**："嗨，小朋友！我是慧惠 🌱" — 比成人版更温暖、更简单
- **三张入口卡片**（保持与主首页一致的结构，但内容和链接适配 L1）：
  1. 📖 **开始读故事** → `../chapters/ch01.html?level=l1`
  2. 🗺️ **看看有哪些故事** → `../chapters.html?level=l1`  
  3. 💬 **问慧惠** → 打开聊天组件（复用主首页 JS）
- **底部返回链接**："这是小朋友的版本。爸爸妈妈看这里 →" → `../index.html`
- **引用共享资源**：`../css/daodejing-styles.css`、`../css/huihui-chat.css`、`../js/*.js`
- **内联 L1 专属样式**（与 l1-mode.css 重复的内容放到内联，避免额外网络请求）
- **加载 level-filter.js**：自动读取 localStorage 中的 L1 偏好（但不改写 URL，因为是首页）

关键注意：
- l1/index.html 使用 `../css/`、`../js/` 路径（因为它在 `l1/` 子目录下）
- 所有章节链接硬编码 `?level=l1`，即使 JS 不运行也能保持 L1 上下文
- 不包含 level-selector（首页不需要层级切换）
- 包含 huihui-chat 聊天组件

### 3.4 主首页适配

**文件**：`e:\daodejing-kb\index.html`

最小改动：
- 在页面底部（`.about-section` 之后或 footer 之前）添加一行：

```html
<div style="text-align:center;margin:20px 0;">
    <a href="l1/index.html" style="color:#4a8a5e;text-decoration:none;font-size:0.9em;">
        👶 和小朋友一起读？进入儿童模式 →
    </a>
</div>
```

### 3.5 章节目录页适配

**文件**：`e:\daodejing-kb\chapters.html`

改动内容：
1. **添加 level-selector UI**（顶部 `.chapters-header` 下方）
2. **引入 level-filter.js**（在现有 script 加载区）
3. **为章节卡片添加 L1 描述**（初始可为空占位，逐步填充）：

```html
<div class="chapter-card">
    <div class="chapter-title">
        <span class="chapter-num">第1章</span>
        <a href="chapters/ch01.html">道可道，非常道</a>
    </div>
    <div class="chapter-desc">
        总纲：道的不可言说性 · 有无同出 · 玄之又玄 · 众妙之门
    </div>
    <!-- 新增：L1 儿童描述 -->
    <div class="chapter-desc-l1" data-level="l1" style="display:none;">
        一个老爷爷告诉我们：世界上最重要的事情，是说不出来的。
    </div>
</div>
```

4. **level-filter.js 适配**：`applyLevel()` 需要同时处理 `.chapter-desc` 和 `.chapter-desc-l1` 的显示/隐藏（当前只处理 `.level-block[data-level]`）

这个适配比较关键——`chapters.html` 的卡片不是 `.level-block` 结构，需要扩展 `level-filter.js` 的过滤逻辑来处理非标准结构，或者在 `chapters.html` 内联专门的过滤逻辑。

**简化方案**：在 `chapters.html` 中添加内联 script，监听 `huihui-level-changed` 事件，手动切换 `.chapter-desc` 和 `.chapter-desc-l1` 的显示。

### 3.6 章节文件本身

**无需修改**。81 个章节文件结构完整，`level-filter.js` 的增强对它们透明。

但需要注意：章节文件中 huihui-chat 的 CSS/JS 使用绝对路径 `/css/huihui-chat.css`、`/js/huihui-chat.js`，这在 L1 首页（`l1/index.html`）中也应保持一致（同样使用绝对路径）。

---

## 四、目录结构变化

```
e:\daodejing-kb\
  index.html                          (修改：添加"儿童模式"入口)
  chapters.html                       (修改：添加 level-selector + L1 描述 + level-filter.js)
  l1/                                 (新建目录)
    index.html                        (新建：L1 专属首页)
  css/
    daodejing-styles.css              (不变)
    huihui-chat.css                   (不变)
    l1-mode.css                       (新建：L1 儿童友好样式)
  js/
    level-filter.js                   (增强：URL 参数 + 导航重写 + body class + CSS 注入)
    search.js                         (不变)
    back-to-top.js                    (不变)
    huihui-chat.js                    (不变)
  chapters/
    ch01.html ~ ch81.html             (不变)
  api/
    chat.js                           (不变)
  server.js                           (不变)
```

---

## 五、实施步骤

| 步骤 | 操作 | 涉及文件 | 预计影响 |
|------|------|----------|----------|
| **S1** | 增强 level-filter.js | `js/level-filter.js` | 核心改动，影响所有页面 |
| **S2** | 创建 l1-mode.css | `css/l1-mode.css` | 新文件，无影响 |
| **S3** | 创建 L1 专属首页 | `l1/index.html` | 新文件，无影响 |
| **S4** | 主首页添加"儿童模式"入口 | `index.html` | 1 行 HTML |
| **S5** | chapters.html 适配 | `chapters.html` | 添加 level-selector + L1 描述结构 + 过滤逻辑 |
| **S6** | 整体验证 | 全部 | 端到端测试 |

---

## 六、关键设计决策

### 6.1 为什么用 `?level=l1` 而非 `/l1/chapters/ch01.html`

| 方案 | 优点 | 缺点 |
|------|------|------|
| `?level=l1` URL 参数 | 无需复制文件，无需服务器路由，JS 实现简单 | URL 有参数，不够"干净" |
| `/l1/chapters/` 路径前缀 | URL 更干净，SEO 友好 | 需要 Vercel rewrites 或文件复制，复杂度高 |

选择 `?level=l1` 方案，因为：
- 无需服务器配置
- file:// 本地开发完全兼容
- 实现简单，风险最低
- 未来可随时升级到路径前缀方案

### 6.2 为什么 nav 链接重写选在 `level-filter.js` 而非在 HTML 中硬编码

- 覆盖全站 81 章 + chapters.html，统一修改一个 JS 文件即可
- 保留灵活切换层级的可能（用户在 L1 模式下点 L2 按钮，导航链接需要同步更新）
- 未来扩展更简单

### 6.3 为什么 `l1-mode.css` 独立加载而非合并到 `daodejing-styles.css`

- 按需加载，不影响默认 L2-L4 体验的网络请求
- 保持 `daodejing-styles.css` 稳定（已通过 1782 条验证）
- 方便后续独立优化 L1 视觉

---

## 七、风险评估与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| nav 链接重写遗漏某些链接类型 | 中 | 高：部分导航不保持 L1 模式 | 全面审查所有页面的导航链接模式，编写测试矩阵 |
| URL 参数与现有锚点冲突 | 低 | 低：`?level=l1#step3` 仍可正常工作 | URLSearchParams 不处理 hash |
| chapters.html 的 L1 描述需要大量内容编写 | 高 | 中：没有内容时 L1 模式卡片为空 | 先用简短占位文本，逐步完善 |
| l1-mode.css 与内联 style 的优先级冲突 | 低 | 中：部分样式可能不生效 | 使用 `body.level-l1` 作用域 + 必要时加 `!important` |
| 用户分享带 `?level=l1` 的链接给非 L1 用户 | 低 | 低：对方看到的也是 L1 | 在页面上提供明显的"切换到精读版"按钮（已有 level-selector） |

---

## 八、验证方案

### 8.1 自动化验证

```bash
# 验证 level-filter.js 语法正确
node -c js/level-filter.js

# 运行现有结构验证（确保章节文件未被修改）
node scripts/validate.js

# 验证新文件存在
ls l1/index.html css/l1-mode.css

# 验证所有页面的链接可达性（可后续编写脚本）
```

### 8.2 手动测试矩阵

| # | 测试场景 | 操作 | 预期结果 |
|---|---------|------|----------|
| 1 | L1 首页加载 | 打开 `l1/index.html` | 显示儿童友好界面，卡片链接带 `?level=l1` |
| 2 | L1 首页→章节 | 点击"开始读故事" | 跳转 `ch01.html?level=l1`，L1 显示，L2-L4 隐藏 |
| 3 | URL 参数覆盖 localStorage | localStorage 为 l3，访问 `?level=l1` | 显示 L1，localStorage 不变 |
| 4 | 按钮点击更新 URL | L1 模式下点击"📚 精读" | URL 变为 `?level=l2`，显示 L2，localStorage 更新 |
| 5 | 章节导航保持 L1 | ch05.html?level=l1，点击"第6章 →" | 跳转 `ch06.html?level=l1` |
| 6 | 回到首页 L1 模式 | L1 章节页点击"回到主页" | 跳转 `l1/index.html`（不是主首页） |
| 7 | 正常模式不受影响 | 不带参数访问 `ch01.html` | 默认 L2，nav 链接无 `?level=` |
| 8 | 刷新保持 | `ch03.html?level=l1` 刷新 | 仍显示 L1 |
| 9 | 聊天天同步 | L1 模式切换聊天层级按钮 | 聊天显示 L1 高亮，发送消息带 level=L1 |
| 10 | 本地 file:// 测试 | 用浏览器打开 `l1/index.html` | 功能正常（无 CORS 问题） |

---

## 九、后续扩展可能

本方案为未来扩展预留了空间：

1. **路径前缀方案升级**：后续可在 Vercel 配置 rewrites，使 `/l1/chapters/ch01` 映射到 `/chapters/ch01.html?level=l1`，实现更干净的 URL
2. **L1 独享域名**：如需独立部署 L1 站点（如 kids.hui-skill.org），可基于 `?level=l1` 模式生成静态快照
3. **其他层级同理**：L3/L4 也可复用相同的 URL 参数机制
4. **SEO 优化**：为 L1 页面添加 canonical 标签指向主版本

---

## 十、总结

本方案通过 **约 200 行 JS 改动 + 2 个新文件 + 2 个文件微调**，在不拆分章节内容、不引入构建工具的前提下，实现了 L1 层级的 URL 路由模式切换。核心原则是：

- **最小侵入**：81 个章节文件零改动
- **渐进增强**：URL 参数只是增强，不破坏现有功能
- **独立首页**：`l1/index.html` 为儿童用户提供专属入口
- **上下文保持**：导航链接自动携带层级参数
