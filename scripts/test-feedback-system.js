/**
 * 反馈邮件系统综合测试
 * 验证 buildFeedbackEmailBody / sendFeedbackEmail / feedback-store / SOP 解析
 * 
 * 用法: node scripts/test-feedback-system.js
 */

'use strict';

// ============================================================
// 模拟函数（从 feedback-email.js 复制，独立测试用）
// ============================================================

var TYPE_LABELS = {
    bug: '我要报错',
    suggestion: '我要建议',
    help: '我要帮助',
    general: '用户反馈'
};

function formatBeijingTime() {
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    var y = bj.getUTCFullYear();
    var m = String(bj.getUTCMonth() + 1).padStart(2, '0');
    var d = String(bj.getUTCDate()).padStart(2, '0');
    var h = String(bj.getUTCHours()).padStart(2, '0');
    var min = String(bj.getUTCMinutes()).padStart(2, '0');
    var s = String(bj.getUTCSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
}

function buildFeedbackEmailBody(messages, feedbackType, aiContent, userId) {
    var label = TYPE_LABELS[feedbackType] || TYPE_LABELS['general'];
    var bjTime = formatBeijingTime();
    var parts = [];

    parts.push('【反馈类型】' + label + ' (' + feedbackType + ')');
    if (userId) parts.push('【用户ID】' + userId);
    parts.push('【提交时间】' + bjTime + '（北京时间）');
    parts.push('');

    parts.push('━━━ 用户反馈内容 ━━━');
    var userMsgs = (messages || []).filter(function (m) { return m.role === 'user'; });
    for (var i = 0; i < userMsgs.length; i++) {
        var msg = (userMsgs[i].content || '').replace(/\[FEEDBACK:SOP=\w+\]\s*/g, '');
        if (msg.trim()) parts.push(msg.trim());
    }
    parts.push('');

    var cleanAi = (aiContent || '').replace('[FEEDBACK:CONFIRM]', '').trim();
    if (cleanAi) {
        parts.push('━━━ AI 汇总确认 ━━━');
        parts.push(cleanAi);
    }

    return parts.join('\n');
}

// 模拟 sendFeedbackEmail 的主题行构建
function buildSubject(content, feedbackType) {
    var label = TYPE_LABELS[feedbackType] || TYPE_LABELS['general'];
    var bjTime = formatBeijingTime();
    return '【道德经亲子体验营】用户反馈 · ' + label + ' · ' + bjTime;
}

// 模拟 api/chat.js 中的 SOP 类型解析
function parseFeedbackType(messages) {
    var feedbackType = 'general';
    var firstUserMsg = (messages || []).filter(function (m) { return m.role === 'user'; })[0];
    if (firstUserMsg && firstUserMsg.content) {
        var typeMatch = firstUserMsg.content.match(/\[FEEDBACK:SOP=(\w+)\]/);
        if (typeMatch) {
            feedbackType = typeMatch[1];
        }
    }
    return feedbackType;
}

// 模拟 feedback-store.js 中的 extractSummary
function extractSummary(messages, feedbackType) {
    var record = {
        type: feedbackType,
        content: '',
        userId: 'anonymous',
        pageUrl: '',
        timestamp: new Date().toISOString()
    };

    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        if (msg.role === 'user' && msg.content) {
            var metaMatch = msg.content.match(/__META__:\s*uid=([^|]+)\s*\|\s*url=([^|]+)\s*\|\s*time=(.+)/);
            if (metaMatch) {
                record.userId = metaMatch[1].trim();
                record.pageUrl = metaMatch[2].trim();
                record.timestamp = metaMatch[3].trim();
            }
            var cleanContent = msg.content
                .replace(/\[FEEDBACK[^\]]*\]\s*/g, '')
                .replace(/__META__:.*$/gm, '')
                .trim();
            if (cleanContent) {
                record.content += (record.content ? '\n---\n' : '') + cleanContent;
            }
        }
    }

    return record;
}

// ============================================================
// 测试数据
// ============================================================

