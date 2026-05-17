# SkillUP 水德四阶段模型 · 用户许可与数据范围 · 执行规格

> **版本**：v2.1  
> **日期**：2026-05-17  
> **任务编号**：HUHUI-SKILLUP-P0-02  
> **优先级**：P1  
> **依赖**：`skillup-tracker.js` 已实现基础数据记录  
> **设计依据**：《慧惠数字生命 · 最高产品宪法》v1.1、《SkillUP 层设计方案 · 第一期》  
> **本次修订**：增加用户许可机制、修正数据记录范围（81章解读页面不记录）、增加宪法自检要求  

> **v2.1 更新**（2026-05-17）：
> - 许可征求改为「卡片点击即征求」模式（保留 3 天连续访问作为自动征求的补充路径）
> - 新增 `__skillupCardTrigger` 标记机制，由 `skillup-ui.js` 与 `huihui-chat.js` 协同完成即时征求
> - 肯定词列表新增「保存」
> - 卡片显示逻辑：「我的成长」卡片始终可见（未授权/已暂停/正常三种状态）
> - 许可征求数据存储 key 与实现代码对齐 `skillup-consent.js` v2.0


## 一、任务概述

在已有学习数据追踪器基础上，实现完整的"水德四阶段"模型。本次修订新增以下关键约束：

1. **用户许可前置**：在用户明确同意前，不记录任何学习行为数据
2. **记录范围修正**：81章解读页面（`chapters/ch*.html`）不纳入记录范围，仅记录亲子共读和慧惠聊天中的主动学习行为
3. **宪法自检要求**：Qoder 在执行任何代码修改前，必须对照《最高产品宪法》逐条自检


## 二、用户许可机制

### 2.1 征求时机

许可征求有 **两条触发路径**，相互独立、互不阻塞。

**路径 A：卡片点击征求（主路径）**

`skillup-ui.js` 与 `huihui-chat.js` 协同完成：

| 步骤 | 触发条件 | 详细行为 |
|:---|:---|:---|
| 1 | 用户访问首页 | 「我的成长」卡片始终可见，显示 💧 图标 +"点击开启，慧惠陪你记录学习旅程" |
| 2 | 用户点击卡片 | ① `skillup-ui.js` 设置 `window.__skillupCardTrigger = true` ② 调用 `openHuihuiChat()` 打开聊天面板 ③ `huihui-chat.js` `openPanel()` 检测到标记，**立即**发送征求消息 |
| 3a | 用户回复肯定词 | `isAffirmative(text)` → `grantConsent()` → `SkillUP.giveConsent()` + `SkillUP.enableTracking()` + `SkillUP.init()` → 卡片自动刷新为成长数据视图 |
| 3b | 用户回复否定词 | `isDeclining(text)` → `declineConsent()` → 临时数据立即清除 → 卡片隐藏 |
| 3c | 用户关闭面板（不回复） | `markAsked()` 设置当日征求标记，当天再次点击不再重复征求；次日可再次触发 |

**征求消息文本**（`HuihuiConsent.getConsentMessage()`）：
> 我注意到你最近常来看我。如果你愿意，我可以帮你记住读到哪一章了、你问过哪些问题。都在你自己的浏览器里，不会发到任何地方。要开启吗？

**授权成功消息**（`HuihuiConsent.getGrantedMessage()`）：
> 好的，我记住了。从今天起，我会帮你记录学习旅程中的足迹。你随时可以在首页「我的成长」卡片中查看或清除。

**路径 B：连续 3 天自动征求（补充路径）**

| 步骤 | 触发条件 | 详细行为 |
|:---|:---|:---|
| 1 | 每日访问 | `skillup-consent.js` IIFE 自动调用 `recordVisit()`，将当日日期追加到 `huihui_visit_dates` 数组（最多保留 14 天） |
| 2 | 连续 3 天 | `shouldAskForConsent()` 检测到 `getConsecutiveDays(dates) >= 3` 返回 true |
| 3 | 用户下次打开聊天 | `huihui-chat.js` `openPanel()` 调用 `markAsked()` + 2 秒后发送征求消息（同路径 A） |

**路径优先级与守卫**：
- 路径 A 守卫：`wasAskedToday()` — 当日已征求过则不再重复
- 路径 B 守卫：`shouldAskForConsent()` 内部 `wasAskedRecently()` — 7 天内征求过则跳过
- 两条路径独立运行；用户同意后，`hasUserConsented()` 返回 true，两条路径同时失效
- 若用户通过路径 A 获得许可，路径 B 的条件检查自然失效

