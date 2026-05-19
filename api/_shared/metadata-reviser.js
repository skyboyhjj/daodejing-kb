/**
 * 慧惠 AI 元数据修订器 — metadata-reviser.js
 * ==============================================
 * 调用 DeepSeek API 对章节元数据进行智能修订。
 *
 * 支持的修订场景：
 *  - revision_needed 触发：根据修订意见自动修正元数据
 *  - 章节生成：从 HTML 提取并生成元数据
 *  - 批量优化：连续处理多个章节
 *
 * API 依赖：DEEPSEEK_API_KEY 环境变量
 */

'use strict';

var fs, path;

function _loadFS() {
    if (!fs) { fs = require('fs'); path = require('path'); }
}

// ===== 配置 =====
var DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
// 模型: DEEPSEEK_MODEL 环境变量可覆盖，默认 deepseek-v4-flash
// 需要更强推理质量时: DEEPSEEK_MODEL=deepseek-v4-pro
var DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
var PROJECT_ROOT;

function _getRoot() {
    return PROJECT_ROOT || path.join(__dirname, '..', '..');
}

// ===== 文件路径管理 =====
function _getProductionPath() {
    _loadFS();
    return path.join(_getRoot(), 'data', 'family_metadata.json');
}

function _getStagingPath() {
    _loadFS();
    return path.join(_getRoot(), 'data', 'family_metadata_staging.json');
}

// ===== 加载 API Key =====
function loadApiKey() {
    var key = process.env.DEEPSEEK_API_KEY;
    if (key) return key;

    // 从 .env 文件读取
    _loadFS();
    var envFile = path.join(_getRoot(), '.env');
    try {
        if (fs.existsSync(envFile)) {
            var content = fs.readFileSync(envFile, 'utf8');
            var lines = content.split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.startsWith('DEEPSEEK_API_KEY=')) {
                    var val = line.substring('DEEPSEEK_API_KEY='.length).trim();
                    if (val) return val;
                }
            }
        }
    } catch (e) { /* silent */ }
    return '';
}

// ===== 加载章节 HTML =====
function loadChapterHTML(chapterNum) {
    _loadFS();
    var padded = String(chapterNum).padStart(2, '0');
    var filePath = path.join(_getRoot(), 'chapters', 'ch' + padded + '.html');
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
}

// ===== 提取 L1 白话内容 =====
function extractL1Content(html) {
    var blocks = [];
    // 匹配 <div class="level-block level-l1" data-level="l1"> ... </div>
    var l1Regex = /<div class="level-block level-l1"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="|$)/gi;
    var match;
    while ((match = l1Regex.exec(html)) !== null) {
        var block = match[1];
        // 提取 <p> 标签内容
        var pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        var pMatch;
        var texts = [];
        while ((pMatch = pRegex.exec(block)) !== null) {
            var clean = pMatch[1].replace(/<[^>]+>/g, '').trim();
            if (clean) texts.push(clean);
        }
        if (texts.length > 0) {
            blocks.push(texts.join('\n'));
        }
    }
    return blocks.join('\n\n');
}

// ===== 提取原文 =====
function extractOriginalText(html) {
    var origMatch = html.match(/<div class="original-text">([\s\S]*?)<\/div>/i);
    if (!origMatch) return '';
    var raw = origMatch[1].trim();
    raw = raw.replace(/<br\s*\/?>/gi, '\n');
    raw = raw.replace(/<[^>]+>/g, '');
    return raw.trim();
}

// ===== 加载已通过章节的风格示例 =====
function loadStyleExamples() {
    _loadFS();
    var metaPath = path.join(_getRoot(), 'data', 'family_metadata.json');
    try {
        var data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        var chapters = data.chapters || {};
        var examples = [];
        Object.keys(chapters).forEach(function (key) {
            var ch = chapters[key];
            if (ch.review_status === 'approved') {
                examples.push({
                    chapter: ch.chapter,
                    title: ch.title,
                    core_idea: ch.core_idea,
                    safety_notes_count: (ch.safety_notes || []).length,
                    style_note: '已通过审核的风格基准'
                });
            }
        });
        return examples.slice(0, 3); // 最多取3个作为示例
    } catch (e) {
        return [];
    }
}