var testCases = [
    {
        name: 'bug 反馈 — 多轮对话',
        type: 'bug',
        messages: [
            { role: 'user', content: '[FEEDBACK:SOP=bug] 首页加载非常慢，打开要10秒以上' },
            { role: 'assistant', content: '请问您使用的是什么浏览器？是中国大陆网络环境吗？' },
            { role: 'user', content: '用的是 Chrome 浏览器，在中国大陆访问' },
            { role: 'assistant', content: '了解了。让我汇总一下您的反馈。[FEEDBACK:CONFIRM] 用户反馈首页加载速度慢（10秒以上），使用 Chrome 浏览器，中国大陆网络环境。建议检查 CDN 节点覆盖和资源压缩。' }
        ],
        aiContent: '[FEEDBACK:CONFIRM] 用户反馈首页加载速度慢（10秒以上），使用 Chrome 浏览器，中国大陆网络环境。建议检查 CDN 节点覆盖和资源压缩。',
        userId: 'user_test_bug_001'
    },
    {
        name: 'suggestion 反馈 — 含元数据',
        type: 'suggestion',
        messages: [
            { role: 'user', content: '__META__: uid=test_user_sug_002 | url=https://hui-skill.org/?ch=1 | time=2026-05-19T21:00:00+08:00\n[FEEDBACK:SOP=suggestion] 建议增加夜间模式，方便晚上阅读' },
            { role: 'assistant', content: '好的建议！已记录。[FEEDBACK:CONFIRM] 用户建议增加夜间模式功能，以提升晚间阅读体验。来源页面：道德经第1章。' }
        ],
        aiContent: '[FEEDBACK:CONFIRM] 用户建议增加夜间模式功能，以提升晚间阅读体验。来源页面：道德经第1章。',
        userId: 'test_user_sug_002'
    },
    {
        name: 'help 反馈 — 简短反馈',
        type: 'help',
        messages: [
            { role: 'user', content: '[FEEDBACK:SOP=help] 想知道如何切换孩子的年龄段' },
            { role: 'assistant', content: '您可以在亲子时光页面顶部的下拉菜单中选择年龄段。[FEEDBACK:CONFIRM] 用户询问如何切换孩子年龄段。已告知通过亲子时光页面顶部下拉菜单切换。' }
        ],
        aiContent: '[FEEDBACK:CONFIRM] 用户询问如何切换孩子年龄段。已告知通过亲子时光页面顶部下拉菜单切换。',
        userId: 'user_test_help_003'
    }
];

// ============================================================
// 执行测试
// ============================================================

var passed = 0;
var failed = 0;
var results = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
        results.push('  ✅ ' + name + (detail ? ': ' + detail : ''));
    } else {
        failed++;
        results.push('  ❌ ' + name + (detail ? ': ' + detail : ''));
    }
}

console.log('============================================================');
console.log('  反馈邮件系统综合测试');
console.log('  测试时间: ' + formatBeijingTime() + ' (北京时间)');
console.log('============================================================\n');

