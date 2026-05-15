/**
 * 公开元数据构建脚本
 * =============================================
 * 从完整版 family_metadata.json 生成脱敏的 family_metadata_public.json。
 *
 * 白名单过滤 — 移除内部审计字段:
 *   ❌ reviewed_by
 *   ❌ reviewed_at
 *   ❌ review_history
 *
 * 版本标识 — 注入三重版本元字段:
 *   ✅ _format_version  — Schema 版本号（手动配置）
 *   ✅ _content_hash    — 章节内容 SHA-256 指纹（前 8 位 hex）
 *   ✅ _generated       — ISO 8601 生成时间戳
 *
 * 用法:
 *   node scripts/build-public-metadata.js            # 构建脱敏版本
 *   node scripts/build-public-metadata.js --check    # 一致性检查（不写文件）
 *   node scripts/build-public-metadata.js --dry-run  # 预演模式（打印差异，不写文件）
 *
 * 参考: scripts/version-manifest.js（SHA-256 计算逻辑）
 */

'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// ===== 配置 =====
var ROOT = path.join(__dirname, '..');
var SOURCE_PATH = path.join(ROOT, 'data', 'family_metadata.json');
var OUTPUT_PATH = path.join(ROOT, 'data', 'family_metadata_public.json');
var FORMAT_VERSION = '1.0';

// ===== 公开字段白名单 =====
var PUBLIC_FIELDS = [
    'chapter',
    'title',
    'core_idea',
    'safety_notes',
    'interaction_points',
    'parent_tips',
    'review_status'
];

// ===== 命令行参数 =====
var CHECK_MODE = process.argv.includes('--check');
var DRY_RUN = process.argv.includes('--dry-run');

// ===== 主流程 =====
function main() {
    // 1. 加载源文件
    if (!fs.existsSync(SOURCE_PATH)) {
        console.error('[build-public-metadata] 源文件不存在: ' + path.relative(ROOT, SOURCE_PATH));
        process.exit(1);
    }

    var source;
    try {
        source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
    } catch (e) {
        console.error('[build-public-metadata] 源文件 JSON 解析失败: ' + e.message);
        process.exit(1);
    }

    if (!source.chapters || typeof source.chapters !== 'object') {
        console.error('[build-public-metadata] 源文件缺少 chapters 字段');
        process.exit(1);
    }

    // 2. 白名单过滤：从每个章节移除敏感字段
    var publicChapters = {};
    var chapterKeys = Object.keys(source.chapters).sort(function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
    });

    var totalChapters = 0;
    var approvedCount = 0;

    chapterKeys.forEach(function (key) {
        var srcChapter = source.chapters[key];
        var pubChapter = {};

        PUBLIC_FIELDS.forEach(function (field) {
            if (srcChapter.hasOwnProperty(field)) {
                pubChapter[field] = srcChapter[field];
            }
        });

        publicChapters[key] = pubChapter;
        totalChapters++;

        if (pubChapter.review_status === 'approved') {
            approvedCount++;
        }
    });

    // 3. 计算内容哈希（按排序键序列化每章内容，确保确定性）
    var hashParts = [];
    chapterKeys.forEach(function (key) {
        var ch = publicChapters[key];
        // 每章内容按 PUBLIC_FIELDS 顺序序列化（确保字段顺序稳定）
        var fieldParts = [];
        PUBLIC_FIELDS.forEach(function (f) {
            if (ch.hasOwnProperty(f)) {
                fieldParts.push(JSON.stringify(f) + ':' + JSON.stringify(ch[f]));
            }
        });
        hashParts.push('"' + key + '":{' + fieldParts.join(',') + '}');
    });
    var chaptersStr = '{' + hashParts.join(',') + '}';
    var contentHash = crypto.createHash('sha256').update(chaptersStr).digest('hex').slice(0, 8);
    var generated = new Date().toISOString();

    // 4. 构建公开版完整对象
    var publicMetadata = {
        _format_version: FORMAT_VERSION,
        _content_hash: contentHash,
        _generated: generated,
        _version: source._version || '1.0',
        _updated: source._updated || '',
        chapters: publicChapters
    };

    // 5. --check 模式: 仅比对哈希，不写文件
    if (CHECK_MODE) {
        return checkMode(publicMetadata);
    }

    // 6. --dry-run 模式: 打印变更摘要
    if (DRY_RUN) {
        return dryRunMode(publicMetadata);
    }

    // 7. 正常模式: 写入文件
    return buildMode(publicMetadata);
}

// ===== --check 模式 =====
function checkMode(newMetadata) {
    if (!fs.existsSync(OUTPUT_PATH)) {
        console.log('[build-public-metadata] 公开版文件不存在，需要构建');
        console.log('  expected_hash=' + newMetadata._content_hash);
        process.exit(2);
    }

    var current;
    try {
        current = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    } catch (e) {
        console.log('[build-public-metadata] 公开版文件 JSON 解析失败，需要重新构建');
        console.log('  expected_hash=' + newMetadata._content_hash);
        process.exit(2);
    }

    var oldHash = current._content_hash || '(none)';
    var newHash = newMetadata._content_hash;

    if (oldHash === newHash) {
        console.log('[build-public-metadata] 一致性检查通过 ✓');
        console.log('  hash=' + newHash);
        console.log('  last_generated=' + (current._generated || '(unknown)'));
        process.exit(0);
    } else {
        console.log('[build-public-metadata] 一致性检查失败 ✗ — 内容已变更');
        console.log('  old_hash=' + oldHash);
        console.log('  new_hash=' + newHash);
        console.log('  last_generated=' + (current._generated || '(unknown)'));
        process.exit(1);
    }
}

