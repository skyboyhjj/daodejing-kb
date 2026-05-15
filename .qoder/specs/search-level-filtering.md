# 搜索层级过滤实现方案

## Context

当前 `search.js` 已能读取用户的认知层级（URL `?level=` → localStorage → null），并在搜索结果链接中携带 `?level=` 参数。但 `searchAll()` 不对结果做层级过滤——用户在 L1 模式下搜索仍然看到 L4 学术内容。同时搜索索引 `search-data.js` 缺少 `levels` 元数据字段。

**目标**：为搜索索引添加 `levels` 元数据，使搜索结果可根据当前层级过滤，同时保持向后兼容。

**关键事实**：当前全部81章均包含 L1-L4 四个层级内容，因此层级过滤在现阶段不会排除任何章节——但基础设施为未来可能的不完整层级内容做好了准备。

---

## 数据流

```
Chapter HTML (data-level="l1|l2|l3|l4")
        │
        ▼  extractLevels()
  build-index.js  ──────────────▶  search-data.js (新增 levels 数组)
        │                                    │
        ▼                                    ▼
  search-index.json                   search.js
                                       │  getCurrentLevel()
                                searchAll(query, filterLevel)
                                       │  filter by hit.levels
                                renderResults() → UI (badge + ?level=)
```

---

## 修改文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `scripts/build-index.js` | 新增函数 + 结构变更 | 添加 `extractLevels()`，章节/概念条目增加 `levels` 字段 |
| `data/search-data.js` | 自动生成 | 运行 `build-index.js` 重新生成（含 `levels`） |
| `data/search-index.json` | 自动生成 | 同上 |
| `js/search.js` | 逻辑增强 | `searchAll()` 接受 `filterLevel` 参数，`init()` 传入层级，`renderResults()` 显示层级标签 |
| `css/daodejing-styles.css` | 样式新增 | `.search-levels` 标签样式 |

---

## Step 1: `scripts/build-index.js` — 添加层级提取

### 1a. 新增 `extractLevels(html)` 函数

位置：放在现有 `extractConcepts()` 之后（约第83行）

```javascript
/**
 * 提取章节支持的认知层级
 * 扫描 data-level="l1|l2|l3|l4" 属性
 * 默认所有层级均支持（防御性回退）
 */
function extractLevels(html) {
    var levels = [];
    var re = /data-level="(l[1-4])"/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var lv = m[1];
        if (levels.indexOf(lv) === -1) levels.push(lv);
    }
    // 防御：若 HTML 中无层级标记，默认全部支持
    if (levels.length === 0) {
        levels = ['l1', 'l2', 'l3', 'l4'];
    }
    levels.sort();  // 保证输出顺序一致
    return levels;
}
```

### 1b. 章节条目添加 `levels` 字段

在 `chapters.push({...})` 块中（约第165行），新增一行：

```javascript
levels: extractLevels(html),
```

### 1c. 概念条目添加 `levels` 字段

在 `concepts.push({...})` 块中（约第194行），新增一行：

```javascript
levels: ['l1', 'l2', 'l3', 'l4'],
```

概念页面无 `data-level` 属性（对所有层级适用），硬编码全层级。

---

## Step 2: 重新生成搜索索引

```bash
node scripts/build-index.js
```

验证输出：
- `data/search-data.js`：每个章节/概念条目均含 `"levels":["l1","l2","l3","l4"]`
- `data/search-index.json`：同上

---

## Step 3: `js/search.js` — 三层修改

### 3a. `searchAll()` 携带 `levels` 到命中条目

在构建章节 hit 对象时（约第181-190行），新增 `levels` 字段：

```javascript
hits.push({
    type: 'chapter',
    num: ch.num,
    title: '第' + ch.num + '章 · ' + ch.title,
    url: ch.url,
    snippet: snippet,
    score: score,
    concepts: ch.concepts || [],
    levels: ch.levels || ['l1', 'l2', 'l3', 'l4']  // NEW
});
```

在构建概念 hit 对象时（约第206-213行），新增：

```javascript
levels: concept.levels || ['l1', 'l2', 'l3', 'l4']  // NEW
```

### 3b. `searchAll()` 接受可选 `filterLevel` 参数

修改函数签名：

```javascript
function searchAll(query, filterLevel) {
```

