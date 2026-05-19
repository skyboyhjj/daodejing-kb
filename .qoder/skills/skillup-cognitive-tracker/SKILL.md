---
name: skillup-cognitive-tracker
description: SkillUP 认知成长追踪与动态反馈（第一期）。实现 P0 阶段的学习数据追踪器、水德四阶段成长模型、慧惠动态反馈机制。当用户需要实现或修改 SkillUP 认知追踪功能时使用本 Skill。
---

# SkillUP 认知成长追踪与动态反馈

> 对应设计文档：`docs/SkillUP 层设计方案 · 第一期：认知成长追踪与动态反馈.md`
> 宪法依据：《慧惠数字生命 · 最高产品宪法》第七条（用户主权）、第十一条（亲子守护）、第十四条（SkillUP）

---

## 1. 前置条件（强制性）

**必须在执行前完整阅读以下文档的全部章节：**

1. `docs/SkillUP 层设计方案 · 第一期：认知成长追踪与动态反馈.md` — **全部八节**（特别关注第二节至第七节的设计参数）
2. `docs/慧惠数字生命 · 最高产品宪法.md` — 至少第七条（用户主权）和第十一条（亲子守护）

**技术依赖**：
- 慧惠聊天组件 `js/huihui-chat.js` 已正常工作
- L1-L4 分层按钮已正常切换
- 匿名用户 ID（`huihui_uid`）和 localStorage 存储已在聊天组件中实现

---

## 2. 设计参数速查表

### 2.1 水德四阶段成长模型

| 阶段 | 名称 | 阈值 | 标志性行为 | 慧惠陪伴策略 |
|:---|:---|:---|:---|:---|
| 水滴 | 初探道德经 | ≤10 章 | 首次访问，读1-2章，L1提问 | 欢迎鼓励，不提复杂概念 |
| 溪流 | 积累与串联 | 11-30 章 | L2模式提问，使用核心术语 | 帮助建立概念间联系 |
| 江河 | 实践与思辨 | 31-60 章 | 主动切L3，涉及现实应用 | 以提问引导更深思考 |
| 江海 | 贯通与分享 | 61+ 章 | L4模式，版本注疏哲学悖论 | 平等思辨探讨，跨章链接 |

### 2.2 触发规则矩阵

| 触发时机 | 行为条件 | 反馈示例 |
|:---|:---|:---|
| 阅读≥3章 + 水滴阶段 | `chaptersVisited.length >= 3 && currentStage === '水滴'` | "你已经读了三章了。老子的智慧像水一样，开始慢慢流进了你的生活？" |
| 切换到L3 + 溪流阶段 | `levelHistory` 最新为 L3 && `currentStage === '溪流'` | "你开始从'怎么做'的角度思考了。要不要试试第33章？" |
| 连续三天访问 | lastVisit 与今天相差3天以内且连续 | "你已经是连续第三天来找我了。这份坚持本身就是一种修行。" |
| 用户主动查询 | "我学得怎么样了？"等8个查询模式 | "你一共探索了{totalChaptersRead}章，正处于'{currentStage}'阶段。" |

### 2.3 数据模型

```javascript
var learningData = {
    lastVisit: 'ISO',                              // 最近访问时间
    chaptersVisited: ['ch01', 'ch08', 'ch02'],      // 数组，已访问章节
    totalChaptersRead: 3,                            // 独立计数字段
    currentStage: '水滴',                             // 中文阶段名
    levelHistory: [                                   // 认知水平切换记录
        { date: '2026-05-10', level: 'L1' },
        { date: '2026-05-12', level: 'L2' }
    ],
    questions: [                                      // 提问记录
        {
            chapter: 'ch08',                          // 关联章节
            level: 'L2',
            keyword: '无为',                          // 提取的关键词
            timestamp: '2026-05-12T10:30:00Z'
        }
    ]
};
```

### 2.4 操作文件清单

| 文件 | 操作 | 说明 |
|:---|:---|:---|
| `js/skillup-tracker.js` | 新建 | 学习数据追踪器 |
| `js/skillup-consent.js` | 新建 | 首次使用许可提示（独立文件） |
| `js/skillup-ui.js` | 新建 | "我的成长"卡片 UI 组件 |
| `css/skillup-ui.css` | 新建 | 卡片样式（水墨道风统一） |
| `js/huihui-chat.js` | 修改 | 集成 SkillUP 数据记录和动态反馈 |
| `index.html` | 修改 | 引入 SkillUP 相关 JS/CSS 文件 |