// ===== 构建修订提示词 =====
function buildRevisionPrompt(chapterNum, htmlContent, currentMeta, revisionNotes) {
    var l1Content = extractL1Content(htmlContent);
    var originalText = extractOriginalText(htmlContent);
    var styleExamples = loadStyleExamples();

    var prompt = [
        '你是一位深谙《道德经》与儿童教育的专家，正在帮助慧惠亲子体验营优化章节元数据。',
        '',
        '## 任务',
        '根据审核员提出的修订意见，优化第' + chapterNum + '章的元数据（core_idea、safety_notes、interaction_points、parent_tips）。',
        '所有输出必须温暖、安全、适合 4-12 岁儿童及家长。',
        '',
        '## 参考原文（部分）',
        originalText.substring(0, 300),
        '',
        '## 当前白话版内容（L1）',
        l1Content.substring(0, 1500),
        '',
        '## 当前元数据',
        '```json',
        JSON.stringify({
            core_idea: currentMeta.core_idea,
            safety_notes: currentMeta.safety_notes,
            interaction_points: currentMeta.interaction_points,
            parent_tips: currentMeta.parent_tips
        }, null, 2),
        '```',
        ''
    ];

    // 添加风格示例
    if (styleExamples.length > 0) {
        prompt.push('## 已通过审核的风格示例（供参考）');
        styleExamples.forEach(function (ex) {
            prompt.push('### 第' + ex.chapter + '章 · ' + ex.title);
            prompt.push('core_idea: ' + ex.core_idea);
            prompt.push('');
        });
    }

    // 添加修订意见
    prompt.push('## 审核员的修订意见');
    if (revisionNotes && revisionNotes.length > 0) {
        revisionNotes.forEach(function (note, i) {
            prompt.push((i + 1) + '. ' + note);
        });
    } else {
        prompt.push('（通用优化：提升准确性与儿童友好性，确保与已通过章节风格一致）');
    }

    prompt.push('');
    prompt.push('## 优化要求');
    prompt.push('1. core_idea: 必须像在讲故事，不超过80字。保留原文的哲学内核（如"盗夸""非道也哉"等核心概念），用儿童能理解的方式表达。不使用当代政治话语（如"好日子""大家一起"等）。');
    prompt.push('2. safety_notes: 4-6条，覆盖安全场景。包括：儿童恐惧防范、贫富焦虑疏导、批判与攻击的区分、道德警察防范等。');
    prompt.push('3. interaction_points: 3个主题，每个覆盖3个年龄段（age_4_6/age_7_9/age_10_12）。内容具体、可操作、贴近生活。');
    prompt.push('4. parent_tips: 给家长的温暖提示，不超过80字。不说教，像朋友耳边的话。');
    prompt.push('5. 风格：古朴内敛，不喊口号，不做道德评判，不教条。');
    prompt.push('6. 哲学保护：保留原文的核心批判精神和哲理深度，不过度"儿童化"到失真。');
    prompt.push('');
    prompt.push('## 安全约束（必须严格遵守）');
    prompt.push('- 不涉及死亡、灾难、暴力等引发儿童恐惧的话题');
    prompt.push('- 不对任何行为做道德评判（不用"好""坏""对""错"做标签）');
    prompt.push('- 不涉及身体外貌比较');
    prompt.push('- 所有表述温暖、包容、积极');
    prompt.push('');
    prompt.push('## 输出格式');
    prompt.push('请严格输出以下 JSON 格式（不要 markdown 包裹，只要纯 JSON）：');
    prompt.push('{');
    prompt.push('  "core_idea": "优化后的核心思想",');
    prompt.push('  "safety_notes": ["条1", "条2", ...],');
    prompt.push('  "interaction_points": [');
    prompt.push('    { "topic": "话题名", "age_4_6": "...或null", "age_7_9": "...或null", "age_10_12": "...或null" }');
    prompt.push('  ],');
    prompt.push('  "parent_tips": "优化后的家长提示"');
    prompt.push('}');

    return prompt.join('\n');
}

