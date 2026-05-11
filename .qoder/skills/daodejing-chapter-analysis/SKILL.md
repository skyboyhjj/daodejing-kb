---
name: daodejing-chapter-analysis
description: Execute the complete Five-Step Collaborative Reading Analysis (五步协同读解法) for any chapter of the Dao De Jing (道德经). Generates a single HTML file containing FOUR cognitive depth layers (L1-beginner/child, L2-learner/parent, L3-practitioner, L4-researcher) with data-level attributes for dynamic filtering. Includes version comparison, character exegesis, context construction, controversy analysis, logic verification, meaning transformation, parent-child enrichment activities, and the Dao-Ren (天道-人道-天人合一) dual-perspective framework. Use when the user asks to analyze, interpret, or generate content for a specific Dao De Jing chapter, or when they request deep philosophical analysis with multi-level audience adaptation. Accepts chapter number (1-81) as input.
---

# Dao De Jing Chapter Five-Step Analysis (L1–L4 Layered)

Execute the Five-Step Collaborative Reading Analysis (五步协同读解法) and generate a single HTML file containing four cognitive depth layers suitable for children, parents, practitioners, and scholars.

## Quick Start

1. **Read the chapter text** — verify the exact traditional Chinese text
2. **Execute all five steps** — for EACH step, generate content at all applicable cognitive levels
3. **Tag content by level** — wrap content in `<div data-level="l1 l2">` etc.
4. **Generate HTML output** — use the exact template structure from [template.html](template.html)
5. **Apply concept tags** — use the mapping from [concept-tags.json](concept-tags.json)
6. **Run quality checks** — verify against [quality-checklist.md](quality-checklist.md)

## Input & Output

- **Input**: Chapter number (1–81)
- **Output**: Write to `chapters/chXX.html`, containing all four cognitive levels in one file

---

## L1–L4 Cognitive Model

Every chapter must generate content at four distinct cognitive depths. These are NOT separate pages — they are layers within the SAME HTML file, toggled by a level selector (future code implementation).

| Level         | 用户画像                        | 核心需求                       | 语言策略                                      |
| ------------- | ------------------------------- | ------------------------------ | --------------------------------------------- |
| **L1 初学者** | 孩子/完全新手，对道德经了解甚少 | 获得直观印象，避免畏难         | 大白话，生活比喻，零术语。用"就像..."开头     |
| **L2 学习者** | 家长/有兴趣的学习者             | 理解基本概念、原文大意         | 解释关键术语，梳理逻辑。用"意思是..."开头     |
| **L3 实践者** | 希望应用的家长/读者             | 获得实践指导、案例分析         | 结合管理/心理/成长场景。用"可以这样用..."开头 |
| **L4 研究者** | 学者/深度爱好者                 | 版本考据、学术视角、跨文化比较 | 引用注疏，对比版本，哲学思辨。使用学术语言    |

### Parent-Child Co-Reading Principle (亲子共读原则)

In every chapter, the parent (L2–L3) and child (L1) read together. The parent bridges:
- Read L1 aloud to the child (the "大白话版")
- Read L2 for their own understanding (the "精读版")
- Refer to L3 for practical applications
- The 亲子赋能活动 section at Step 5 serves as the shared experiential layer

### 天道-人道-天人合一 Perspective (贯穿各层级)

Every chapter analysis must explicitly address three dimensions:
- **天道**: What does this chapter reveal about Dao's patterns, properties, or cosmology?
- **人道**: What guidance does it offer for human cultivation, governance, or conduct?
- **天人合一**: How do the Dao-dimension and human-dimension reflect and complete each other?

---

## Five-Step Methodology (Layered)

Execute each step in order. For EACH step, identify which cognitive levels are applicable and generate content accordingly. Mark content with `data-level` attributes.

### Step 1: Text Close Reading & Semantic Anchoring (文本细读与语义锚定)