for (var t = 0; t < testCases.length; t++) {
    var tc = testCases[t];
    console.log('━━━ 测试用例 #' + (t + 1) + ': ' + tc.name + ' ━━━');
    results = [];
    passed = 0;
    failed = 0;

    // ---- 1. 测试 SOP 类型解析 ----
    var parsedType = parseFeedbackType(tc.messages);
    check('SOP 类型解析', parsedType === tc.type,
        '期望 ' + tc.type + ' / 实际 ' + parsedType);

    // ---- 2. 测试邮件主题格式 ----
    var subject = buildSubject('dummy', tc.type);
    var subjectHasLabel = subject.indexOf(TYPE_LABELS[tc.type]) !== -1;
    var subjectHasTime = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(subject);
    var subjectPrefix = subject.indexOf('【道德经亲子体验营】用户反馈 · ') === 0;
    check('主题包含类型标签', subjectHasLabel,
        '包含 "' + TYPE_LABELS[tc.type] + '"');
    check('主题包含北京时间', subjectHasTime,
        '格式 YYYY-MM-DD HH:mm:ss');
    check('主题前缀正确', subjectPrefix,
        subject);

    // ---- 3. 测试邮件正文 ----
    var emailBody = buildFeedbackEmailBody(tc.messages, tc.type, tc.aiContent, tc.userId);
    
    // 检查反馈类型行
    var expectedTypeLine = '【反馈类型】' + TYPE_LABELS[tc.type] + ' (' + tc.type + ')';
    check('正文反馈类型行', emailBody.indexOf(expectedTypeLine) !== -1,
        expectedTypeLine);

    // 检查用户ID
    if (tc.userId) {
        check('正文用户ID', emailBody.indexOf('【用户ID】' + tc.userId) !== -1,
            '【用户ID】' + tc.userId);
    }

    // 检查北京时间
    check('正文北京时间', emailBody.indexOf('（北京时间）') !== -1,
        '包含"（北京时间）"标注');

    // 检查用户反馈内容段
    check('正文用户反馈内容段', emailBody.indexOf('━━━ 用户反馈内容 ━━━') !== -1);

    // [FEEDBACK:SOP=*] 前缀不应出现在正文中
    check('正文不含 SOP 前缀', emailBody.indexOf('[FEEDBACK:SOP=') === -1);

    // [FEEDBACK:CONFIRM] 标记不应出现在正文中
    check('正文不含 CONFIRM 标记', emailBody.indexOf('[FEEDBACK:CONFIRM]') === -1);

    // AI 汇总确认段
    check('正文 AI 汇总确认段', emailBody.indexOf('━━━ AI 汇总确认 ━━━') !== -1);

    // ---- 4. 测试 feedback-store extractSummary ----
    var record = extractSummary(tc.messages, tc.type);
    check('存储类型正确', record.type === tc.type,
        '期望 ' + tc.type + ' / 实际 ' + record.type);
    check('存储内容非空', record.content.length > 0,
        '长度 ' + record.content.length + ' chars');

    // 检查是否有 META 数据（第二个用例子有）
    if (tc.name.indexOf('含元数据') !== -1) {
        check('存储提取元数据 userId', record.userId === 'test_user_sug_002',
            '期望 test_user_sug_002 / 实际 ' + record.userId);
        check('存储提取元数据 pageUrl', record.pageUrl === 'https://hui-skill.org/?ch=1',
            '期望 https://hui-skill.org/?ch=1 / 实际 ' + record.pageUrl);
    }

    // ---- 打印正文预览 ----
    console.log('\n  ┌─ 邮件正文预览 ─────────────────────────────');
    emailBody.split('\n').forEach(function (line) {
        console.log('  │ ' + line);
    });
    console.log('  └────────────────────────────────────────────');

    console.log('\n  结果: ' + passed + '/' + (passed + failed) + ' 通过\n');
}

// ============================================================
// 边界情况测试
// ============================================================

console.log('━━━ 边界情况测试 ━━━');
results = [];
passed = 0;
failed = 0;

// 1. 空 messages
var emptyBody = buildFeedbackEmailBody([], 'general', 'test AI', 'uid001');
check('空 messages 不崩溃', emptyBody.length > 0);

// 2. 无 aiContent
var noAiBody = buildFeedbackEmailBody([{ role: 'user', content: 'hello' }], 'suggestion', '', 'uid002');
check('无 AI 汇总时不含 AI 段', noAiBody.indexOf('━━━ AI 汇总确认 ━━━') === -1);

// 3. 无 userId
var noUserIdBody = buildFeedbackEmailBody([{ role: 'user', content: 'hello' }], 'help', 'AI summary', '');
check('无用户ID时不显示用户ID行', noUserIdBody.indexOf('【用户ID】') === -1);

// 4. 未知 feedbackType
var unknownBody = buildFeedbackEmailBody([{ role: 'user', content: 'hello' }], 'unknown_type', 'AI ok', 'uid003');
check('未知类型回退到 general', unknownBody.indexOf('【反馈类型】用户反馈 (unknown_type)') !== -1);

// 5. messages 中多个 user 消息
var multiBody = buildFeedbackEmailBody([
    { role: 'user', content: '第一次反馈内容' },
    { role: 'assistant', content: '问一个问题' },
    { role: 'user', content: '补充说明' }
], 'bug', 'AI 已确认', 'uid004');
check('多条用户消息都被包含', multiBody.indexOf('第一次反馈内容') !== -1 && multiBody.indexOf('补充说明') !== -1);

// 6. 复杂 SOP 前缀清理
var sopBody = buildFeedbackEmailBody([
    { role: 'user', content: '[FEEDBACK:SOP=bug] 测试内容 [FEEDBACK:SOP=bug] 不应出现SOP' }
], 'bug', 'AI ok', 'uid005');
check('SOP 前缀被完全清除', sopBody.indexOf('[FEEDBACK:SOP=') === -1 && sopBody.indexOf('测试内容') !== -1 && sopBody.indexOf('不应出现SOP') !== -1);

