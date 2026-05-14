/**
 * 慧惠 亲子元数据存储 — 规范定义
 * 这是 loadMetadata / saveMetadata / validateTransition 的唯一规范来源。
 * 修改此文件后，所有 API 端点自动同步。
 *
 * 使用者:
 *   server.js               — 本地开发服务器 (Node.js fs)
 *   api/metadata.js          — Vercel Serverless Function (future)
 *   functions/api/metadata.js — Cloudflare Pages Function (future)
 *
 * 数据文件: data/family_metadata.json
 */

// ===== 模块级缓存 =====
var _metadataCache = null;
var _cacheTimestamp = 0;
var CACHE_TTL = 5000; // 5 秒缓存，避免重复读文件

// ===== 状态机定义 =====
var VALID_TRANSITIONS = {
    'pending': ['reviewing'],
    'reviewing': ['approved', 'revision_needed', 'pending'],
    'revision_needed': ['reviewing'],
    'approved': ['revision_needed']
};

/**
 * 加载元数据（带内存缓存）
 * @returns {object|null} 元数据对象
 */
export function loadMetadata() {
    var now = Date.now();
    if (_metadataCache && (now - _cacheTimestamp) < CACHE_TTL) {
        return _metadataCache;
    }
    try {
        var fs = require('fs');
        var path = require('path');
        var filePath = path.join(__dirname, '..', '..', 'data', 'family_metadata.json');
        var raw = fs.readFileSync(filePath, 'utf8');
        _metadataCache = JSON.parse(raw);
        _cacheTimestamp = now;
        return _metadataCache;
    } catch (e) {
        console.error('[metadata-store] 加载失败:', e.message);
        return null;
    }
}

/**
 * 保存元数据（原子写入 + 清除缓存）
 * @param {object} data - 完整元数据对象
 * @returns {boolean} 是否成功
 */
export function saveMetadata(data) {
    try {
        var fs = require('fs');
        var path = require('path');
        var filePath = path.join(__dirname, '..', '..', 'data', 'family_metadata.json');
        data._updated = new Date().toISOString().split('T')[0];
        var json = JSON.stringify(data, null, 4);
        fs.writeFileSync(filePath, json + '\n', 'utf8');
        // 清除缓存
        _metadataCache = data;
        _cacheTimestamp = Date.now();
        return true;
    } catch (e) {
        console.error('[metadata-store] 保存失败:', e.message);
        return false;
    }
}

/**
 * 校验状态转换是否合法
 * @param {string} from - 当前状态
 * @param {string} to   - 目标状态
 * @returns {boolean}
 */
export function validateTransition(from, to) {
    var allowed = VALID_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.indexOf(to) !== -1;
}

/**
 * 为章节元数据追加审核历史记录
 * @param {object} chapterMeta    - 章节元数据对象（会被原地修改）
 * @param {string} action         - 操作类型 (created|reviewing|approved|revision_needed|updated|deleted)
 * @param {string} by             - 操作者标识
 * @param {string} notes          - 备注
 * @param {object} [revisions]    - 结构化修订意见（可选，revision_needed 时传入）
 * @param {object} [contentSnapshot] - 内容快照（可选，关键状态转换时保存）
 * @returns {object} 更新后的 chapterMeta
 */
export function appendHistory(chapterMeta, action, by, notes, revisions, contentSnapshot) {
    if (!chapterMeta.review_history) {
        chapterMeta.review_history = [];
    }
    var entry = {
        action: action,
        by: by,
        at: new Date().toISOString(),
        notes: notes || ''
    };
    if (revisions) {
        entry.revisions = revisions;
    }
    if (contentSnapshot) {
        entry.content_snapshot = contentSnapshot;
    }
    chapterMeta.review_history.push(entry);
    return chapterMeta;
}

/**
 * 获取所有章节的统计摘要
 * @returns {object} { total, approved, pending, reviewing, revision_needed, by_reviewer }
 */
export function getStats() {
    var metadata = loadMetadata();
    var chapters = (metadata && metadata.chapters) ? metadata.chapters : {};
    var stats = {
        total: 0,
        approved: 0,
        pending: 0,
        reviewing: 0,
        revision_needed: 0,
        by_reviewer: {}
    };

    var keys = Object.keys(chapters);
    for (var i = 0; i < keys.length; i++) {
        var ch = chapters[keys[i]];
        stats.total++;
        var status = ch.review_status || 'pending';
        if (status === 'approved') stats.approved++;
        else if (status === 'pending') stats.pending++;
        else if (status === 'reviewing') stats.reviewing++;
        else if (status === 'revision_needed') stats.revision_needed++;

        var reviewer = ch.reviewed_by;
        if (reviewer) {
            stats.by_reviewer[reviewer] = (stats.by_reviewer[reviewer] || 0) + 1;
        }
    }

    if (metadata) {
        stats._updated = metadata._updated || '';
        stats._version = metadata._version || '';
    }

    return stats;
}

/**
 * 获取章节列表（支持筛选和搜索）
 * @param {object} [opts] - { status, search, page, limit }
 * @returns {object} { total, chapters[] }
 */