在 `hits.sort(...)` 之后、`.slice(0, DROPDOWN_MAX)` 之前，插入过滤逻辑：

```javascript
// 层级过滤（向后兼容：filterLevel 为 null/undefined/"all" 则不过滤）
if (filterLevel && filterLevel !== 'all') {
    hits = hits.filter(function (h) {
        return h.levels && h.levels.indexOf(filterLevel) !== -1;
    });
}
```

### 3c. `renderResults()` 显示层级标签

在 `renderResults()` 的结果 HTML 中添加层级可用性标签。在 concept-tags 之后、snippet 之前（约第298行），添加：

```javascript
// 层级可用性标签
var levelsHtml = '';
if (h.levels && h.levels.length) {
    levelsHtml = '<span class="search-levels" title="可用认知深度">';
    if (h.levels.length >= 4) {
        levelsHtml += 'L1–L4';
    } else {
        levelsHtml += h.levels.map(function(l) { return l.toUpperCase(); }).join(', ');
    }
    levelsHtml += '</span>';
}
```

### 3d. `init()` 传入当前层级

在 `init()` 函数的搜索调用处（约第341行），修改为：

```javascript
var currentLevel = getCurrentLevel();
var hits = searchAll(q, currentLevel);
```

### 3e. 监听层级变化事件（可选增强）

在 `init()` 中添加 `huihui-level-changed` 事件监听，使用户切换层级后搜索结果自动同步：

```javascript
window.addEventListener('huihui-level-changed', function () {
    var q = input.value.trim();
    if (!q) return;
    loadIndex().then(function () {
        if (!data) return;
        var currentLevel = getCurrentLevel();
        var hits = searchAll(q, currentLevel);
        var tokens = tokenize(t2s(q));
        renderResults(hits, tokens, results, base);
    });
});
```

---

## Step 4: CSS 样式

在 `css/daodejing-styles.css`（或就近的搜索相关样式区）添加：

```css
.search-levels {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    font-size: 0.72em;
    color: #888;
    border: 1px solid #ddd;
    border-radius: 3px;
    vertical-align: middle;
}
```

---

## Step 5: 测试验证

### 单元级验证

```bash
# 重建索引
node scripts/build-index.js

# 运行搜索测试
node scripts/test-search.js
```

新增测试用例：
1. 每个章节均含 `levels` 数组，至少含 `["l1","l2","l3","l4"]`
2. 每个概念均含 `levels: ["l1","l2","l3","l4"]`
3. `searchAll('道', 'l1').length === searchAll('道').length`（所有章节支持所有层级）
4. `searchAll('道', 'all').length === searchAll('道').length`
5. `searchAll('道', null).length === searchAll('道').length`
6. 命中条目携带 `levels` 数组

### 端到端验证

1. 打开 `chapters/ch01.html?level=l2` → 搜索"道" → 确认结果含 `L1–L4` 标签 → 点击结果 → URL 含 `?level=l2`
2. 打开 `chapters/ch01.html?level=all` → 搜索 → 全部结果显示
3. 无 `?level=` 参数 → 搜索 → 全部结果显示（向后兼容）
4. 切换层级选择器按钮 → 搜索结果自动同步（若实现了3e）

---

## 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 章节 HTML 无 `data-level` 属性 | `extractLevels()` 回退为 `["l1","l2","l3","l4"]` |
| 旧版 search-data.js 无 `levels` 字段 | `searchAll()` 将缺失视为全层级支持 |
| level-filter.js 未加载 | `getCurrentLevel()` 直接从 URL/localStorage 读取，独立于 level-filter.js |
| `level=all` | 不过滤，全部结果展示 |
| 无效 level 值 | `getCurrentLevel()` 校验白名单，无效值返回 null → 不过滤 |
| 概念页面（无层级分割） | 硬编码全层级 `["l1","l2","l3","l4"]`，始终出现在所有层级搜索中 |

---

## 向后兼容性保证

1. `searchAll(query)` 单参数调用仍然有效（`filterLevel` 为 `undefined`，不过滤）
2. `renderResults()` 的 `?level=` URL 追加逻辑不变
3. 已有搜索结果样式不变，仅新增可选标签
4. 搜索索引的 JSON 结构仅增加字段，不删除或重命名现有字段