// ===== 调用 DeepSeek API =====
async function callDeepSeek(systemPrompt, userPrompt) {
    var apiKey = loadApiKey();
    if (!apiKey) {
        throw new Error('未配置 DEEPSEEK_API_KEY');
    }

    var body = JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
    });

    var resp = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: body,
        signal: AbortSignal.timeout(60000)
    });

    if (!resp.ok) {
        var errText = await resp.text();
        throw new Error('DeepSeek API ' + resp.status + ': ' + errText.substring(0, 200));
    }

    var data = await resp.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error('DeepSeek API 返回空响应');
    }

    return data.choices[0].message.content;
}

// ===== 解析响应 =====
function parseResponse(responseText) {
    var jsonText = responseText.trim();

    // 尝试去除 markdown 代码块
    var codeMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeMatch) {
        jsonText = codeMatch[1].trim();
    }

    try {
        var result = JSON.parse(jsonText);
        // 验证必要字段
        if (!result.core_idea) throw new Error('缺少 core_idea');
        if (!result.safety_notes || !Array.isArray(result.safety_notes)) throw new Error('缺少 safety_notes');
        if (!result.interaction_points || !Array.isArray(result.interaction_points)) throw new Error('缺少 interaction_points');
        if (!result.parent_tips) throw new Error('缺少 parent_tips');
        return result;
    } catch (e) {
        if (e.message.indexOf('缺少') === 0) throw e;
        throw new Error('JSON 解析失败: ' + e.message + '\n原始响应: ' + jsonText.substring(0, 300));
    }
}

// ===== 解析修订意见（从 revision 对象中提取可读的文本列表） =====
function parseRevisionNotes(revisions) {
    var notes = [];
    if (!revisions) return notes;

    var fields = [
        { key: 'core_idea', label: '核心思想' },
        { key: 'safety_notes', label: '安全注意事项' },
        { key: 'interaction_points', label: '亲子互动点' },
        { key: 'parent_tips', label: '家长提示' }
    ];

    fields.forEach(function (f) {
        var d = revisions[f.key];
        if (d && d.needs_change) {
            var note = f.label + '需要修改';
            if (d.problem) note += '：' + d.problem;
            if (d.direction) note += '（建议方向：' + d.direction + '）';
            notes.push(note);
        }
    });

    if (revisions.general && revisions.general.notes) {
        notes.push('通用备注：' + revisions.general.notes);
    }

    return notes;
}

// ===== 从审核历史中提取最近的修订意见 =====
function getLatestRevisions(chapterMeta) {
    var history = chapterMeta.review_history || [];
    for (var i = history.length - 1; i >= 0; i--) {
        var entry = history[i];
        if (entry.action === 'revision_needed' && entry.revisions) {
            return entry.revisions;
        }
    }
    return null;
}

// ===== 核心：修订章节（内部逻辑，不写文件） =====
async function _reviseChapterCore(chapterNum, metadata, chapterMeta) {
    // 1. 加载章节 HTML
    var html = loadChapterHTML(chapterNum);
    if (!html) {
        throw new Error('未找到第 ' + chapterNum + ' 章的 HTML 文件');
    }

    // 2. 获取修订意见
    var revisions = getLatestRevisions(chapterMeta);
    var revisionNotes = parseRevisionNotes(revisions);

    // 3. 构建提示词
    var systemPrompt = '你是慧惠亲子体验营的元数据优化专家。你严格遵守 Article 11 儿童保护原则，所有输出都温暖、安全、适合亲子共读。';
    var userPrompt = buildRevisionPrompt(chapterNum, html, chapterMeta, revisionNotes);

    console.log('[metadata-reviser] 开始修订第 ' + chapterNum + ' 章 (' + chapterMeta.title + ')');
    console.log('[metadata-reviser] 模型: ' + DEEPSEEK_MODEL);
    console.log('[metadata-reviser] 修订意见数: ' + revisionNotes.length);
    console.log('[metadata-reviser] 提示词长度: ' + userPrompt.length + ' 字符');

    // 4. 调用 DeepSeek
    var responseText = await callDeepSeek(systemPrompt, userPrompt);
    console.log('[metadata-reviser] 响应长度: ' + responseText.length + ' 字符');

    // 5. 解析响应
    var optimized = parseResponse(responseText);

    return {
        core_idea: optimized.core_idea,
        safety_notes: optimized.safety_notes,
        interaction_points: optimized.interaction_points,
        parent_tips: optimized.parent_tips
    };
}

