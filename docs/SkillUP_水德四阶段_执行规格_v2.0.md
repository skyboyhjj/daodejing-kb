# SkillUP 水德四阶段模型 · 执行规格 v2.0

> **版本**：v2.0（代码同步版）  
> **日期**：2026-05-18  
> **源码参考**：`js/skillup-tracker.js` v2.0  
> **状态**：生产就绪  
> **上一版偏差**：v1.0 设计文档与早期实现存在 12 处偏差（记录于 AGENTS.md），v2.0 已全部修正。

---

## 一、概述

SkillUP 认知成长追踪器是慧惠项目的学习行为记录与成长可视化系统。以"水德"为隐喻，追踪用户从初次接触到融会贯通的全过程。

**核心原则**：
- 零评分、零排名、零比较（宪法第七条、第十五条）
- 用户许可前置（`skillup-consent.js`）
- 81 章解读页面不记录浏览行为（仅记录主动学习行为）
- 数据完全存储于 `localStorage`，不上传服务器

---

## 二、水德四阶段成长模型

### 2.1 阶段定义

| 阶段 | 图标 | 阅读章节数 | 描述 |
|:---|:---|:---|:---|
| **水滴** 💧 | 0-10 | `0` ~ `10` | 初探道德经，每一章都是新发现。 |
| **溪流** 💦 | 11-30 | `11` ~ `30` | 积累与串联，老子的话语开始慢慢汇入你的生活。 |
| **江河** 🌊 | 31-60 | `31` ~ `60` | 实践与思辨，你开始从不同角度理解和应用老子的智慧。 |
| **江海** 🪷 | 61+ | `61` ~ `∞` | 贯通与分享，你在《道德经》的世界里自由徜徉。 |

### 2.2 阶段判定算法（`calculateStage`）

阶段判定使用三维综合指标，非单一章节数阈值：

```javascript
function calculateStage(learningData) {
    var chaptersRead = (learningData.chaptersVisited || []).length;       // 已读章节数
    var hasL2 = levelHistory 中有 L2 记录;                                 // 是否使用过精读模式
    var hasL3 = levelHistory 中有 L3 记录;                                 // 是否使用过应用模式
    var hasL4 = levelHistory 中有 L4 记录;                                 // 是否使用过学术模式
    var questionCount = (learningData.questions || []).length;             // 提问次数

    // 江海：覆盖 ≥60 章，且使用过 L4 模式，提问 ≥10 次
    if (chaptersRead >= 60 && hasL4 && questionCount >= 10) return '江海';

    // 江河：覆盖 ≥30 章，且使用过 L3 模式，提问 ≥5 次
    if (chaptersRead >= 30 && hasL3 && questionCount >= 5) return '江河';

    // 溪流：覆盖 ≥10 章，且使用过 L2 模式
    if (chaptersRead >= 10 && hasL2) return '溪流';

    // 水滴：默认阶段
    return '水滴';
}
```

**判定维度权重**：

| 维度 | 水滴→溪流 | 溪流→江河 | 江河→江海 |
|:---|:---|:---|:---|
| 已读章节数 | ≥10 | ≥30 | ≥60 |
| 认知深度 | 使用过 L2 | 使用过 L3 | 使用过 L4 |
| 提问次数 | — | ≥5 | ≥10 |

**重要约束**：阶段只升不降。`recordStageTransition()` 内部检查 `newIdx > oldIdx`，确保跃迁不可逆。

---

## 三、数据模型

### 3.1 存储结构（`localStorage` key: `skillup_data`）

```javascript
{
    uid: string,                        // 用户标识（与 huihui-chat 共享 huihui_uid）
    lastVisit: string | null,           // ISO 8601 最后访问时间
    dailyVisits: string[],              // 每日访问日期数组 ['2026-05-10', '2026-05-12']
    chaptersVisited: string[],          // 已访问章节列表 ['ch01', 'ch08', 'ch02']
    totalChaptersRead: number,          // 独立计数（等于 chaptersVisited.length）
    currentStage: '水滴' | '溪流' | '江河' | '江海',
    levelHistory: Array<{               // 认知水平切换历史
        date: string,                   // 'YYYY-MM-DD'
        level: 'L1' | 'L2' | 'L3' | 'L4'
    }>,
    questions: Array<{                  // 用户提问记录
        chapter: string | null,         // 'ch08' 或 null
        level: 'L1' | 'L2' | 'L3' | 'L4',
        keyword: string,                // 提取的核心概念关键词
        timestamp: string               // ISO 8601
    }>,
    trackingEnabled: boolean,           // 追踪开关
    stageHistory: Array<{               // v2.0: 阶段跃迁历史
        from: string,
        to: string,
        timestamp: string,
        trigger: string
    }>,
    lastStageCheck: string | null,      // v2.0: 上次阶段检查时间
    allChaptersCompleted: boolean,      // v2.0: 81章完成标记
    allChaptersCompletedAt: string | null  // v2.0: 完成时间戳
}
```