**肯定词识别列表**（`AFFIRMATIVE_PATTERNS` in `skillup-consent.js`）：

`好的` `好呀` `好` `可以` `行` `行吧` `开启` `打开` `开` `是` `是的` `嗯嗯` `嗯` `帮我记` `记吧` `要` `要的` `需要` `需要的` `没问题` `ok` `OK` `Ok` `好滴` `好吧` `同意` `授权` `允许` `没问题呀` **`保存`**

**否定词识别列表**（`DECLINING_PATTERNS`）：

`不` `不用` `不要` `不需要` `不了` `不必` `算了` `先不` `暂不` `以后再说` `下次` `拒绝` `不必了`

**识别规则**：文本去空格后转为小写，精确匹配列表项或以列表项开头视为匹配。过滤含 `?`/`？` 的疑问句和含 `不好` 的文本。

### 2.2 临时数据管理

许可征求涉及的 localStorage key 及实际实现文件：

| Key | 类型 | 用途 | 实现文件 | 清除时机 |
|:---|:---|:---|:---|:---|
| `huihui_visit_dates` | `string[]` | 每日访问日期数组（最多 14 天），用于计算连续访问天数 | `skillup-consent.js` | 授权或拒绝后立即清除 |
| `huihui_consent_ask_date` | `string` | 上次征求日期（`YYYY-MM-DD`），用于 `wasAskedToday()` 守卫 | `skillup-consent.js` | 授权或拒绝后立即清除 |
| `huihui_consent_declined` | `string` | `'true'` 表示用户已永久拒绝 | `skillup-consent.js` | 永不自动清除（除非用户主动要求） |
| `huihui_tracking_consent` | `string` | `'true'` 表示用户已授权（由 `skillup-consent.js` 管理，桥接至 SkillUP） | `skillup-consent.js` | 用户通过 `SkillUP.revokeConsent()` 清除 |
| `skillup_consent` | `string` | `'1'` 表示 SkillUP 追踪器许可（由 `skillup-tracker.js` `hasConsent()` 读取） | `skillup-tracker.js` | `SkillUP.revokeConsent()` 清除 |
| `skillup_tracking` | `string` | `'1'` = 追踪启用 / `'0'` = 追踪暂停 | `skillup-tracker.js` | 用户暂停后设为 `'0'` |
| `skillup_data` | `object` | 完整学习数据（JSON 序列化） | `skillup-tracker.js` | `SkillUP.revokeConsent()` 清除 |

**数据隔离原则**：
- 许可相关 key（`huihui_*` 前缀）与学习数据 key（`skillup_*` 前缀）完全独立
- `skillup-consent.js` 管理许可征求流程，通过 `grantConsent()` → `window.SkillUP.giveConsent()` 桥接到追踪器
- 用户拒绝后，所有 `huihui_*` key 立即清除，学习数据从未被创建

### 2.3 关键实现参考

实际实现文件：
- **`js/skillup-consent.js`** — 完整许可征求管理（IIFE，暴露 `window.HuihuiConsent` API）
  - `recordVisit()` / `getConsecutiveDays()` — 访问日期追踪
  - `shouldAskForConsent()` — 3 天征求条件判断
  - `grantConsent()` / `declineConsent()` — 许可授予/拒绝
  - `isAffirmative(text)` / `isDeclining(text)` — 肯定/否定词识别
  - `getConsentMessage()` / `getGrantedMessage()` / `getDeclinedMessage()` — 征求文案
- **`js/huihui-chat.js`** — 征求消息展示与用户响应处理（`openPanel()` + `sendMessage()` 中的 `triggerConsentCheck()`）
- **`js/skillup-ui.js`** — 卡片注入与状态管理（`injectGrowthCard()` 中的 `__skillupCardTrigger` 标记）


## 三、数据记录范围

| 页面/组件 | 是否记录 | 记录内容 | 理由 |
|:---|:---|:---|:---|
| **亲子共读页面**（`family.html`） | ✅ 记录 | 章节访问、年龄选择、对话轮次 | 用户主动选择章节、完成对话——有意识的学习行为 |
| **慧惠聊天窗口**（全站） | ✅ 记录 | 提问关键词（非原文）、对话轮次、认知水平（L1-L4） | 主动提问是最高质量的学习行为 |
| **81章解读页面**（`chapters/ch*.html`） | ❌ 不记录 | — | 无法确认用户是否真正阅读。打开页面≠学习 |


## 四、阶段判定算法