export function getChapterList(opts) {
    opts = opts || {};
    var metadata = loadMetadata();
    var allChapters = (metadata && metadata.chapters) ? metadata.chapters : {};

    var keys = Object.keys(allChapters).sort(function (a, b) {
        return parseInt(a) - parseInt(b);
    });

    var result = [];
    for (var i = 0; i < keys.length; i++) {
        var ch = allChapters[keys[i]];
        var chapterNum = parseInt(keys[i]);

        // 状态筛选
        if (opts.status && ch.review_status !== opts.status) {
            continue;
        }

        // 模糊搜索（标题 + core_idea）
        if (opts.search) {
            var searchLower = opts.search.toLowerCase();
            var titleMatch = ch.title && ch.title.toLowerCase().indexOf(searchLower) !== -1;
            var ideaMatch = ch.core_idea && ch.core_idea.toLowerCase().indexOf(searchLower) !== -1;
            if (!titleMatch && !ideaMatch) {
                continue;
            }
        }

        result.push({
            chapter: chapterNum,
            title: ch.title || '',
            core_idea: (ch.core_idea || '').substring(0, 80),
            review_status: ch.review_status || 'pending',
            reviewed_by: ch.reviewed_by || '',
            reviewed_at: ch.reviewed_at || '',
            safety_notes_count: (ch.safety_notes || []).length,
            interaction_points_count: (ch.interaction_points || []).length
        });
    }

    var total = result.length;

    // 分页
    var page = opts.page || 1;
    var limit = opts.limit || 50;
    var start = (page - 1) * limit;
    var paged = result.slice(start, start + limit);

    return {
        total: total,
        page: page,
        limit: limit,
        chapters: paged
    };
}

/**
 * 获取单章详情
 * @param {number} chapterNum
 * @returns {object|null}
 */
export function getChapterDetail(chapterNum) {
    var metadata = loadMetadata();
    if (!metadata || !metadata.chapters) return null;
    return metadata.chapters[String(chapterNum)] || null;
}

/**
 * 更新章节元数据（含状态转换校验）
 * @param {number} chapterNum    - 章节号
 * @param {object} updates       - 要更新的字段 + 状态转换请求
 * @param {string} [operatorBy]  - 操作者标识
 * @returns {object} { ok, chapter, error? }
 */
export function updateChapter(chapterNum, updates, operatorBy) {
    var metadata = loadMetadata();
    if (!metadata || !metadata.chapters) {
        return { ok: false, error: '元数据加载失败' };
    }

    var key = String(chapterNum);
    var chapter = metadata.chapters[key];
    if (!chapter) {
        return { ok: false, error: '未找到第 ' + chapterNum + ' 章的元数据' };
    }

    // 状态转换处理
    if (updates.review_status) {
        var fromStatus = chapter.review_status || 'pending';
        var toStatus = updates.review_status;

        if (fromStatus !== toStatus) {
            if (!validateTransition(fromStatus, toStatus)) {
                return {
                    ok: false,
                    error: '不允许的状态转换: ' + fromStatus + ' → ' + toStatus
                };
            }

            // 锁定检查：reviewing 状态下，非锁定者不能修改
            if (fromStatus === 'reviewing' && chapter.reviewed_by && chapter.reviewed_by !== (operatorBy || '')) {
                return {
                    ok: false,
                    error: '该章节正由 ' + chapter.reviewed_by + ' 审核中，暂时无法操作'
                };
            }

            // 操作记录
            var action = toStatus;
            var notes = updates.review_notes || '';
            var revisions = updates.revisions || null;
            var snapshot = null;

            // 关键状态转换时保存内容快照
            if (toStatus === 'revision_needed' || toStatus === 'approved') {
                snapshot = {
                    core_idea: chapter.core_idea || '',
                    safety_notes: (chapter.safety_notes || []).slice(),
                    interaction_points: (chapter.interaction_points || []).slice(),
                    parent_tips: chapter.parent_tips || ''
                };
            }

            if (toStatus === 'reviewing') {
                notes = notes || '开始审核';
                chapter.reviewed_by = operatorBy || '';
            }
            if (toStatus === 'approved' || toStatus === 'revision_needed') {
                chapter.reviewed_by = '';
            }
            appendHistory(chapter, action, operatorBy || 'unknown', notes, revisions, snapshot);
            chapter.reviewed_at = new Date().toISOString().split('T')[0];
        }
    }

    // 更新可编辑字段
    var editableFields = ['title', 'core_idea', 'safety_notes', 'interaction_points', 'parent_tips', 'review_status', 'reviewed_by', 'reviewed_at'];
    for (var i = 0; i < editableFields.length; i++) {
        var field = editableFields[i];
        if (updates[field] !== undefined && field !== 'review_status') {
            chapter[field] = updates[field];
        }
    }

    // 如果明确设置了 review_status
    if (updates.review_status !== undefined) {
        chapter.review_status = updates.review_status;
    }

    // 如果仅编辑内容（非状态转换），记录更新
    if (!updates.review_status) {
        appendHistory(chapter, 'updated', operatorBy || 'unknown', updates.review_notes || 'Content edited');
    }

    // 保存
    if (!saveMetadata(metadata)) {
        return { ok: false, error: '保存失败' };
    }

    return {
        ok: true,
        chapter: chapter
    };
}

/**
 * 删除章节元数据
 * @param {number} chapterNum
 * @param {string} operatorBy
 * @returns {object} { ok, error? }
 */
export function deleteChapter(chapterNum, operatorBy) {
    var metadata = loadMetadata();
    if (!metadata || !metadata.chapters) {
        return { ok: false, error: '元数据加载失败' };
    }

    var key = String(chapterNum);
    if (!metadata.chapters[key]) {
        return { ok: false, error: '未找到第 ' + chapterNum + ' 章的元数据' };
    }

    // 记录删除操作（可选）
    var chapter = metadata.chapters[key];
    appendHistory(chapter, 'deleted', operatorBy || 'unknown', 'Removed from metadata');

    delete metadata.chapters[key];

    if (!saveMetadata(metadata)) {
        return { ok: false, error: '保存失败' };
    }

    return { ok: true, deleted: chapterNum };
}