// ===== 修订章节 → 写入暂存区（默认安全路径） =====
async function reviseChapterToStaging(chapterNum) {
    _loadFS();

    var prodPath = _getProductionPath();
    var stagingPath = _getStagingPath();

    if (!fs.existsSync(prodPath)) {
        throw new Error('生产元数据文件不存在: ' + prodPath);
    }

    var metadata = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
    var chapterMeta = metadata.chapters[String(chapterNum)];
    if (!chapterMeta) {
        throw new Error('未找到第 ' + chapterNum + ' 章的元数据');
    }

    var optimized = await _reviseChapterCore(chapterNum, metadata, chapterMeta);

    // 写入暂存文件
    var staging = {};
    if (fs.existsSync(stagingPath)) {
        try { staging = JSON.parse(fs.readFileSync(stagingPath, 'utf8')); } catch (e) { /* reset */ }
    }
    if (!staging.chapters) staging.chapters = {};

    staging.chapters[String(chapterNum)] = {
        chapter: chapterNum,
        title: chapterMeta.title,
        core_idea: optimized.core_idea,
        safety_notes: optimized.safety_notes,
        interaction_points: optimized.interaction_points,
        parent_tips: optimized.parent_tips,
        _staged_at: new Date().toISOString(),
        _staged_by: 'AI (metadata-reviser)',
        _staged_model: DEEPSEEK_MODEL,
        _production_status: chapterMeta.review_status || 'unknown'
    };

    staging._updated = new Date().toISOString();
    staging._version = '1.0';
    staging._description = 'AI 修订暂存区 — 等待管理员同步到生产环境';
    fs.writeFileSync(stagingPath, JSON.stringify(staging, null, 4) + '\n', 'utf8');

    console.log('[metadata-reviser] 第 ' + chapterNum + ' 章修订已写入暂存区: ' + stagingPath);

    return {
        chapter: chapterNum,
        title: chapterMeta.title,
        staged: true,
        sync_required: true,
        optimized: {
            core_idea: optimized.core_idea,
            safety_notes_count: optimized.safety_notes.length,
            interaction_points_count: optimized.interaction_points.length,
            parent_tips: optimized.parent_tips
        }
    };
}

// ===== 修订章节 → 直接写入生产（需显式调用） =====
async function reviseChapterToProduction(chapterNum) {
    _loadFS();

    var metaPath = _getProductionPath();
    var metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    var chapterMeta = metadata.chapters[String(chapterNum)];
    if (!chapterMeta) {
        throw new Error('未找到第 ' + chapterNum + ' 章的元数据');
    }

    var optimized = await _reviseChapterCore(chapterNum, metadata, chapterMeta);

    chapterMeta.core_idea = optimized.core_idea;
    chapterMeta.safety_notes = optimized.safety_notes;
    chapterMeta.interaction_points = optimized.interaction_points;
    chapterMeta.parent_tips = optimized.parent_tips;

    if (!chapterMeta.review_history) chapterMeta.review_history = [];
    chapterMeta.review_history.push({
        action: 'updated',
        by: 'AI (metadata-reviser, direct)',
        at: new Date().toISOString(),
        notes: 'AI 直接修订完成（模型: ' + DEEPSEEK_MODEL + '）',
        content_snapshot: {
            core_idea: optimized.core_idea,
            safety_notes: optimized.safety_notes.slice(),
            interaction_points: optimized.interaction_points.slice(),
            parent_tips: optimized.parent_tips
        }
    });

    metadata._updated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 4) + '\n', 'utf8');

    console.log('[metadata-reviser] 第 ' + chapterNum + ' 章已直接写入生产');

    return {
        chapter: chapterNum,
        title: chapterMeta.title,
        staged: false,
        sync_required: false,
        optimized: {
            core_idea: optimized.core_idea,
            safety_notes_count: optimized.safety_notes.length,
            interaction_points_count: optimized.interaction_points.length,
            parent_tips: optimized.parent_tips
        }
    };
}

// ===== 向后兼容别名（默认走暂存） =====
var reviseChapter = reviseChapterToStaging;