### 3.2 数据迁移兼容

v2.0 兼容旧版数据格式，自动迁移：
- 旧版 `chapterVisits`（对象格式）→ `chaptersVisited`（数组格式）
- 旧版 `messages` → `questions`（含 keyword 提取）
- 缺失字段自动补全默认值

### 3.3 数据记录范围

| 页面/组件 | 是否记录 | 记录内容 |
|:---|:---|:---|
| **亲子共读**（`family.html`） | ✅ | 章节访问、年龄选择、对话轮次 |
| **慧惠聊天**（全站） | ✅ | 提问关键词、对话轮次、认知水平切换 |
| **81章解读页面**（`chapters/ch*.html`） | ❌ | 不自动记录（页面浏览 ≠ 学习行为） |

---

## 四、触发规则（4 条）

### 4.1 规则 1：首次阅读第 8 章后（`checkTriggerCh8Milestone`）

| 项目 | 内容 |
|:---|:---|
| **触发条件** | `totalChaptersRead >= 3` 且 `currentStage === '水滴'` |
| **防重复** | `_triggeredCh8` 标记（写入 `skillup_data`） |
| **反馈消息** | "你已经读了三章了。有没有感觉到，老子的智慧像水一样，开始慢慢流进了你的生活？" |

### 4.2 规则 2：切换到 L3 后（`checkTriggerL3Switch`）

| 项目 | 内容 |
|:---|:---|
| **触发条件** | `levelHistory` 最新记录为 L3 且 `currentStage === '溪流'` |
| **防重复** | `_triggeredL3` 标记 |
| **反馈消息** | "你开始从'怎么做'的角度思考了。这是从'知道'到'做到'的重要一步。要不要试试第33章？那里有很多关于实践的建议。" |

### 4.3 规则 3：连续三天访问（`checkTriggerConsecutiveDays`）

| 项目 | 内容 |
|:---|:---|
| **触发条件** | `连续天数 >= 3`（真正的连续检测——最近一次访问必须是今天或昨天，否则连续性已断） |
| **防重复** | 每日一次（`_triggeredConsecutive === today`） |
| **反馈消息** | "你已经是连续第{n}天来找我了。这份坚持本身就是一种修行。今天我们读哪一章？" |

**连续天数算法**：
1. 对 `dailyVisits` 日期字符串排序
2. 最近一次必须是今天或昨天
3. 从最近日期往前数，逐日递减检查连续性
4. 中断则停止计数

### 4.4 规则 4：用户主动查询进度（`checkProgressQuery`）

| 项目 | 内容 |
|:---|:---|
| **触发条件** | 用户消息匹配 `/我学得怎么样|我的成长|学习进度|学习情况|成长情况|学到哪|读了哪些|修行到哪/` |
| **防重复** | 无（每次查询均响应，但仅匹配精确关键词，不含问号的消息） |
| **反馈消息** | 含阶段图标、已读章节数、阶段名、连续天数、常问概念 |

---

## 五、用户许可机制

### 5.1 架构

许可管理由独立的 `js/skillup-consent.js`（IIFE，暴露 `window.HuihuiConsent`）实现，与 `js/skillup-tracker.js`（暴露 `window.SkillUP`）通过桥接模式协作：

```
skillup-consent.js (许可征求管理)
    │  grantConsent() → window.SkillUP.giveConsent()
    │  declineConsent() → 清除临时 key
    ▼
skillup-tracker.js (数据追踪)
    │  hasConsent() → 读取 'skillup_consent' key
    │  isTrackingEnabled() → 'skillup_consent' + 'skillup_tracking'
    ▼
localStorage
```

### 5.2 两条征求路径

**路径 A：卡片点击征求（主路径）**