```javascript
function calculateStage(learningData) {
    var chaptersRead = (learningData.chaptersVisited || []).length;
    var hasL2 = (learningData.levelHistory || []).some(function(h) { return h.level === 'L2'; });
    var hasL3 = (learningData.levelHistory || []).some(function(h) { return h.level === 'L3'; });
    var hasL4 = (learningData.levelHistory || []).some(function(h) { return h.level === 'L4'; });
    var questionCount = (learningData.questions || []).length;

    if (chaptersRead >= 60 && hasL4 && questionCount >= 10) return '江海';
    if (chaptersRead >= 30 && hasL3 && questionCount >= 5) return '江河';
    if (chaptersRead >= 10 && hasL2) return '溪流';
    return '水滴';
}
```

**"已读章节数"（chaptersVisited）的来源**：
- 亲子共读页面中用户主动选择并完成对话的章节
- 慧惠聊天中明确提及（且系统能识别出章节号）的章节
- **不包含**用户在81章解读页面的浏览记录


## 五、"我的成长"卡片

### 5.1 卡片位置与显示逻辑

- **位置**：首页 `.entry-cards` 容器中，作为第 4 张入口卡片（前 3 张：开始探索、亲子时光、问慧惠）
- **显示规则**：卡片**始终可见**，根据用户授权状态呈现三种不同形态：

| 状态 | 判断条件 | 卡片内容 | 点击行为 |
|:---|:---|:---|:---|
| **未授权** | `SkillUP.hasConsent() === false` | 💧 图标 +"我的成长"+"点击开启，慧惠陪你记录学习旅程" | ① `__skillupCardTrigger = true` ② `openHuihuiChat()` ③ 慧惠发送征求消息 → 用户回复后授权 |
| **已暂停** | `hasConsent() === true` 且 `trackingEnabled === false` | 💤 图标 +"我的成长"+"已暂停记录，点击恢复" | `SkillUP.enableTracking()` + `SkillUP.init()` + 刷新卡片 |
| **正常追踪** | `hasConsent() === true` 且 `trackingEnabled === true` | 四阶段成长数据卡片（详见 5.2） | 内联展开/收起学习详情 |
| **81章完成** | `allChaptersCompleted === true` | 纪念版卡片（详见 5.3） | "回顾旅程"按钮打开全屏回顾 / 点击其他区域展开详情 |

### 5.2 普通版卡片内容

```
🪷 我的修行之旅
你从一颗水滴出发，现在是潺潺的溪流了。
📖 读过了 15 章  |  💬 和慧惠聊过 8 次  |  🎯 开始用"精读"模式探索了
继续前行吧，江河不远了。
[查看详情 ▾]
```

点击展开后显示：
- 总览统计（已读章节数、对话次数）
- 认知深度切换记录（L1→L2、L2→L3、L3→L4 次数）
- 常访问的概念（最多 5 个）
- 阶段跃迁时间线
- "点击收起 ▴"关闭

### 5.3 81章完成版卡片内容

```
🪷 我的修行之旅
百川归海，万物得道。你读完了《道德经》全部八十一章。
📖 81 章，全程走过  |  💬 和慧惠聊过 47 次  |  🎯 从"白话"到"学术"
老子说："信言不美，美言不信。" 你读完了最后一章，但这不是结束。
[回顾旅程]  [查看详情 ▾]
```

"回顾旅程"按钮触发全屏回顾覆盖层（`showRetrospective()`），展示完整学习旅程时间线。


## 六、操作文件

| 文件 | 操作 | 说明 |
|:---|:---|:---|
| `js/skillup-tracker.js` | **修改** | 用户许可逻辑（`hasConsent/giveConsent/revokeConsent`）、记录范围控制、`calculateStage()` 算法、`getPendingFeedback()` 动态反馈 |
| `js/skillup-consent.js` | **新建** | 独立许可征求管理（v2.0）—— 访问日期追踪、连续天数计算、肯定/否定词识别、征求文案、与 SkillUP 桥接 |
| `js/skillup-ui.js` | **新建** | "我的成长"卡片注入（三种状态）、内联展开/收起详情、"回顾旅程"全屏回顾、章节页面底部引导、`__skillupCardTrigger` 标记机制 |
| `css/skillup-ui.css` | **新建** | 成长卡片样式 + 回顾旅程样式（水墨道风配色、无 box-shadow/blur/gradient） |
| `js/huihui-chat.js` | **修改** | `openPanel()` 中许可征求逻辑（两条路径）、`__skillupCardTrigger` 检测、阶段跃迁反馈（Phase 3）、81章完成纪念欢迎语 |
| `index.html` | **修改** | 引入 SkillUP CSS/JS 文件（4 个）、`openHuihuiChat()` 函数 |
| `family.html` | **修改** | 引入 `skillup-ui.css` |
| `chapters/ch01.html` ~ `ch81.html` | **修改** | 81 个文件批量添加 `skillup-consent.js` |