// ===== 获取暂存区数据 =====
function getStagingData() {
    _loadFS();
    var stagingPath = _getStagingPath();
    if (!fs.existsSync(stagingPath)) {
        return { chapters: {}, _updated: '', _description: '暂存区为空' };
    }
    try {
        return JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
    } catch (e) {
        return { chapters: {}, _updated: '', _error: e.message };
    }
}

// ===== 同步暂存区 → 生产环境 =====
function syncStagingToProduction(chapterList) {
    _loadFS();

    var stagingPath = _getStagingPath();
    var prodPath = _getProductionPath();

    if (!fs.existsSync(stagingPath)) {
        return { ok: false, error: '暂存区不存在' };
    }

    var staging = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
    var stagingChapters = staging.chapters || {};
    var keys = Object.keys(stagingChapters);

    if (keys.length === 0) {
        return { ok: false, error: '暂存区为空' };
    }

    var chaptersToSync;
    if (chapterList && Array.isArray(chapterList) && chapterList.length > 0) {
        chaptersToSync = chapterList.map(String);
    } else {
        chaptersToSync = keys;
    }

    var production = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
    if (!production.chapters) production.chapters = {};

    var synced = [];
    var skipped = [];

    chaptersToSync.forEach(function (chKey) {
        var staged = stagingChapters[chKey];
        if (!staged) {
            skipped.push({ chapter: parseInt(chKey), reason: '暂存区中无此章节' });
            return;
        }

        var prodChapter = production.chapters[chKey];
        if (!prodChapter) {
            skipped.push({ chapter: parseInt(chKey), reason: '生产环境无此章节' });
            return;
        }

        prodChapter.core_idea = staged.core_idea;
        prodChapter.safety_notes = staged.safety_notes;
        prodChapter.interaction_points = staged.interaction_points;
        prodChapter.parent_tips = staged.parent_tips;

        if (!prodChapter.review_history) prodChapter.review_history = [];
        prodChapter.review_history.push({
            action: 'updated',
            by: 'admin (synced from staging)',
            at: new Date().toISOString(),
            notes: '管理员确认同步 AI 修订结果（暂存 → 生产）'
        });

        synced.push(parseInt(chKey));
        delete staging.chapters[chKey];
    });

    production._updated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(prodPath, JSON.stringify(production, null, 4) + '\n', 'utf8');

    staging._updated = new Date().toISOString();
    staging._description = synced.length + ' 章已同步';
    fs.writeFileSync(stagingPath, JSON.stringify(staging, null, 4) + '\n', 'utf8');

    console.log('[metadata-reviser] 同步: ' + synced.length + ' 章, 跳过: ' + skipped.length);

    return {
        ok: true,
        synced: synced,
        skipped: skipped,
        stagingRemaining: Object.keys(staging.chapters).length
    };
}

// ===== 从暂存区删除指定章节 =====
function removeFromStaging(chapterNum) {
    _loadFS();
    var stagingPath = _getStagingPath();
    if (!fs.existsSync(stagingPath)) {
        return { ok: false, error: '暂存区不存在' };
    }
    var staging = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
    var key = String(chapterNum);
    if (!staging.chapters || !staging.chapters[key]) {
        return { ok: false, error: '暂存区中无此章节: ' + chapterNum };
    }
    delete staging.chapters[key];
    staging._updated = new Date().toISOString();
    staging._description = 'AI 修订暂存区 — 等待管理员同步到生产环境';
    fs.writeFileSync(stagingPath, JSON.stringify(staging, null, 4) + '\n', 'utf8');
    console.log('[metadata-reviser] 已从暂存区删除第 ' + chapterNum + ' 章');
    return { ok: true, removed: parseInt(chapterNum) };
}

// ===== 导出 =====
module.exports = {
    reviseChapter: reviseChapter,
    reviseChapterToStaging: reviseChapterToStaging,
    reviseChapterToProduction: reviseChapterToProduction,
    syncStagingToProduction: syncStagingToProduction,
    getStagingData: getStagingData,
    removeFromStaging: removeFromStaging,
    getLatestRevisions: getLatestRevisions,
    parseRevisionNotes: parseRevisionNotes
};