| 步骤 | 触发 | 行为 |
|:---|:---|:---|
| 1 | 用户访问首页 | 「我的成长」卡片始终可见 |
| 2 | 点击未授权卡片 | `skillup-ui.js` 设置 `__skillupCardTrigger = true` → 打开聊天面板 → 慧惠发送征求消息 |
| 3a | 回复肯定词 | `grantConsent()` → 卡片刷新为成长数据视图 |
| 3b | 回复否定词 | `declineConsent()` → 临时数据清除 |
| 3c | 关闭面板 | `markAsked()` → 当天不再重复征求 |

**征求消息**：
> 我注意到你最近常来看我。如果你愿意，我可以帮你记住读到哪一章了、你问过哪些问题。都在你自己的浏览器里，不会发到任何地方。要开启吗？

**肯定词列表**（28 个）：`好的` `好呀` `好` `可以` `行` `行吧` `开启` `打开` `开` `是` `是的` `嗯嗯` `嗯` `帮我记` `记吧` `要` `要的` `需要` `需要的` `没问题` `ok` `OK` `Ok` `好滴` `好吧` `同意` `授权` `允许` `没问题呀` `保存`

**否定词列表**（13 个）：`不` `不用` `不要` `不需要` `不了` `不必` `算了` `先不` `暂不` `以后再说` `下次` `拒绝` `不必了`

**路径 B：连续 3 天自动征求（补充路径）**

| 步骤 | 触发 | 行为 |
|:---|:---|:---|
| 1 | 每日访问 | `skillup-consent.js` IIFE 调用 `recordVisit()` |
| 2 | 连续 3 天 | `shouldAskForConsent()` 返回 true |
| 3 | 下次打开聊天 | 发送征求消息（同路径 A） |

### 5.3 守卫机制

| 守卫 | 作用 |
|:---|:---|
| `wasAskedToday()` | 阻止当日重复征求（卡片点击场景） |
| `wasAskedRecently()` | 阻止 7 日内重复征求（3 天自动征求场景） |
| `hasUserDeclined()` | 用户拒绝后永久阻止所有征求 |
| `__skillupCardTrigger` | 卡片触发标记，发送后清除防止误触发 |

### 5.4 localStorage Key 一览

| Key | 类型 | 用途 | 清除时机 |
|:---|:---|:---|:---|
| `huihui_visit_dates` | `string[]` | 每日访问日期 | 授权或拒绝后 |
| `huihui_consent_ask_date` | `string` | 上次征求日期 | 授权或拒绝后 |
| `huihui_consent_declined` | `string` | 永久拒绝标记 | 永不自动清除 |
| `huihui_tracking_consent` | `string` | 许可桥接标记 | `SkillUP.revokeConsent()` |
| `skillup_consent` | `string` | SkillUP 许可 | `SkillUP.revokeConsent()` |
| `skillup_tracking` | `string` | 追踪启用/暂停 | `SkillUP.disableTracking()` |
| `skillup_data` | `object` | 完整学习数据 | `SkillUP.revokeConsent()` |

---

## 六、"我的成长"卡片

### 6.1 三种显示状态

| 状态 | 判断条件 | 卡片内容 | 点击行为 |
|:---|:---|:---|:---|
| **未授权** | `hasConsent() === false` | 💧 "我的成长" + "点击开启" | 触发许可征求 |
| **已暂停** | `hasConsent() && !trackingEnabled` | 💤 "我的成长" + "已暂停" | `enableTracking()` + 刷新卡片 |
| **正常追踪** | `hasConsent() && trackingEnabled` | 四阶段成长数据卡片 | 内联展开/收起详情 |
| **81章完成** | `allChaptersCompleted` | 纪念版卡片 | "回顾旅程"全屏回顾 |

### 6.2 内联展开内容

点击"查看详情 ▾"后展示：
- 总览统计（已读章节数、对话次数）
- 认知深度向上切换次数（L1→L2 / L2→L3 / L3→L4）
- 常访问的概念（最多 5 个）
- 阶段跃迁时间线
- "回顾旅程"按钮（81章完成后出现）

---

## 七、CSS 视觉效果规范

| 约束 | 要求 |
|:---|:---|
| **配色** | 水墨道风：`#2e5f5f`（墨绿）/ `#d4c9a8`（淡金）/ `#faf8f0`（宣纸） |
| **禁用** | `box-shadow`、`backdrop-filter: blur()`、`gradient` |
| **字体** | 系统默认中文字体栈 |
| **文件** | `css/skillup-ui.css` 独立样式文件 |

