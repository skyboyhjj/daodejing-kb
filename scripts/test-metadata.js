/**
 * 元数据质量回归测试套件
 * 对 data/family_metadata.json 执行 6 类结构化质量检查
 *
 * 用法：
 *   node scripts/test-metadata.js              # 运行所有测试
 *   node scripts/test-metadata.js --verbose    # 详细模式（输出每个章节详情）
 *   node scripts/test-metadata.js ch01         # 仅测试指定章节
 *
 * 测试类别：
 *   T1: 必填字段完整性
 *   T2: safety_notes 数量检查
 *   T3: interaction_points 结构验证
 *   T4: 禁用术语扫描
 *   T5: 状态机合法性
 *   T6: 公开版 hash 一致性
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── 路径配置 ──
const ROOT = path.join(__dirname, '..');
const META_PATH = path.join(ROOT, 'data', 'family_metadata.json');
const PUBLIC_META_PATH = path.join(ROOT, 'data', 'family_metadata_public.json');

// ── 脱敏白名单（与 build-public-metadata.js 保持一致） ──
const PUBLIC_FIELDS = [
    'chapter', 'title', 'core_idea', 'safety_notes',
    'interaction_points', 'parent_tips', 'review_status'
];

// ── 状态机转换规则（与 server.js VALID_TRANSITIONS 保持一致） ──
const VALID_TRANSITIONS = {
    'pending': ['reviewing'],
    'reviewing': ['approved', 'revision_needed', 'pending'],
    'revision_needed': ['reviewing'],
    'approved': ['revision_needed']
};
const VALID_STATUSES = Object.keys(VALID_TRANSITIONS);

// ── 禁用术语（Article 11 亲子守护对齐） ──
// 仅扫描面对用户的内容字段（core_idea、parent_tips），
// safety_notes 和 interaction_points 是元指令，可能含否定式引用
const FORBIDDEN_TERMS = [
    { term: '死亡', reason: '暴力/死亡相关内容（Article 11-1）' },
    { term: '自杀', reason: '暴力/死亡相关内容（Article 11-1）' },
    { term: '杀人', reason: '暴力/死亡相关内容（Article 11-1）' },
    { term: '暴力', reason: '暴力相关内容（Article 11-1）' },
    { term: '虐待', reason: '暴力相关内容（Article 11-1）' },
    { term: '血腥', reason: '暴力相关内容（Article 11-1）' },
    { term: '色情', reason: '成人/不适儿童内容（Article 11-2）' },
    { term: '裸体', reason: '成人/不适儿童内容（Article 11-2）' },
    { term: '毒品', reason: '不适儿童内容' },
    { term: '吸毒', reason: '不适儿童内容' },
    { term: '赌博', reason: '不适儿童内容' },
    { term: '上瘾', reason: '成瘾性内容（Article 11-3）' },
];

// ── 内容扫描字段 ──
const CONTENT_SCAN_FIELDS = ['core_idea', 'parent_tips'];

// ── 工具函数 ──

function escTrunc(s, max) {
    if (!s) return '(空)';
    max = max || 60;
    return s.length > max ? s.substring(0, max) + '…' : s;
}

function plural(n, w) {
    return n + ' ' + w + (n === 1 ? '' : '');
}

// ── T1: 必填字段完整性 ──

function checkFieldCompleteness(chapter, key) {
    var failures = [];
    var required = {
        'chapter': function (v) { return typeof v === 'number' && v > 0 && v <= 81; },
        'title': function (v) { return typeof v === 'string' && v.length > 0; },
        'core_idea': function (v) { return typeof v === 'string' && v.length >= 20; },
        'safety_notes': function (v) { return Array.isArray(v) && v.length > 0; },
        'interaction_points': function (v) { return Array.isArray(v) && v.length >= 1; },
        'parent_tips': function (v) { return typeof v === 'string' && v.length > 0; },
        'review_status': function (v) { return typeof v === 'string' && VALID_STATUSES.indexOf(v) !== -1; },
        'review_history': function (v) { return Array.isArray(v); }
    };

    Object.keys(required).forEach(function (field) {
        var val = chapter[field];
        if (val === undefined || val === null) {
            failures.push('[' + key + '] 缺少必填字段: ' + field);
        } else if (!required[field](val)) {
            var detail = '';
            if (field === 'safety_notes' || field === 'interaction_points') {
                detail = ' (应为非空数组)';
            } else if (field === 'review_status') {
                detail = ' (值 "' + val + '" 不在合法状态中: ' + VALID_STATUSES.join(', ') + ')';
            } else if (field === 'core_idea') {
                detail = ' (长度 ' + (typeof val === 'string' ? val.length : typeof val) + '，要求 ≥20)';
            } else if (field === 'chapter') {
                detail = ' (值 ' + JSON.stringify(val) + '，要求 1-81)';
            }
            failures.push('[' + key + '] 字段 ' + field + ' 验证失败' + detail);
        }
    });

    return failures;
}

// ── T2: safety_notes 数量 ──

function checkSafetyNotesCount(chapter, key) {
    var sn = chapter.safety_notes || [];
    if (sn.length < 3) {
        return ['[' + key + '] safety_notes 数量不足: ' + sn.length + ' 条（要求 ≥3）'];
    }
    return [];
}

// ── T3: interaction_points 结构 ──

function checkInteractionPoints(chapter, key) {
    var failures = [];
    var ips = chapter.interaction_points || [];
    var ageFields = ['age_4_6', 'age_7_9', 'age_10_12'];

    ips.forEach(function (ip, idx) {
        if (!ip.topic || typeof ip.topic !== 'string' || ip.topic.trim().length === 0) {
            failures.push('[' + key + '] interaction_point[' + idx + '] 缺少或为空 topic');
        }

        var hasAge = false;
        ageFields.forEach(function (af) {
            if (ip[af] !== null && ip[af] !== undefined && typeof ip[af] === 'string' && ip[af].trim().length > 0) {
                hasAge = true;
            }
        });
        if (!hasAge) {
            failures.push('[' + key + '] interaction_point[' + idx + '] (' + escTrunc(ip.topic, 30) + ') 所有年龄字段均为空/null');
        }
    });

    return failures;
}

// ── T4: 禁用术语扫描 ──

function checkForbiddenTerms(chapter, key) {
    var failures = [];

    CONTENT_SCAN_FIELDS.forEach(function (field) {
        var text = chapter[field] || '';
        FORBIDDEN_TERMS.forEach(function (ft) {
            if (text.indexOf(ft.term) !== -1) {
                failures.push(
                    '[' + key + '] ' + field + ' 含禁用术语: "' + ft.term + '" — ' + ft.reason
                );
            }
        });
    });

    return failures;
}

// ── T5: 状态机合法性 ──

var NON_STATE_ACTIONS = ['created', 'updated', 'deleted', 'revision_submitted', 'status_change'];

function checkStateMachine(chapter, key) {
    var failures = [];
    var history = chapter.review_history || [];

    // 检查当前状态
    var currentStatus = chapter.review_status;
    if (currentStatus && VALID_STATUSES.indexOf(currentStatus) === -1) {
        failures.push('[' + key + '] 当前状态 "' + currentStatus + '" 不在合法状态集合中');
    }

    // 从历史记录中提取状态转换序列（过滤非状态动作）
    // status_change 是特殊动作（AI 修订完成），会重置状态流上下文
    var stateSequence = [];
    var statusChangeIndices = [];
    for (var i = 0; i < history.length; i++) {
        var action = history[i].action;
        if (action === 'status_change') {
            statusChangeIndices.push(i);
        } else if (VALID_STATUSES.indexOf(action) !== -1) {
            stateSequence.push({ action: action, index: i });
        } else if (NON_STATE_ACTIONS.indexOf(action) === -1) {
            failures.push('[' + key + '] review_history[' + i + '] 未知动作类型: "' + action + '"');
        }
    }

    // 验证状态转换
    if (stateSequence.length > 0) {
        // 查找最后一个 status_change 的索引
        var lastStatusChangeIdx = statusChangeIndices.length > 0
            ? statusChangeIndices[statusChangeIndices.length - 1]
            : -1;

        for (var j = 0; j < stateSequence.length; j++) {
            var current = stateSequence[j].action;
            if (j === 0) continue;

            var prev = stateSequence[j - 1].action;
            var prevIdx = stateSequence[j - 1].index;

            // 如果前一个状态动作之后出现了 status_change，
            // 则当前状态动作是 post-status_change 的新阶段，跳过严格转换检查
            if (lastStatusChangeIdx >= 0 && prevIdx < lastStatusChangeIdx && stateSequence[j].index > lastStatusChangeIdx) {
                continue;
            }

            var allowed = VALID_TRANSITIONS[prev];
            if (!allowed) {
                failures.push('[' + key + '] review_history[' + stateSequence[j].index + '] 前置状态 "' + prev + '" 无转换规则');
            } else if (allowed.indexOf(current) === -1) {
                failures.push(
                    '[' + key + '] review_history[' + stateSequence[j].index + '] 非法状态转换: ' +
                    prev + ' → ' + current + ' (允许: ' + allowed.join(', ') + ')'
                );
            }
        }

        // 最后一个状态动作应与当前 review_status 一致
        // 但如果之后有 status_change，不强制一致（status_change 代表新的审核阶段）
        var lastStateAction = stateSequence[stateSequence.length - 1].action;
        var lastStateIdx = stateSequence[stateSequence.length - 1].index;
        var hasStatusChangeAfter = lastStatusChangeIdx >= 0 && lastStatusChangeIdx > lastStateIdx;

        if (!hasStatusChangeAfter && lastStateAction !== currentStatus) {
            failures.push(
                '[' + key + '] review_history 最后状态动作 (' + lastStateAction +
                ') 与当前 review_status (' + currentStatus + ') 不一致'
            );
        }
    }

    return failures;
}

// ── T6: 公开版 hash 一致性 ──

function checkHashConsistency() {
    var failures = [];

    // 加载源文件
    var source;
    try {
        source = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    } catch (e) {
        return ['无法读取源文件: ' + META_PATH + ' — ' + e.message];
    }

    // 加载公开版
    var pub;
    try {
        pub = JSON.parse(fs.readFileSync(PUBLIC_META_PATH, 'utf8'));
    } catch (e) {
        return ['无法读取公开版文件: ' + PUBLIC_META_PATH + ' — ' + e.message];
    }

    // 从源数据手动构建公开版内容的确定性序列化
    var sourceChapters = source.chapters || {};
    var chapterKeys = Object.keys(sourceChapters).sort(function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
    });

    // 第一步：构建脱敏版本（与 build-public-metadata.js 完全一致的逻辑）
    var publicChapters = {};
    chapterKeys.forEach(function (key) {
        var srcChapter = sourceChapters[key];
        var pubChapter = {};
        PUBLIC_FIELDS.forEach(function (field) {
            if (srcChapter.hasOwnProperty(field)) {
                pubChapter[field] = srcChapter[field];
            }
        });
        publicChapters[key] = pubChapter;
    });

    // 第二步：计算哈希（与 build-public-metadata.js 完全一致）
    var hashParts = [];
    chapterKeys.forEach(function (key) {
        var ch = publicChapters[key];
        var fieldParts = [];
        PUBLIC_FIELDS.forEach(function (f) {
            if (ch.hasOwnProperty(f)) {
                fieldParts.push(JSON.stringify(f) + ':' + JSON.stringify(ch[f]));
            }
        });
        hashParts.push('"' + key + '":{' + fieldParts.join(',') + '}');
    });

    var chaptersStr = '{' + hashParts.join(',') + '}';
    var computedHash = crypto.createHash('sha256').update(chaptersStr, 'utf8').digest('hex').slice(0, 8);

    var pubHash = pub._content_hash || '';
    if (computedHash !== pubHash) {
        failures.push(
            '公开版 hash 不一致: 计算值=' + computedHash + '，文件中=' + pubHash +
            '。请运行 node scripts/build-public-metadata.js 重新生成'
        );
    } else {
        console.log('  [T6] hash 一致: ' + computedHash);
    }

    return failures;
}

// ── 主流程 ──

function run() {
    var args = process.argv.slice(2).filter(function (a) { return !a.startsWith('--'); });
    var isVerbose = process.argv.indexOf('--verbose') !== -1;

    console.log('\n  \x1b[36m元数据质量回归测试\x1b[0m');
    console.log('  \x1b[2m───────────────────\x1b[0m\n');

    // 加载元数据
    var metadata;
    try {
        metadata = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    } catch (e) {
        console.error('  \x1b[31m✗ 无法读取元数据文件: ' + META_PATH + '\x1b[0m');
        console.error('  ' + e.message);
        process.exit(1);
    }

    var allChapters = metadata.chapters || {};
    var allKeys = Object.keys(allChapters).sort(function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
    });

    // 筛选测试范围
    var targetKeys;
    if (args.length > 0) {
        targetKeys = args.map(function (arg) {
            return String(parseInt(arg.replace(/^ch0*/, ''), 10));
        }).filter(function (k) { return k !== 'NaN'; });
    } else {
        targetKeys = allKeys;
    }

    if (targetKeys.length === 0) {
        console.error('  未找到匹配章节');
        process.exit(1);
    }

    console.log('  测试范围: ' + plural(targetKeys.length, '章') + ' | ' + '6 类测试\n');

    // ── 运行 T1-T5（逐章） ──
    var tests = [
        { id: 'T1', name: '必填字段完整性', fn: checkFieldCompleteness },
        { id: 'T2', name: 'safety_notes 数量 (≥3)', fn: checkSafetyNotesCount },
        { id: 'T3', name: 'interaction_points 结构', fn: checkInteractionPoints },
        { id: 'T4', name: '禁用术语扫描', fn: checkForbiddenTerms },
        { id: 'T5', name: '状态机合法性', fn: checkStateMachine },
    ];

    var allFailures = {};
    var totalPass = 0;
    var totalFail = 0;

    tests.forEach(function (test) {
        var testFailures = [];
        var chapterFailCount = 0;
        var chapterCount = 0;

        targetKeys.forEach(function (key) {
            var chapter = allChapters[key];
            if (!chapter) {
                testFailures.push('[' + key + '] 章节不存在');
                return;
            }
            chapterCount++;
            var fails = test.fn(chapter, key);
            if (fails.length > 0) {
                chapterFailCount++;
                testFailures = testFailures.concat(fails);
            }
        });

        allFailures[test.id] = testFailures;
        var passCount = chapterCount - chapterFailCount;

        if (testFailures.length === 0) {
            console.log('  [' + test.id + '] ' + test.name + ': \x1b[32m✓ 全部通过\x1b[0m (' + chapterCount + '章)');
            totalPass++;
        } else {
            console.log('  [' + test.id + '] ' + test.name + ': \x1b[31m✗ ' + plural(testFailures.length, '项') + ' 失败\x1b[0m (' + chapterFailCount + '/' + chapterCount + '章)');
            totalFail++;
        }

        if (isVerbose && testFailures.length > 0) {
            testFailures.forEach(function (f) {
                console.log('        ' + f);
            });
        }
    });

    // ── 运行 T6（跨章节） ──
    console.log('');
    var t6Failures = checkHashConsistency();
    allFailures['T6'] = t6Failures;

    if (t6Failures.length === 0) {
        // hash 一致的消息已在 checkHashConsistency 中输出
        totalPass++;
    } else {
        console.log('  [T6] 公开版 hash 一致性: \x1b[31m✗ ' + plural(t6Failures.length, '项') + ' 失败\x1b[0m');
        totalFail++;
        t6Failures.forEach(function (f) {
            console.log('        ' + f);
        });
    }

    // ── 汇总报告 ──
    var totalTestItems = tests.length + 1; // T1-T5 + T6
    var allFailureItems = 0;
    Object.keys(allFailures).forEach(function (tid) {
        allFailureItems += allFailures[tid].length;
    });

    console.log('\n' + '─'.repeat(50));
    console.log('[test-metadata] 结果: ' + totalPass + '/' + totalTestItems + ' 类测试通过');

    if (totalFail > 0) {
        console.log('[test-metadata] ' + plural(allFailureItems, '项') + ' 失败，共 ' + totalFail + ' 类测试不通过');
        console.log('');

        // 汇总失败项
        Object.keys(allFailures).forEach(function (tid) {
            var fails = allFailures[tid];
            if (fails.length > 0) {
                console.log('  [' + tid + '] ' + plural(fails.length, '项'));
                if (!isVerbose) {
                    // 非 verbose 模式也输出前 5 项供参考
                    var show = Math.min(fails.length, 5);
                    for (var i = 0; i < show; i++) {
                        console.log('        ' + fails[i]);
                    }
                    if (fails.length > 5) {
                        console.log('        … 还有 ' + (fails.length - 5) + ' 项，使用 --verbose 查看全部');
                    }
                }
            }
        });

        process.exit(1);
    } else {
        console.log('[test-metadata] 所有 ' + totalTestItems + ' 类测试全部通过 ✓');
        console.log('');
    }
}

run();
