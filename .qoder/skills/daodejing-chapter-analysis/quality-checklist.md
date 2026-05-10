# Quality Checklist — 32-Point Verification

After completing each chapter's five-step analysis, verify against this checklist before considering the work done.

---

## Text Anchoring (文本锚定)

- [ ] **V1**: Compared at least two textual traditions (通行本 + 帛书本) for key variants?
- [ ] **V2**: Provided character/word tracing for core terms with internal Dao De Jing corroboration?
- [ ] **V3**: Analyzed the chapter's key sentence structures (parallelism, causal chains, rhetorical questions)?
- [ ] **V4**: Built an internal evidence network — found parallel usages of core concepts in other chapters?

## Context Completeness (语境完整)

- [ ] **C1**: Clearly delineated the chapter's internal argument layers?
- [ ] **C2**: Analyzed this chapter's relationship with at least 3 other chapters?
- [ ] **C3**: Positioned the chapter within the overall Dao De Jing architecture (Dao Jing vs. De Jing)?
- [ ] **C4**: Engaged with Warring States intellectual historical context?

## Controversy Openness (争议开明)

- [ ] **D1**: Revealed at least 2 key scholarly controversies?
- [ ] **D2**: Displayed at least 2 different interpretive paths per controversy?
- [ ] **D3**: Provided reasoned personal judgment with explicit criteria?
- [ ] **D4**: Noted historical origin of each controversy (who raised it, which commentators engaged)?

## Logical Rigor (逻辑严谨)

- [ ] **L1**: Checked compatibility with core Dao De Jing propositions (反者道之动, 无为而无不为, 生而不有)?
- [ ] **L2**: Referenced external Daoist texts (庄子, 文子) only after exhausting internal evidence?
- [ ] **L3**: Applied Occam's Razor in choosing among competing interpretations?
- [ ] **L4**: Produced a cross-chapter verification table with at least 5 rows?

## Meaning Grounding (意义落地)

- [ ] **M1**: Completed three-layer meaning extraction (historical → universal → modern)?
- [ ] **M2**: Projected insights into all three domains (personal cultivation, organizational insight, civilizational critique)?
- [ ] **M3**: Provided actionable, concrete suggestions for each application domain?
- [ ] **M4**: Included parent-child enrichment activities at three levels (cognitive, experiential, dialogical)?

## Presentation Quality (呈现质量)

- [ ] **P1**: Used the correct concept tags (3–5 tags) with proper CSS classes?
- [ ] **P2**: Included a cross-chapter verification table in proper HTML format?
- [ ] **P3**: Extracted a golden quote with modern interpretation?
- [ ] **P4**: Matched the HTML/CSS template structure exactly?

## Structural Integrity (结构完整)

- [ ] **S1**: `<title>` follows format: "第X章 [核心命题] - 道德经亲子体验营"?
- [ ] **S2**: Five-step navigation bar present with correct anchor links?
- [ ] **S3**: Original text in traditional Chinese (繁体) inside `.original-text`?
- [ ] **S4**: Chapter navigation links correct (ch[PREV].html ← → ch[NEXT].html)?
- [ ] **S5**: Footer with correct update date?
- [ ] **S6**: Script references present in correct order (search-data.js, search.js, back-to-top.js, level-filter.js)?
- [ ] **S7**: huihui-chat component present (huihui-chat.css + huihui-chat.js)?
- [ ] **S8**: Level selector exists with `id="level-selector"` and all 5 buttons including `data-level="all"`?
- [ ] **S9**: Site footer (`.site-footer`) exists?
- [ ] **S10**: Level blocks use `class="level-block"` with correct `data-level` attributes?

## Content Quality (内容质量)

- [ ] **Q1**: No placeholder text or vague claims without substantiation?
- [ ] **Q2**: At least 200 meaningful Chinese characters per step-section?
- [ ] **Q3**: All citations include both chapter number and quoted text?
- [ ] **Q4**: No reductionist traps (无为 ≠ 不作为, 不争 ≠ 消极, 自然 ≠ 自然界)?

---

## Quick Check Command

After writing the chapter file, scan for these common errors:

```
grep -n "此处需要" chXX.html          # Should find nothing
grep -n "本章.*深刻" chXX.html        # Vague claims — verify substantiation
grep -c "step-section" chXX.html      # Should be exactly 5
grep -c "concept-tag" chXX.html       # Should be >= 3 (in the tag row)
grep -c "verify-table\|cross-chapter" chXX.html  # Should find the verification table
grep -c "level-block" chXX.html       # Should be >= 16 (4 levels × 4 steps minimum)
grep -c "level-filter.js" chXX.html   # Should be exactly 1
grep -c "huihui-chat" chXX.html       # Should be exactly 2 (css + js)
grep -c "id=\"level-selector\"" chXX.html  # Should be exactly 1
grep -c "data-level=\"all\"" chXX.html     # Should be exactly 2 (亲子赋能 + 全部按钮)
grep -c "site-footer" chXX.html       # Should be exactly 1
```