---

## 八、公开 API（`window.SkillUP`）

```javascript
window.SkillUP = {
    // 生命周期
    init: init,

    // 许可管理
    hasConsent: hasConsent,
    giveConsent: giveConsent,
    revokeConsent: revokeConsent,

    // 追踪控制
    isTrackingEnabled: isTrackingEnabled,
    enableTracking: enableTracking,
    disableTracking: disableTracking,

    // 数据记录
    recordChapterVisit: recordChapterVisit,           // 从 URL 检测章节
    recordChapterVisitByNum: recordChapterVisitByNum, // 按章节号记录
    recordLevelSwitch: recordLevelSwitch,
    recordMessage: recordMessage,

    // 查询
    getGrowthSummary: getGrowthSummary,
    getMilestoneMessage: getMilestoneMessage,
    getChapterGuidance: getChapterGuidance,
    getPendingFeedback: getPendingFeedback,
    getCompletionWelcomeMessage: getCompletionWelcomeMessage,
    detectCurrentLevel: detectCurrentLevel,
    detectCurrentChapter: detectCurrentChapter,
    calculateStage: calculateStage,
    isAllChaptersCompleted: isAllChaptersCompleted,

    // 触发规则检测
    checkTriggerCh8Milestone: checkTriggerCh8Milestone,
    checkTriggerL3Switch: checkTriggerL3Switch,
    checkTriggerConsecutiveDays: checkTriggerConsecutiveDays,
    checkProgressQuery: checkProgressQuery,

    // 常量
    STAGES: STAGES,
    STAGE_ORDER: STAGE_ORDER
};
```

---

## 九、操作文件清单

| 文件 | 操作 | 说明 |
|:---|:---|:---|
| `js/skillup-tracker.js` | **核心** | 数据追踪器（IIFE，暴露 `window.SkillUP`） |
| `js/skillup-consent.js` | **新建** | 独立许可征求管理（暴露 `window.HuihuiConsent`） |
| `js/skillup-ui.js` | **新建** | "我的成长"卡片注入 + 内联展开 + 回顾旅程 |
| `css/skillup-ui.css` | **新建** | 水墨道风样式 |
| `js/huihui-chat.js` | **修改** | `openPanel()` 许可征求逻辑、反馈消息展示 |
| `index.html` | **修改** | 引入 SkillUP CSS/JS 文件 |
| `family.html` | **修改** | 引入 `skillup-ui.css` |

---

## 十、相对于 v1.0 的修正项（12 处偏差已修复）

| # | 偏差描述（AGENTS.md） | v2.0 修复状态 |
|:---|:---|:---|
| 1 | 成长模型隐喻：设计"水德"，实现为"植物" | ✅ 已修正为水德四阶段 |
| 2 | 阶段阈值：设计 10/30/60，实现 3/10/30 | ✅ 已修正为 10/30/60（附加认知深度+提问条件） |
| 3 | 触发规则缺失：设计 4 条，实现仅 2 条 | ✅ 4 条规则全部实现 |
| 4 | 连续天数：设计为真正连续检测，实现为首次至今差 | ✅ `calcConsecutiveDays` 实现真正连续检测 |
| 5 | 独立许可文件：设计要求 `skillup-consent.js` | ✅ 已创建独立文件 |
| 6 | 数据模型 keyword 字段：设计含 keyword 提取 | ✅ `CORE_KEYWORDS` + `extractKeyword` |
| 7 | 数据模型 chapter 关联：设计关联章节 | ✅ `questions[].chapter` 字段 |
| 8 | 数据模型 chaptersVisited：设计为数组 | ✅ `chaptersVisited: string[]` |
| 9 | 章节页面底部引导：设计要求 | ✅ `getChapterGuidance` 实现 |
| 10 | CSS 视觉效果：实现了禁用的 blur/box-shadow | ✅ 修正为水墨道风约束 |
| 11 | lastVisit 字段：设计有，实现用 firstVisit | ✅ `lastVisit` 字段已存在 |
| 12 | totalChaptersRead：设计独立字段 | ✅ 独立计数 + 动态同步 |

---

*文档结束。本规格基于 `skillup-tracker.js` v2.0 实际代码编写，与生产环境一致。*