---

## 3. 执行步骤

> 每步执行前，对照 §2 设计参数确认命名和阈值。

**Step 1**：新建 `js/skillup-tracker.js` — 学习数据追踪器
- 数据存储在 localStorage（key: `skillup_data`）
- 实现章节访问记录、认知切换记录、提问行为记录
- 实现阶段判定（根据 `chaptersVisited` 和 `levelHistory` 自动计算 `currentStage`）
- 实现成长反馈触发条件检测

**Step 2**：新建 `js/skillup-consent.js` — 用户许可提示（独立文件）
- 首次使用时弹出确认对话框
- 文案："慧惠会帮你记录这段旅程的足迹，仅存在你的浏览器里"
- 用户确认后启用追踪，拒绝则不记录任何数据

**Step 3**：新建 `js/skillup-ui.js` — "我的成长"卡片 UI
- 在首页 `.entry-cards` 容器中动态注入成长卡片
- 仅在首页展示（非首页跳过注入）
- 卡片展示当前阶段 + 已读章节数
- 点击展开学习详情模态框
- 详情包含：已读章节、探索天数、深度切换次数、偏好认知深度、最近阅读

**Step 4**：新建 `css/skillup-ui.css` — 卡片样式
- 配色与水墨道风统一（#2e5f5f, #d4c9a8, #faf8f0）
- 无 box-shadow、无 backdrop-filter blur、无 gradient
- 移动端响应式适配

**Step 5**：修改 `js/huihui-chat.js` — 集成 SkillUP
- 用户发送消息时：调用 `recordMessage()`
- 用户切换层级时：调用 `recordLevelSwitch()`
- 打开聊天面板时：检查里程碑，若有则延迟 600ms 发送反馈
- 技能查询拦截："我学得怎么样了？"等 8 个中文查询模式本地回答

**Step 6**：修改 `index.html` — 引入文件
- 在 `</body>` 前按顺序引入：skillup-ui.css → skillup-tracker.js → skillup-consent.js → skillup-ui.js

**Step 7**（设计 §4.2 要求）：章节页面底部成长引导
- 在 `chapters/ch*.html` 底部动态插入慧惠成长引导语

---

## 4. 实现后自检清单

执行完成后，逐条对照检查：

- [ ] **1. 阶段名称** = `水滴` / `溪流` / `江河` / `江海`（非萌芽/小苗/树木/森林）
- [ ] **2. 阶段阈值** = ≤10 / 11-30 / 31-60 / 61+（非 0-3/4-10/11-30/31+）
- [ ] **3. chaptersVisited** 为数组格式 `['ch01','ch08']`（非对象 `{"1":{}}`）
- [ ] **4. totalChaptersRead** 为独立存储字段
- [ ] **5. currentStage** 存储中文阶段名（非英文 key）
- [ ] **6. questions 含 keyword** 字段（提取用户提问关键词）
- [ ] **7. questions 含 chapter** 字段（关联提问时的章节上下文）
- [ ] **8. 4 条触发规则全覆盖**（阅8章后/L3切换/连续3天/主动查询）
- [ ] **9. 连续天数** = 真正的连续日期检测（非首次至今总天数差）
- [ ] **10. 章节页面底部** = 有慧惠成长引导语注入
- [ ] **11. lastVisit** 字段存在于数据模型中
- [ ] **12. skillup-consent.js** 为独立文件（非内嵌于 skillup-ui.js）

---

## 5. 参考文件

- `docs/SkillUP 层设计方案 · 第一期：认知成长追踪与动态反馈.md` — 完整设计规格
- `docs/慧惠数字生命 · 最高产品宪法.md` — 产品宪法
- `js/huihui-chat.js` — 慧惠聊天组件（需修改的集成点）
- `index.html` — 首页（需添加 SkillUP 文件引用）
- `.qoder/skills/daodejing-chapter-analysis/SKILL.md` — Skill 定义参考模板
