# 修复章节完成标记逻辑 — 实现计划

## 背景

连续学习模式中存在章节被错误标记为"已完成"的 bug：用户切换到自由探索模式时，尚未完成的章节被计入完成统计。根因是 `goToNextChapter()` 函数中有一个冗余的 `allChaptersCompleted.push()`，而 `switchMode()` 在某些分支中绕过了 `endChapter()` 直接调用 `goToNextChapter()`，导致未完成章节被标记。

**核心设计原则**：`endChapter()` 是标记章节已完成的**唯一权威**。`goToNextChapter()` 只能做导航，无权决定完成状态。

## 修改清单

### 修改 1：删除 `goToNextChapter()` 中的冗余 push（`js/family.js` 第 715-719 行）

**删除以下 5 行**：

```javascript
    // 仅当章节审核通过（用户真正学习过）时才标记完成
    // endChapter() 已将审核通过的章加入 allChaptersCompleted，此处做防御性查重
    if (isChapterApproved(state.chapterNum) && state.allChaptersCompleted.indexOf(state.chapterNum) === -1) {
        state.allChaptersCompleted.push(state.chapterNum);
    }
```

**理由**：`endChapter()` 已经在第 680-682 行完成标记。此处冗余逻辑导致 `switchMode()` → `goToNextChapter()` 路径绕过了 `endChapter()` 的权威判断。

**对所有调用者的影响**（修改后）：
| 调用者 | 修改后行为 |
|--------|-----------|
| `endChapter()` → `goToNextChapter()` | `endChapter` 已标记，`goToNextChapter` 仅导航。无变化。 |
| `handleUnapprovedChapter()` → `goToNextChapter()` | 无 push（`isChapterApproved` 本就不通过）。无变化。 |
| `switchMode()` (dialogue → continuous) | 不再有 push。配合修改 2 完全消除。 |
| `switchMode()` (chapter_end → continuous) | 仅导航不标记。正确。 |

### 修改 2：修复 `switchMode()` 自由→连续切换时的对话分支（第 1017-1020 行）

**将**：
```javascript
        } else {
            // 已是连续模式 → 继续下一章
            goToNextChapter();
        }
```

**改为**：
```javascript
        } else {
            // 切换到连续模式：保持当前对话，完成本章后自动进入下一章
            setInputEnabled(true);
            userInputEl.placeholder = '输入孩子的回答……（连续学习模式）';
            userInputEl.focus();
            updateChapterProgress();
        }
```

**理由**：用户在自由探索模式中正在对话，切换为连续模式后应该留在当前章节继续对话，而不是跳过当前章节。切换后 `state.mode === 'continuous'`，完成当前章时 `endChapter()` 会自动调用 `goToNextChapter()` 进入下一章。

### 修改 3：验证 `switchMode()` 在 `chapter_end` 阶段的调用 — **无需代码修改**

第 1063-1067 行的 `goToNextChapter()` 调用在移除 push 后已经安全：它只做导航，不会错误标记。

### CSS 修改：无需修改

修改 2 不引入新 DOM 元素，仅复用已有机制。

## 验证方案（6 个测试场景）

每次测试前执行 `localStorage.clear()` 清空状态。

### 测试 1：正常连续学习推进
- 操作：连续模式第 1 章 → 完成对话 → 自动进入第 2 章 → 完成 → 第 3 章
- 预期：每章在 `allChaptersCompleted` 中出现恰好 1 次。进度条正确递增。

### 测试 2：自由→连续模式切换（核心修复场景）
- 操作：自由模式 → 进入第 25 章 → 发 1 条消息 → 点击"连续学习"
- 预期：留在第 25 章继续对话。输入框可用。placeholder 显示"(连续学习模式)"。完成本章后自动进入第 26 章。第 25 章被标记恰好 1 次。

### 测试 3：连续→自由模式切换
- 操作：连续模式第 10 章 → 完成 10-11 → 第 12 章对话中 → 切换到自由模式
- 预期：stage 变为 `chapter_end`。显示章节选择器。第 12 章**不**在 `allChaptersCompleted` 中。

### 测试 4：连续模式中遇到未审核章节
- 操作：连续模式 → 进入未审核章节 → 观察自动跳过
- 预期：未审核章节**不**加入 `allChaptersCompleted`。系统在 2.5s 后自动进入下一章。下一章若已审核则正常开始。

### 测试 5：chapter_end 阶段切换到连续模式
- 操作：自由模式 → 完成第 30 章 → 在章节选择器可见时 → 切换到连续模式
- 预期：`goToNextChapter()` 进入第 31 章。章节 30 已在 `allChaptersCompleted` 中（由 `endChapter` 标记）。

### 测试 6：全部 81 章完成
- 操作：连续模式 → 模拟完成全部 81 章
- 预期：`allChaptersDone()` 在 `next > 81` 时触发。进度 81/81（100%）。显示祝贺消息。无重复章节。

## 影响范围

- 修改行数：约 10 行
- 涉及函数：`goToNextChapter()`, `switchMode()`（仅两处）
- 无 API 变更
- 无 DOM 结构变更
- 无新增状态管理