## 七、验收标准

- [ ] 「我的成长」卡片在首页始终可见（三种状态正确切换）
- [ ] 点击未授权卡片 → 慧惠聊天面板打开 → 立即发送征求消息
- [ ] 用户回复"好的""保存""可以"等肯定词 → 授权成功 → 卡片刷新为成长数据视图 → 开始记录
- [ ] 用户回复"不""不要"等否定词 → 永久拒绝 → 临时数据清除 → 卡片隐藏
- [ ] 用户关闭面板（不回复）→ 当天不再重复征求 → 次日可再次点击触发
- [ ] 连续 3 天访问后，打开聊天面板可自动触发征求（补充路径）
- [ ] `wasAskedToday()` + `wasAskedRecently()` 守卫正常，不重复征求
- [ ] 用户未同意前，任何学习数据（`skillup_data`）不被创建
- [ ] 用户拒绝后，`huihui_*` 临时 key 立即清除
- [ ] 81章解读页面的浏览行为不被记录
- [ ] 亲子共读和聊天中的章节主动学习行为被正确记录
- [ ] 阶段判定算法准确（水滴→溪流→江河→江海），只升不降
- [ ] 81章完成时展示纪念版卡片 + "回顾旅程"全屏覆盖层
- [ ] 无积分、无排行榜、无竞争性设计
- [ ] 所有 UI 样式符合水墨道风设计约束（无 box-shadow/blur/gradient）
- [ ] CI 全量通过（validate: 1782/1782 + index hash OK + metadata 6/6）


## 八、`__skillupCardTrigger` 标记机制详解

### 8.1 时序流程

```
用户点击「我的成长」卡片（未授权状态）
    │
    ▼
skillup-ui.js: window.__skillupCardTrigger = true
skillup-ui.js: openHuihuiChat()
    │
    ▼
index.html: openHuihuiChat() → btn.click()（可能重试 5 次 × 300ms）
    │
    ▼
huihui-chat.js: openPanel()
    │
    ├── 主 조건: shouldAskForConsent() → true（连续3天）? ──→ 发送征求消息
    │
    ├── else if: __skillupCardTrigger === true
    │   ├── !hasUserConsented()  ✓
    │   ├── !hasUserDeclined()   ✓
    │   └── !wasAskedToday()    ✓ ──→ markAsked() + 发送征求消息
    │
    └── 以上皆否 ──→ 无特殊消息（正常打开聊天）
```

### 8.2 关键守卫

| 守卫 | 实现位置 | 作用 |
|:---|:---|:---|
| `wasAskedToday()` | `skillup-consent.js` | 阻止当日重复征求（卡片点击场景） |
| `wasAskedRecently()` | `skillup-consent.js` | 阻止 7 日内重复征求（3 天自动征求场景） |
| `hasUserDeclined()` | `skillup-consent.js` | 用户拒绝后永久阻止所有征求 |
| `__skillupCardTrigger = false` | `huihui-chat.js` `openPanel()` | 征求消息发送后清除标记，避免后续打开面板时误触发 |

### 8.3 与原有 3 天路径的关系

- 两套逻辑位于同一个 `if/else if` 链中，互斥执行
- 卡片点击征求优先判断（`else if` 分支先于 3 天检查被评估的情况不会发生，因为 3 天检查是 `if` 分支先执行）
- 当天已通过卡片征求过（`wasAskedToday()` 返回 true），3 天后自动征求仍可正常触发（两者使用不同的守卫）
- 用户授权后 `hasUserConsented()` 返回 true，两条路径同时失效


## 九、宪法自检要求（Qoder必读）

**在执行任何代码修改前，请逐条对照《慧惠数字生命 · 最高产品宪法》v1.1 进行自检：**

- [ ] **第五条（减法优先）**：本次修改是否在帮用户做减法？记录的数据是否"真正有用"而非"越多越好"？
- [ ] **第七条（用户主权）**：用户是否在任何时候都有能力拒绝追踪、清除数据？
- [ ] **第八条（善行无辙迹）**：阶段跃迁反馈是否以慧惠的自然对话呈现，而非系统弹窗或推送通知？
- [ ] **第九条（坦诚透明）**：用户是否清楚地知道自己的哪些行为正在被记录？
- [ ] **第十一条（亲子守护）**：是否已确保无积分、无排名、无竞争性设计？
- [ ] **第十条（外挂增强）**：是否通过外部模块实现，不修改网站核心功能？