| Sub-section                   | Applicable Levels | Notes                                                                            |
| ----------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Version Comparison (版本比对) | L3, L4            | L4 gets full variant analysis; L3 gets key differences only                      |
| Character Tracing (字词溯源)  | L2, L3, L4        | L2: simple definitions; L3: contextual meaning; L4: etymology + cross-references |
| Sentence Structure (句式辨析) | L2, L3, L4        | L2: identify patterns; L3: explain function; L4: stylistic comparison            |
| Internal Evidence (内证优先)  | L3, L4            | Cross-chapter semantic network — too complex for L1/L2                           |
| **L1 Simplified**             | L1                | Summarize the chapter's main point in 2-3 conversational sentences               |

**L1 生活化解读模板** (required for every chapter):
```
这一章老子在说：[一句话核心]。就像[生活比喻]。我们可以学到的是[一句话结论]。
```

### Step 2: Context Construction & Philosophical Deduction (语境构建与哲学推演)

| Sub-section              | Applicable Levels | Notes                                                                                 |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------- |
| Micro Context (微观语境) | L2, L3, L4        | L2: simple paragraph flow; L3: argument layers; L4: structural analysis               |
| Meso Context (中观语境)  | L2, L3, L4        | L2: mention related chapters; L3: thematic clusters; L4: editorial intent             |
| Macro Context (宏观语境) | L3, L4            | L3: position in system; L4: Warring States intellectual history + structural function |
| **L1 Simplified**        | L1                | One sentence: "这一章在整本书里是讲[主题]的"                                          |

### Step 3: Controversy Manifestation & Interpretive Options (争议显化与诠释选项分析)

| Sub-section                  | Applicable Levels | Notes                                                                               |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| Active Revelation (争议揭示) | L3, L4            | L3: note the controversy exists; L4: historical origin, full scholarly context      |
| Option Display (选项陈列)    | L4 only           | Full academic presentation of competing interpretations                             |
| Evidence Weighing (证据权衡) | L4 only           | Three-criteria evaluation with explicit reasoning                                   |
| **L1/L2 Simplified**         | L1, L2            | L1: "关于这句话，不同的人有不同的理解，但最重要的是..." L2: "学者们争论的核心是..." |

### Step 4: Logic Verification & Systemic Compatibility (逻辑一致性与体系兼容性校验)

| Sub-section                       | Applicable Levels | Notes                                                |
| --------------------------------- | ----------------- | ---------------------------------------------------- |
| Internal Coherence (内部自洽)     | L3, L4            | Check against core propositions                      |
| External Compatibility (外部兼容) | L4 only           | Zhuangzi/Wenzi references                            |
| Cross-Chapter Table (跨章验证表)  | L2, L3, L4        | L2 sees simplified table; L3/L4 see full detail      |
| Occam's Razor (奥卡姆剃刀)        | L4 only           | Assumption-level labeling                            |
| **L1 Simplified**                 | L1                | "这一章和书里其他章节说的道理是一致的，都在讲[核心]" |

### Step 5: Meaning Transformation & Modern Application (意义转化与现代启示提炼)

| Sub-section                                   | Applicable Levels | Notes                                                              |
| --------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| Three-Layer Meaning Extraction (三层意义萃取) | L2, L3, L4        | Each layer maps to a cognitive level naturally                     |
| Three-Domain Transfer (三维情境迁移)          | L1, L2, L3        | L1: family life examples; L2: personal growth; L3: leadership/work |
| Parent-Child Activities (亲子赋能)            | L1, L2            | Cognitive/Experiential/Dialogical — the shared family layer        |

**Parent-Child Activities** are the ONLY section that is NOT level-filtered — they should ALWAYS be visible regardless of selected level, because they serve as the bridge between parent and child.

---

## Output: HTML Structure (Updated for L1–L4)

Use the structure from [template.html](template.html). **Critical new requirements**:

### Level-Aware Content Blocks

Within each `.step-section`, wrap content in level-tagged containers:

```html
<div class="step-section" id="step1">
  <h3>📖 第一步：文本细读与语义锚定</h3>

  <!-- L1: 大白话版 — always first, for children/beginners -->
  <div class="level-block level-l1" data-level="l1">
    <h4>👶 大白话版</h4>
    <p>[2-3 sentences, zero jargon, life metaphor]</p>
  </div>

  <!-- L2: 精读版 — for parents/learners -->
  <div class="level-block level-l2" data-level="l2">
    <h4>📚 精读版</h4>
    <p>[Concept explanation with key terms defined]</p>
  </div>

  <!-- L3: 应用版 — for practitioners -->
  <div class="level-block level-l3" data-level="l3">
    <h4>💼 应用版</h4>
    <p>[Real-world scenarios and case analysis]</p>
  </div>

  <!-- L4: 学术版 — for researchers -->
  <div class="level-block level-l4" data-level="l4">
    <h4>🔬 学术版</h4>
    <p>[Version variants, scholarly citations, cross-cultural comparison]</p>
  </div>
</div>
```

### Level Selector Bar (controlled by level-filter.js)

Add this HTML immediately after the five-step navigation bar:

```html
<div class="level-selector" id="level-selector">
  <span>认知深度：</span>
  <button data-level="l1" class="level-btn">👶 白话</button>
  <button data-level="l2" class="level-btn">📚 精读</button>
  <button data-level="l3" class="level-btn active">💼 应用</button>
  <button data-level="l4" class="level-btn">🔬 学术</button>
  <button data-level="all" class="level-btn">📋 全部</button>
</div>
```

Visibility is controlled dynamically by `level-filter.js` — do NOT add `style="display:none;"` to the selector. The script handles showing/hiding based on localStorage preference.

### CSS Additions (in `<style>` block)

```css
.level-selector {
    display: flex; gap: 8px; align-items: center;
    margin: 16px 0; padding: 10px 16px;
    background: #fffef5; border: 1px solid #d4c9a8;
    border-radius: 8px; flex-wrap: wrap;
}
.level-btn {
    padding: 6px 14px; border: 1px solid #d4c9a8;
    border-radius: 6px; background: white;
    cursor: pointer; font-size: 0.85em;
    transition: all 0.2s;
}
.level-btn.active, .level-btn:hover {
    background: #2e5f5f; color: white; border-color: #2e5f5f;
}
.level-block { margin: 12px 0; padding: 12px 16px; border-radius: 6px; }
.level-l1 { background: #f0f7f4; border-left: 4px solid #a3c9b8; }
.level-l2 { background: #f5f3ef; border-left: 4px solid #d4af37; }
.level-l3 { background: #eef4f7; border-left: 4px solid #6b8e7a; }
.level-l4 { background: #f5f0f7; border-left: 4px solid #6a5e8a; }
.level-block h4 { margin-bottom: 6px; font-size: 0.9em; }
/* Default: show L2+L3, hide L1+L4 (can be overridden by future JS) */
.level-block.level-l1, .level-block.level-l4 { display: none; }
/* 亲子赋能 — always visible regardless of level */
.level-always { display: block !important; }
```

### Concept Tag, Golden Quote, Navigation

These elements are level-agnostic — always visible. The concept tags row, golden quote, and chapter navigation remain unchanged from the current template.

---

## Forbidden Patterns (Updated)

In addition to the existing forbidden patterns:
- **Never** use academic jargon in L1 content — if a 10-year-old can't understand it, rewrite
- **Never** skip L1 content for any chapter — even abstract chapters (e.g., ch1 "道可道") must have a child-accessible version
- **Never** treat L4 as "the real version" — all four levels are equally valid parts of the output
- **Never** omit the `data-level` attribute from level-tagged blocks
- **Never** put L4 content (version variants, scholarly citations) inside L1/L2 blocks

---

## Reference Files

- [framework.md](framework.md) — Complete methodology with five-step details and 天道-人道 framework
- [template.html](template.html) — Exact HTML template with level-aware structure
- [concept-tags.json](concept-tags.json) — 16 concept tags to CSS class mapping
- [quality-checklist.md](quality-checklist.md) — 32-point quality verification checklist
- [l1-l4-content-guide.md](l1-l4-content-guide.md) — Detailed L1–L4 content creation guide with Chapter 8 examples