console.log('\n  结果: ' + passed + '/' + (passed + failed) + ' 通过\n');

// ============================================================
// 三个类型标签对比测试
// ============================================================

console.log('━━━ 三类型标签映射测试 ━━━');
results = [];
passed = 0;
failed = 0;

var typeChecks = [
    { input: 'bug', label: '我要报错' },
    { input: 'suggestion', label: '我要建议' },
    { input: 'help', label: '我要帮助' },
    { input: 'general', label: '用户反馈' }
];

for (var c = 0; c < typeChecks.length; c++) {
    var chk = typeChecks[c];
    var chkLabel = TYPE_LABELS[chk.input];
    var chkSubject = buildSubject('', chk.input);
    check(
        '类型 "' + chk.input + '" → 标签 "' + chk.label + '"',
        chkLabel === chk.label && chkSubject.indexOf(chk.label) !== -1,
        'label=' + chkLabel + ' subject包含=' + (chkSubject.indexOf(chk.label) !== -1)
    );
}

console.log('\n  结果: ' + passed + '/' + (passed + failed) + ' 通过\n');

// ============================================================
// feedback_type 参数提取测试（v2 修复：多轮对话中 SOP 前缀丢失）
// ============================================================

console.log('━━━ feedback_type 参数提取测试（SOP前缀丢失修复） ━━━');
results = [];
passed = 0;
failed = 0;

// 模拟后端 feedback_type 提取逻辑（v2）
function extractFeedbackTypeV2(feedback_type, messages) {
    var feedbackType = feedback_type || 'general';
    if (feedbackType === 'general') {
        var firstUserMsg = (messages || []).filter(function (m) { return m.role === 'user'; })[0];
        if (firstUserMsg && firstUserMsg.content) {
            var typeMatch = firstUserMsg.content.match(/\[FEEDBACK:SOP=(\w+)\]/);
            if (typeMatch) {
                feedbackType = typeMatch[1];
            }
        }
    }
    return feedbackType;
}

// 场景1: 前端传入 feedback_type（修复后，多轮对话场景）
check('feedback_type=bug → feedbackType=bug',
    extractFeedbackTypeV2('bug', [{role:'user', content:'我要报错（DOM文本，无SOP前缀）'}]) === 'bug');
check('feedback_type=suggestion → feedbackType=suggestion',
    extractFeedbackTypeV2('suggestion', [{role:'user', content:'我要建议'}]) === 'suggestion');
check('feedback_type=help → feedbackType=help',
    extractFeedbackTypeV2('help', [{role:'user', content:'我要帮助'}]) === 'help');

// 场景2: 无 feedback_type，从消息中解析 SOP 前缀（向后兼容）
check('无feedback_type + 消息有SOP前缀 → 正确解析',
    extractFeedbackTypeV2(null, [{role:'user', content:'[FEEDBACK:SOP=bug] 描述问题'}]) === 'bug');
check('无feedback_type + 消息有SOP前缀(suggestion) → 正确解析',
    extractFeedbackTypeV2('', [{role:'user', content:'[FEEDBACK:SOP=suggestion] 建议内容'}]) === 'suggestion');

// 场景3: 无 feedback_type + 消息无 SOP 前缀（修复前 Bug 场景 → 正确回退 general）
check('无feedback_type + 无SOP前缀 → 回退 general',
    extractFeedbackTypeV2(null, [{role:'user', content:'我要报错（丢失前缀）'}]) === 'general');
check('无feedback_type + 空消息 → 回退 general',
    extractFeedbackTypeV2(null, []) === 'general');

// 场景4: feedback_type 优先级高于消息中的 SOP 前缀
check('feedback_type 优先于消息SOP前缀',
    extractFeedbackTypeV2('bug', [{role:'user', content:'[FEEDBACK:SOP=help] 不同步的旧前缀'}]) === 'bug');

console.log('\n  结果: ' + passed + '/' + (passed + failed) + ' 通过\n');

console.log('============================================================');
console.log('  测试完成!');
console.log('============================================================');