// ===== --dry-run 模式 =====
function dryRunMode(newMetadata) {
    console.log('[build-public-metadata] ====== 预演模式 ======');
    console.log('  源文件: ' + path.relative(ROOT, SOURCE_PATH));
    console.log('  目标文件: ' + path.relative(ROOT, OUTPUT_PATH));
    console.log('  content_hash: ' + newMetadata._content_hash);
    console.log('  format_version: ' + FORMAT_VERSION);
    console.log('  generated: ' + newMetadata._generated);
    console.log('');

    var chapterKeys = Object.keys(newMetadata.chapters).sort(function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
    });

    var approvedCount = 0;
    var pendingCount = 0;
    var reviewingCount = 0;
    var revisionNeededCount = 0;

    chapterKeys.forEach(function (key) {
        var ch = newMetadata.chapters[key];
        switch (ch.review_status) {
            case 'approved': approvedCount++; break;
            case 'pending': pendingCount++; break;
            case 'reviewing': reviewingCount++; break;
            case 'revision_needed': revisionNeededCount++; break;
        }
    });

    console.log('  章节统计:');
    console.log('    总计: ' + chapterKeys.length);
    console.log('    approved: ' + approvedCount);
    console.log('    pending: ' + pendingCount);
    console.log('    reviewing: ' + reviewingCount);
    console.log('    revision_needed: ' + revisionNeededCount);

    // 检查与现有公开版的差异
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            var current = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            var oldHash = current._content_hash || '(none)';
            if (oldHash !== newMetadata._content_hash) {
                console.log('');
                console.log('  ⚠ 检测到内容变更:');
                console.log('    old_hash=' + oldHash);
                console.log('    new_hash=' + newMetadata._content_hash);
            } else {
                console.log('');
                console.log('  ✓ 内容无变更');
            }
            // 检查字段泄露
            var leakedFields = checkFieldLeak(current);
            if (leakedFields.length > 0) {
                console.log('');
                console.log('  ⚠ 警告: 当前公开版文件含敏感字段: ' + leakedFields.join(', '));
            }
        } catch (e) {
            // 旧文件损坏，忽略
        }
    } else {
        console.log('');
        console.log('  ⚠ 公开版文件尚不存在，将首次生成');
    }

    console.log('[build-public-metadata] ====== 预演结束 ======');
}

// ===== 正常构建模式 =====
function buildMode(publicMetadata) {
    var dataDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 统计
    var chapterKeys = Object.keys(publicMetadata.chapters);
    var stats = { total: chapterKeys.length, approved: 0, pending: 0, reviewing: 0, revision_needed: 0 };
    chapterKeys.forEach(function (k) {
        var s = publicMetadata.chapters[k].review_status;
        if (s === 'approved') stats.approved++;
        else if (s === 'pending') stats.pending++;
        else if (s === 'reviewing') stats.reviewing++;
        else if (s === 'revision_needed') stats.revision_needed++;
    });

    // 变更检测
    var oldHash = '(none)';
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            var current = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            oldHash = current._content_hash || '(none)';
        } catch (e) { /* ignore */ }
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(publicMetadata, null, 4) + '\n', 'utf8');

    console.log('[build-public-metadata] 公开版已生成: ' + path.relative(ROOT, OUTPUT_PATH));
    console.log('  format_version: ' + FORMAT_VERSION);
    console.log('  content_hash:   ' + publicMetadata._content_hash);
    console.log('  generated:      ' + publicMetadata._generated);
    console.log('  章节统计:');
    console.log('    总计:          ' + stats.total);
    console.log('    approved:      ' + stats.approved);
    console.log('    pending:       ' + stats.pending);
    console.log('    reviewing:     ' + stats.reviewing);
    console.log('    revision_needed: ' + stats.revision_needed);

    if (oldHash !== '(none)') {
        if (oldHash === publicMetadata._content_hash) {
            console.log('  ✓ 内容无变更 (hash=' + publicMetadata._content_hash + ')');
        } else {
            console.log('  ⚠ 内容已变更: ' + oldHash + ' → ' + publicMetadata._content_hash);
        }
    }
}

// ===== 字段泄露检查 =====
function checkFieldLeak(publicMetadata) {
    var leaked = [];
    var SENSITIVE_FIELDS = ['reviewed_by', 'reviewed_at', 'review_history'];

    var chapters = publicMetadata.chapters || {};
    var keys = Object.keys(chapters);
    if (keys.length === 0) return leaked;

    var sampleKey = keys[0];
    var sampleChapter = chapters[sampleKey];

    SENSITIVE_FIELDS.forEach(function (field) {
        if (sampleChapter.hasOwnProperty(field)) {
            leaked.push(field);
        }
    });

    return leaked;
}

// ===== 入口 =====
main();
