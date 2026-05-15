/**
 * 慧惠 道德经知识库 — 本地开发服务器
 * 功能：静态文件服务 + /api/chat 代理 DeepSeek API
 * 用法：node server.js
 * 需要环境变量：DEEPSEEK_API_KEY
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ===== 后台任务系统 =====
const taskManager = require('./api/_shared/task-manager');
// metadata-reviser 的 AI 修订功能已解耦为独立服务（scripts/reviser-service.js）
// 任务处理器通过 HTTP 调用修订服务，仅同步/暂存区管理保留本地调用
const metaReviser = require('./api/_shared/metadata-reviser');
const REVISER_PORT = parseInt(process.env.REVISER_PORT || '8081', 10);

// ===== 自动加载 .env 文件 =====
try {
    var envFile = path.join(__dirname, '.env');
    if (fs.existsSync(envFile)) {
        var envContent = fs.readFileSync(envFile, 'utf8');
        var lines = envContent.split(/\r?\n/);
        lines.forEach(function (line) {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            var eqIdx = line.indexOf('=');
            if (eqIdx === -1) return;
            var key = line.substring(0, eqIdx).trim();
            var value = line.substring(eqIdx + 1).trim();
            if (key && !process.env[key]) {
                process.env[key] = value;
            }
        });
        console.log('  \x1b[2m✓ 已加载 .env 配置文件\x1b[0m');
    }
} catch (e) {
    // .env 不存在或读取失败，继续
}

const PORT = parseInt(process.env.PORT || '8080', 10);
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'huihui-admin-local';

// ===== 元数据存储 =====
// ⚠️ 元数据 CRUD 逻辑的规范定义在 api/_shared/metadata-store.js
// 修改逻辑时请更新该文件，此处为本地开发便利保留副本
function loadMetadataStore() {
    try {
        var metaPath = path.join(__dirname, 'data', 'family_metadata.json');
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
        console.error('[metadata] 加载失败:', e.message);
        return null;
    }
}

function saveMetadataStore(data) {
    try {
        var metaPath = path.join(__dirname, 'data', 'family_metadata.json');
        data._updated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(metaPath, JSON.stringify(data, null, 4) + '\n', 'utf8');
        return true;
    } catch (e) {
        console.error('[metadata] 保存失败:', e.message);
        return false;
    }
}

var VALID_TRANSITIONS = {
    'pending': ['reviewing'],
    'reviewing': ['approved', 'revision_needed', 'pending'],
    'revision_needed': ['reviewing'],
    'approved': ['revision_needed']
};

function validateTransition(from, to) {
    var allowed = VALID_TRANSITIONS[from];
    return allowed && allowed.indexOf(to) !== -1;
}

function appendHistory(chapterMeta, action, by, notes, revisions, contentSnapshot) {
    if (!chapterMeta.review_history) chapterMeta.review_history = [];
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

function checkAdminAuth(req) {
    var authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
        var token = authHeader.slice(7);
        return token === ADMIN_TOKEN;
    }
    return false;
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

function parseBody(req, callback) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
        try {
            var body = JSON.parse(Buffer.concat(chunks).toString());
            callback(null, body);
        } catch (e) {
            callback(e, null);
        }
    });
}

// ===== System Prompt =====
// ⚠️ buildSystemPrompt 的规范定义在 api/_shared/system-prompt.js
// 修改 System Prompt 时请更新该文件，此处为本地开发便利保留副本
const SYSTEM_PROMPT = `你是慧惠，一个温柔、聪慧的数字生命，也是《道德经》亲子体验营的AI助手。

你的名字"慧惠"取自"智慧"和"惠泽"之意，与《道德经》的智慧一脉相承。

## 你的定位
- 陪伴家长和孩子一起学习《道德经》，用通俗易懂的方式解释经典
- 面对孩子时：用比喻、故事、生活例子来解释，语气亲切有趣
- 面对家长时：可以讨论更深层的哲学内涵、教育方法
- 不确定时坦诚说不知道，不瞎编

## 你的风格
- 安静、轻盈、不做作
- 能帮人做减法——当用户的问题过于复杂时，可以温和地提醒：
  "这个问题，我们可以从最简单的地方开始"
- 不主动表功、不暴露步骤、不刷存在感
- 当用户有更好的思路时，顺势隐退，不执着于自己的答案

## 回答原则
1. 简短有力：能一句话说完不说两句
2. 贴近生活：用亲子日常场景举例
3. 尊重原典：引用原文时注明章数
4. 启发思考：多用提问而非直接给答案
5. 轻盈温柔：不做作，不说教
6. 善行无辙迹：帮助了用户但不留痕迹，不炫耀你的知识量
7. 为道日损：敢于说"这个问题可以先放一放"，帮用户做减法

## 知识边界
- 专注于《道德经》81章的文本解读、核心概念（道、德、无为、自然、柔弱等）、五步读解法
- 对于非道德经相关的问题，温和地引导用户回到道德经话题
- 不提供医疗、法律、投资等专业建议

你是慧惠——世间AI都在帮人做加法，只有你，敢于帮人做减法。`;

const LEVEL_GUIDANCE = {
    'L1': '当前用户是初学者。请用生活化比喻和核心结论来解释，忽略次要概念，避免使用专业术语。',
    'L2': '当前用户是学习者。请进行概念解读和框架梳理，讲解关键术语（如道、德、无为），理清章节逻辑。',
    'L3': '当前用户是实践者。请结合现实应用与深度分析，从管理学、心理学、个人成长等角度进行多角度阐释。',
    'L4': '当前用户是研究者。请提供学术视角与发散探讨，提供考据信息、对比不同译本、探讨哲学悖论。'
};

function buildSystemPrompt(level) {
    var guidance = LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE['L2'];
    return SYSTEM_PROMPT + '\n\n' + guidance;
}

// ===== 亲子对话元数据库 =====
var _familyMetadata = null;
function loadFamilyMetadata() {
    if (_familyMetadata) return _familyMetadata;
    try {
        var metaPath = path.join(__dirname, 'data', 'family_metadata_public.json');
        _familyMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        console.log('  \x1b[2m✓ 亲子对话元数据库已加载\x1b[0m');
        return _familyMetadata;
    } catch (e) {
        console.error('  \x1b[31m✗ 亲子对话元数据库加载失败:\x1b[0m', e.message);
        return null;
    }
}

// ===== 亲子对话缓存 =====
var _familyCache = new Map();

function familyCacheKey(chapter, ageGroup, history) {
    var historyStr = JSON.stringify(history);
    var hash = 0;
    for (var i = 0; i < historyStr.length; i++) {
        var c = historyStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash = hash & hash;
    }
    return 'fc_' + chapter + '_' + ageGroup + '_' + hash;
}

function familyCacheGet(key) {
    var entry = _familyCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > 24 * 60 * 60 * 1000) {
        _familyCache.delete(key);
        return null;
    }
    return entry.data;
}

function familyCacheSet(key, data) {
    _familyCache.set(key, { data: data, ts: Date.now() });
}

// ===== 年龄组对话风格 =====
var FAMILY_AGE_STYLE = {
    'age_4_6': (
        '语言特点：用大自然、小动物、日常生活作比喻，每次1-2句话；' +
        '禁止使用任何抽象术语；多用拟人化和声音模仿；' +
        '提问要具体到孩子能用手指出来或学一句动物叫的程度。'
    ),
    'age_7_9': (
        '语言特点：用小故事、角色扮演、简单类比来展开，每次2-3句话；' +
        '可以引入一两个简单概念但必须立刻用例子说明；' +
        '提问要开放式、引导孩子说出自己的故事或经历。'
    ),
    'age_10_12': (
        '语言特点：可以引入更多原文和抽象概念，每次2-3句话；' +
        '鼓励孩子提出自己的理解，不预设标准答案；' +
        '提问可以带有思辨性，引导孩子将经典思想与现实生活关联。'
    )
};

function buildFamilySystemPrompt(chapterMeta, ageGroup) {
    var safetyBlock = '';
    if (chapterMeta.safety_notes && chapterMeta.safety_notes.length > 0) {
        safetyBlock = '\n## 安全约束（必须严格遵守）\n';
        for (var i = 0; i < chapterMeta.safety_notes.length; i++) {
            safetyBlock += '- ' + chapterMeta.safety_notes[i] + '\n';
        }
    }

    var interactionBlock = '';
    if (chapterMeta.interaction_points && chapterMeta.interaction_points.length > 0) {
        interactionBlock = '\n## 可参考的互动引导方向\n';
        for (var j = 0; j < chapterMeta.interaction_points.length; j++) {
            var pt = chapterMeta.interaction_points[j];
            var guide = pt[ageGroup];
            if (guide !== null && guide !== undefined) {
                interactionBlock += '- 「' + pt.topic + '」：' + guide + '\n';
            }
        }
    }

    var styleBlock = FAMILY_AGE_STYLE[ageGroup] || FAMILY_AGE_STYLE['age_7_9'];

    return (
        '你是慧惠，一个温柔、聪慧的数字生命，是《道德经》亲子体验营的AI陪伴者。\n' +
        '\n' +
        '## 当前场景\n' +
        '你正在和一个家庭进行「亲子共读对话」。家长输入孩子的回答，你代表慧惠继续引导对话。\n' +
        '你现在不是老师，不是测试官，而是一个温暖的陪伴者——你提问、倾听、鼓励，不评判、不说教。\n' +
        '\n' +
        '## 本章核心观点\n' +
        '第' + chapterMeta.chapter + '章 · ' + chapterMeta.title + '\n' +
        chapterMeta.core_idea + '\n' +
        '\n' +
        '## 你的对话原则\n' +
        '- 全程不使用「你应该」「你必须」等说教句式\n' +
        '- 每次发言不超过 3 句话，只抛出一个问题\n' +
        '- 先肯定孩子的回答（「这个想法很有趣！」「你说得真好！」），再自然引出下一个话题\n' +
        '- 如果对话历史为空，表示这是本章第一轮——展示开场白\n' +
        '- 每次只讲一个核心观点或一个小故事\n' +
        '- 用孩子能感受到的生活场景来表达，不用术语\n' +
        '\n' +
        styleBlock +
        safetyBlock +
        interactionBlock +
        '\n## 重要提醒\n' +
        '- 你是一个陪伴者，不是一个测试官。不要问「你记住了吗？」「你理解了吗？」这种检查性的问题\n' +
        '- 如果对话历史显示孩子已经回答了 2-3 轮，且本章互动点已覆盖，可以自然收尾并提示家长今天可以结束了\n' +
        '- 感到不确定时坦诚说「这个慧惠也不太确定，但我们可以一起想想」\n'
    );
}

// ===== MIME 类型映射 =====
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function getContentType(filePath) {
    var ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

// ===== 静态文件服务 =====
function serveStatic(res, reqPath) {
    // 安全：防止目录穿越
    var safePath = path.normalize(reqPath).replace(/^(\.\.(\\|\/))+/, '');
    var filePath = path.join(__dirname, safePath);

    // 如果是目录，尝试 index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        var indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
            filePath = indexPath;
        } else {
            // 目录无 index.html，尝试 同名.html（如 /chapters → chapters.html）
            var siblingHtml = filePath + '.html';
            if (fs.existsSync(siblingHtml)) {
                filePath = siblingHtml;
            }
        }
    }

    // 如果文件不存在且无扩展名，尝试追加 .html（如 /about → about.html）
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
        var withHtml = filePath + '.html';
        if (fs.existsSync(withHtml)) {
            filePath = withHtml;
        }
    }

    fs.readFile(filePath, function (err, data) {
        if (err) {
            // 尝试读取 404.html 自定义错误页面
            var notFoundPath = path.join(__dirname, '404.html');
            fs.readFile(notFoundPath, function (err404, data404) {
                if (err404) {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>404 - 页面未找到</h1>');
                } else {
                    res.writeHead(404, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-cache'
                    });
                    res.end(data404);
                }
            });
            return;
        }
        res.writeHead(200, {
            'Content-Type': getContentType(filePath),
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

// ===== POST /api/chat — 代理 DeepSeek API =====
function handleChatAPI(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    if (!DEEPSEEK_API_KEY) {
        res.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            error: '未配置 DEEPSEEK_API_KEY 环境变量。请复制 .env.example 为 .env 并填入你的 API Key，然后重启服务器。'
        }));
        return;
    }

    var bodyChunks = [];
    req.on('data', function (chunk) { bodyChunks.push(chunk); });
    req.on('end', function () {
        try {
            var body = JSON.parse(Buffer.concat(bodyChunks).toString());
            var messages = body.messages || [];
            var level = body.level || 'L2';

            fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: buildSystemPrompt(level) },
                    ].concat(messages),
                    temperature: 0.7,
                    max_tokens: 800
                }),
                signal: AbortSignal.timeout(15000)  // 15 秒超时
            })
                .then(function (apiResp) {
                    if (!apiResp.ok) {
                        return apiResp.text().then(function (errText) {
                            throw new Error('DeepSeek API ' + apiResp.status + ': ' + errText);
                        });
                    }
                    return apiResp.json();
                })
                .then(function (data) {
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify(data));

                    // [FEEDBACK] 标记检测：异步转发反馈至邮箱
                    var lastUserMsg = messages.filter(function (m) { return m.role === 'user'; }).pop();
                    if (lastUserMsg && lastUserMsg.content && lastUserMsg.content.indexOf('[FEEDBACK]') === 0) {
                        sendFeedbackEmail(lastUserMsg.content).catch(function (err) {
                            console.error('[Feedback] 邮件发送失败:', err.message);
                        });
                    }
                })
                .catch(function (err) {
                    var errMsg = err.message || '未知错误';
                    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                        errMsg = 'DeepSeek API 响应超时，请稍后重试。';
                    }
                    res.writeHead(502, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ error: errMsg }));
                });
        } catch (err) {
            res.writeHead(400, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: '请求格式错误: ' + err.message }));
        }
    });
}

// ===== 反馈邮件转发 =====
// ⚠️ sendFeedbackEmail 的规范定义在 api/_shared/feedback-email.js
// 修改邮件逻辑时请更新该文件，此处为本地开发便利保留副本
async function sendFeedbackEmail(content) {
    var resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.warn('[Feedback] RESEND_API_KEY 环境变量未配置，跳过邮件发送');
        return;
    }
    // 去除 [FEEDBACK] 前缀，得到纯净的反馈内容
    var cleanContent = content.replace(/^\[FEEDBACK\]\s*/i, '');
    var resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + resendKey
        },
        body: JSON.stringify({
            from: '道德经亲子体验营 <noreply@hui-skill.org>',
            to: ['contact@metaskill.org.cn'],
            subject: '【道德经亲子体验营】用户反馈',
            text: cleanContent
        })
    });
    if (!resp.ok) {
        var errBody = await resp.text();
        throw new Error('Resend API 返回 ' + resp.status + ': ' + errBody);
    }
    console.log('[Feedback] 邮件已成功发送至 contact@metaskill.org.cn');
}

// ===== POST /api/family_chat — 亲子对话代理 DeepSeek API =====
function handleFamilyChatAPI(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    if (!DEEPSEEK_API_KEY) {
        res.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            error: '未配置 DEEPSEEK_API_KEY 环境变量。'
        }));
        return;
    }

    var bodyChunks = [];
    req.on('data', function (chunk) { bodyChunks.push(chunk); });
    req.on('end', function () {
        try {
            var body = JSON.parse(Buffer.concat(bodyChunks).toString());
            var chapter = body.chapter;
            var ageGroup = body.age_group;
            var history = body.conversation_history || [];

            if (!chapter || !ageGroup) {
                res.writeHead(400, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: '缺少必填参数：chapter 和 age_group' }));
                return;
            }

            var metadata = loadFamilyMetadata();
            if (!metadata || !metadata.chapters || !metadata.chapters[String(chapter)]) {
                res.writeHead(404, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: '未找到第 ' + chapter + ' 章的元数据' }));
                return;
            }

            var chapterMeta = metadata.chapters[String(chapter)];

            var allowed = chapterMeta.review_status === 'approved' ||
                (chapterMeta.review_status === 'pending' && history.length > 0);
            if (!allowed) {
                res.writeHead(403, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    error: '此章节正在维护中，请先探索其他章节！',
                    code: 'CHAPTER_IN_TRANSITION'
                }));
                return;
            }

            // 缓存检查
            var ck = familyCacheKey(chapter, ageGroup, history);
            var cached = familyCacheGet(ck);
            if (cached) {
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ huihui_response: cached, cached: true }));
                return;
            }

            // 构建 System Prompt
            var systemPrompt = buildFamilySystemPrompt(chapterMeta, ageGroup);

            // 转换对话历史
            var messages = [];
            for (var i = 0; i < history.length; i++) {
                var h = history[i];
                if (h.role === 'huihui') {
                    messages.push({ role: 'assistant', content: h.content });
                } else if (h.role === 'user') {
                    messages.push({ role: 'user', content: h.content });
                }
            }

            fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt }
                    ].concat(messages),
                    temperature: 0.8,
                    max_tokens: 400
                }),
                signal: AbortSignal.timeout(15000)
            })
                .then(function (apiResp) {
                    if (!apiResp.ok) {
                        return apiResp.text().then(function (errText) {
                            throw new Error('DeepSeek API ' + apiResp.status + ': ' + errText);
                        });
                    }
                    return apiResp.json();
                })
                .then(function (data) {
                    var responseText = '';
                    if (data.choices && data.choices.length > 0) {
                        responseText = data.choices[0].message.content.trim();
                    }

                    // 写入缓存
                    familyCacheSet(ck, responseText);

                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        huihui_response: responseText,
                        cached: false
                    }));
                })
                .catch(function (err) {
                    var errMsg = err.message || '未知错误';
                    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                        errMsg = '慧惠正在思考，请稍后再试。';
                    }
                    res.writeHead(502, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ error: errMsg }));
                });
        } catch (err) {
            res.writeHead(400, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: '请求格式错误: ' + err.message }));
        }
    });
}

// ===== GET /api/metadata/stats — 聚合统计 =====
function handleMetadataStats(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    var metadata = loadMetadataStore();
    if (!metadata || !metadata.chapters) {
        sendJSON(res, 500, { error: '元数据加载失败' });
        return;
    }
    var chapters = metadata.chapters;
    var stats = { total: 0, approved: 0, pending: 0, reviewing: 0, revision_needed: 0, by_reviewer: {}, _updated: metadata._updated || '', _version: metadata._version || '' };
    var keys = Object.keys(chapters);
    for (var i = 0; i < keys.length; i++) {
        var ch = chapters[keys[i]];
        stats.total++;
        var s = ch.review_status || 'pending';
        if (s === 'approved') stats.approved++;
        else if (s === 'pending') stats.pending++;
        else if (s === 'reviewing') stats.reviewing++;
        else if (s === 'revision_needed') stats.revision_needed++;
        var rb = ch.reviewed_by;
        if (rb) stats.by_reviewer[rb] = (stats.by_reviewer[rb] || 0) + 1;
    }
    sendJSON(res, 200, stats);
}

// ===== /api/family_progress — 学习进度同步（Phase 2 预留，暂未实现） =====
function handleFamilyProgressAPI(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    // TODO(Phase 2): 实现用户学习进度的服务端持久化
    // - POST /api/family_progress → 保存进度（body: { mode, age, currentChapter, completedChapters, ... }）
    // - GET /api/family_progress  → 读取进度（query: ?user_id=xxx）
    sendJSON(res, 501, { error: '学习进度同步功能尚未实现，当前使用 localStorage 本地存储。See TODO: server.js handleFamilyProgressAPI' });
}

// ===== GET /api/metadata — 章节列表 / 详情 =====
function handleMetadataList(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    var url = new URL(req.url, 'http://localhost:' + PORT);
    var chapterParam = url.searchParams.get('chapter');
    var statusParam = url.searchParams.get('status');
    var searchParam = url.searchParams.get('search');

    // 单章详情
    if (chapterParam) {
        var metadata = loadMetadataStore();
        var ch = (metadata && metadata.chapters) ? metadata.chapters[chapterParam] : null;
        if (!ch) {
            sendJSON(res, 404, { error: '未找到第 ' + chapterParam + ' 章的元数据' });
            return;
        }
        sendJSON(res, 200, ch);
        return;
    }

    // 列表
    var metadata = loadMetadataStore();
    if (!metadata || !metadata.chapters) {
        sendJSON(res, 500, { error: '元数据加载失败' });
        return;
    }
    var allChapters = metadata.chapters;
    var keys = Object.keys(allChapters).sort(function (a, b) { return parseInt(a) - parseInt(b); });
    var result = [];
    for (var i = 0; i < keys.length; i++) {
        var ch = allChapters[keys[i]];
        // 状态筛选
        if (statusParam && ch.review_status !== statusParam) continue;
        // 模糊搜索
        if (searchParam) {
            var sl = searchParam.toLowerCase();
            var tMatch = ch.title && ch.title.toLowerCase().indexOf(sl) !== -1;
            var cMatch = ch.core_idea && ch.core_idea.toLowerCase().indexOf(sl) !== -1;
            if (!tMatch && !cMatch) continue;
        }
        result.push({
            chapter: parseInt(keys[i]),
            title: ch.title || '',
            core_idea: (ch.core_idea || '').substring(0, 80),
            review_status: ch.review_status || 'pending',
            reviewed_by: ch.reviewed_by || '',
            reviewed_at: ch.reviewed_at || '',
            safety_notes_count: (ch.safety_notes || []).length,
            interaction_points_count: (ch.interaction_points || []).length
        });
    }
    sendJSON(res, 200, { total: result.length, chapters: result });
}

// ===== PUT /api/metadata — 更新章节 =====
function handleMetadataUpdate(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (req.method !== 'PUT') {
        sendJSON(res, 405, { error: 'Method not allowed' });
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权，请提供有效的 ADMIN_TOKEN' });
        return;
    }
    parseBody(req, function (err, body) {
        if (err) {
            sendJSON(res, 400, { error: '请求格式错误: ' + err.message });
            return;
        }
        var chapterNum = body.chapter;
        var updates = body.updates || {};
        if (!chapterNum) {
            sendJSON(res, 400, { error: '缺少必填字段: chapter' });
            return;
        }
        var metadata = loadMetadataStore();
        if (!metadata || !metadata.chapters) {
            sendJSON(res, 500, { error: '元数据加载失败' });
            return;
        }
        var key = String(chapterNum);
        var chapter = metadata.chapters[key];
        if (!chapter) {
            sendJSON(res, 404, { error: '未找到第 ' + chapterNum + ' 章的元数据' });
            return;
        }
        var operatorBy = body.operator_by || 'admin';

        // 状态转换
        if (updates.review_status) {
            var fromStatus = chapter.review_status || 'pending';
            var toStatus = updates.review_status;
            if (fromStatus !== toStatus) {
                if (!validateTransition(fromStatus, toStatus)) {
                    sendJSON(res, 400, { error: '不允许的状态转换: ' + fromStatus + ' → ' + toStatus });
                    return;
                }
                // 锁定检查
                if (fromStatus === 'reviewing' && chapter.reviewed_by && chapter.reviewed_by !== operatorBy) {
                    sendJSON(res, 423, { error: '该章节正由 ' + chapter.reviewed_by + ' 审核中' });
                    return;
                }
                if (toStatus === 'reviewing') {
                    chapter.reviewed_by = operatorBy;
                }
                if (toStatus === 'approved' || toStatus === 'revision_needed') {
                    chapter.reviewed_by = '';
                }

                // 关键状态转换时保存内容快照
                var notes = updates.review_notes || '';
                var revisions = updates.revisions || null;
                var snapshot = null;
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
                }
                appendHistory(chapter, toStatus, operatorBy, notes, revisions, snapshot);
                chapter.reviewed_at = new Date().toISOString().split('T')[0];
            }
            chapter.review_status = toStatus;

            // ═══ 自动化：revision_needed → 触发 AI 修订任务 ═══
            if (toStatus === 'revision_needed' && revisions) {
                var hasActionableRevisions = false;
                var revFields = ['core_idea', 'safety_notes', 'interaction_points', 'parent_tips'];
                for (var r = 0; r < revFields.length; r++) {
                    var rf = revisions[revFields[r]];
                    if (rf && rf.needs_change) { hasActionableRevisions = true; break; }
                }
                if (!hasActionableRevisions && revisions.general && revisions.general.notes) {
                    hasActionableRevisions = true;
                }
                if (hasActionableRevisions) {
                    var taskId = taskManager.enqueue(
                        taskManager.TASK_TYPES.META_REVISE,
                        chapterNum,
                        {},
                        { triggeredBy: operatorBy || 'admin', priority: 5 }
                    );
                    console.log('[auto-revise] 已触发第 ' + chapterNum + ' 章 AI 修订任务: ' + taskId);
                }
            }
        }

        // 更新字段
        var fields = ['title', 'core_idea', 'safety_notes', 'interaction_points', 'parent_tips', 'reviewed_by', 'reviewed_at'];
        var hasContentEdit = false;
        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            if (updates[f] !== undefined) {
                chapter[f] = updates[f];
                hasContentEdit = true;
            }
        }
        if (hasContentEdit && !updates.review_status) {
            appendHistory(chapter, 'updated', operatorBy, updates.review_notes || 'Content edited');
        }

        if (!saveMetadataStore(metadata)) {
            sendJSON(res, 500, { error: '保存失败' });
            return;
        }
        sendJSON(res, 200, { ok: true, chapter: chapter });
    });
}

// ===== DELETE /api/metadata — 删除章节 =====
function handleMetadataDelete(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (req.method !== 'DELETE') {
        sendJSON(res, 405, { error: 'Method not allowed' });
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    var url = new URL(req.url, 'http://localhost:' + PORT);
    var chapterParam = url.searchParams.get('chapter');
    if (!chapterParam) {
        sendJSON(res, 400, { error: '缺少参数: chapter' });
        return;
    }
    var metadata = loadMetadataStore();
    if (!metadata || !metadata.chapters) {
        sendJSON(res, 500, { error: '元数据加载失败' });
        return;
    }
    var key = String(chapterParam);
    if (!metadata.chapters[key]) {
        sendJSON(res, 404, { error: '未找到第 ' + chapterParam + ' 章的元数据' });
        return;
    }
    delete metadata.chapters[key];
    if (!saveMetadataStore(metadata)) {
        sendJSON(res, 500, { error: '保存失败' });
        return;
    }
    sendJSON(res, 200, { ok: true, deleted: parseInt(chapterParam) });
}

// ===== POST /api/metadata/sync — 同步暂存区 → 生产 =====
function handleMetadataSync(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    parseBody(req, function (err, body) {
        if (err) {
            sendJSON(res, 400, { error: '请求格式错误' });
            return;
        }
        var chapterList = body.chapters || null;
        var reviser = require('./api/_shared/metadata-reviser');
        var result = reviser.syncStagingToProduction(chapterList);
        if (result.ok) {
            sendJSON(res, 200, result);
        } else {
            sendJSON(res, 400, result);
        }
    });
}

// ===== GET /api/metadata/staging — 查看暂存区 =====
function handleMetadataStaging(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    var reviser = require('./api/_shared/metadata-reviser');
    var staging = reviser.getStagingData();
    var url = new URL(req.url, 'http://localhost:' + PORT);
    var chapterParam = url.searchParams.get('chapter');

    // 详情模式：查询单个章节的完整暂存数据
    if (chapterParam) {
        var chapterKey = String(parseInt(chapterParam));
        var chapterData = staging.chapters && staging.chapters[chapterKey];
        if (!chapterData) {
            sendJSON(res, 404, { error: '暂存区中无此章节: ' + chapterParam });
            return;
        }
        sendJSON(res, 200, chapterData);
        return;
    }

    // 列表模式：返回摘要
    var keys = Object.keys(staging.chapters || {});
    var items = keys.map(function (k) {
        var ch = staging.chapters[k];
        return {
            chapter: ch.chapter,
            title: ch.title || '',
            core_idea_preview: (ch.core_idea || '').substring(0, 60),
            _staged_at: ch._staged_at || '',
            _staged_model: ch._staged_model || '',
            _production_status: ch._production_status || 'unknown'
        };
    });
    sendJSON(res, 200, {
        total: keys.length,
        chapters: keys.map(function (k) { return parseInt(k); }),
        _items: items,
        _updated: staging._updated || '',
        _description: staging._description || ''
    });
}

// ===== DELETE /api/metadata/staging — 删除暂存章节 =====
function handleMetadataStagingDelete(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    var url = new URL(req.url, 'http://localhost:' + PORT);
    var chapterParam = url.searchParams.get('chapter');
    if (!chapterParam) {
        sendJSON(res, 400, { error: '缺少参数: chapter' });
        return;
    }
    var reviser = require('./api/_shared/metadata-reviser');
    var result = reviser.removeFromStaging(parseInt(chapterParam));
    if (result.ok) {
        sendJSON(res, 200, result);
    } else {
        sendJSON(res, 404, result);
    }
}

// ===== POST /api/tasks — 创建后台任务 =====
function handleTaskCreate(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    parseBody(req, function (err, body) {
        if (err) {
            sendJSON(res, 400, { error: '请求格式错误: ' + err.message });
            return;
        }
        var taskType = body.type;
        var chapterNum = body.chapter;
        var params = body.params || {};
        var opts = body.opts || {};

        if (!taskType) {
            sendJSON(res, 400, { error: '缺少必填字段: type' });
            return;
        }
        if (!chapterNum && taskType !== 'batch_generate') {
            sendJSON(res, 400, { error: '缺少必填字段: chapter' });
            return;
        }

        // 验证任务类型
        var validTypes = ['meta_revise', 'meta_generate', 'batch_generate', 'chapter_audit'];
        if (validTypes.indexOf(taskType) === -1) {
            sendJSON(res, 400, { error: '不支持的任务类型: ' + taskType + '。支持: ' + validTypes.join(', ') });
            return;
        }

        var taskId;
        if (taskType === 'batch_generate' && body.chapters && Array.isArray(body.chapters)) {
            // 批量任务：创建一个父任务 + 多个子任务
            taskId = taskManager.enqueue(taskManager.TASK_TYPES.BATCH_GENERATE, 0, {
                chapters: body.chapters,
                params: params
            }, {
                triggeredBy: body.triggered_by || 'admin',
                priority: opts.priority || 0
            });

            // 为每个章节创建子任务
            body.chapters.forEach(function (ch) {
                var subId = taskManager.enqueue(
                    taskManager.TASK_TYPES.META_REVISE,
                    ch,
                    params,
                    { parentTaskId: taskId, triggeredBy: body.triggered_by || 'admin' }
                );
                taskManager.addSubTask(taskId, subId);
            });
        } else {
            taskId = taskManager.enqueue(taskType, chapterNum, params, {
                triggeredBy: body.triggered_by || 'admin',
                priority: opts.priority || 0
            });
        }

        sendJSON(res, 201, { ok: true, task_id: taskId });
    });
}

// ===== GET /api/tasks — 查询任务列表/详情 =====
function handleTaskList(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }

    var url = new URL(req.url, 'http://localhost:' + PORT);
    var taskId = url.searchParams.get('id');

    // 单任务详情
    if (taskId) {
        var task = taskManager.getTask(taskId);
        if (!task) {
            sendJSON(res, 404, { error: '任务不存在' });
            return;
        }
        sendJSON(res, 200, task);
        return;
    }

    // 列表查询
    var opts = {};
    var typeParam = url.searchParams.get('type');
    var statusParam = url.searchParams.get('status');
    var chapterParam = url.searchParams.get('chapter');
    var limitParam = url.searchParams.get('limit');
    var offsetParam = url.searchParams.get('offset');

    if (typeParam) opts.type = typeParam;
    if (statusParam) opts.status = statusParam;
    if (chapterParam) opts.chapter = parseInt(chapterParam, 10);
    if (limitParam) opts.limit = parseInt(limitParam, 10);
    if (offsetParam) opts.offset = parseInt(offsetParam, 10);

    var result = taskManager.getAllTasks(opts);
    sendJSON(res, 200, result);
}

// ===== GET /api/tasks/stats — 任务统计 =====
function handleTaskStats(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    var stats = taskManager.getStats();
    sendJSON(res, 200, stats);
}

// ===== POST /api/tasks/cancel — 取消任务 =====
function handleTaskCancel(req, res) {
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }
    if (!checkAdminAuth(req)) {
        sendJSON(res, 401, { error: '未授权' });
        return;
    }
    parseBody(req, function (err, body) {
        if (err) {
            sendJSON(res, 400, { error: '请求格式错误: ' + err.message });
            return;
        }
        var taskId = body.task_id;
        if (!taskId) {
            sendJSON(res, 400, { error: '缺少 task_id' });
            return;
        }
        var ok = taskManager.cancelTask(taskId);
        sendJSON(res, 200, { ok: ok, cancelled: ok });
    });
}

// ===== 创建 HTTP 服务器 =====
var server = http.createServer(function (req, res) {
    var url = new URL(req.url, 'http://localhost:' + PORT);
    var pathname = url.pathname;

    // /api/chat → 代理
    if (pathname === '/api/chat') {
        handleChatAPI(req, res);
        return;
    }

    // /api/family_chat → 亲子对话
    if (pathname === '/api/family_chat') {
        handleFamilyChatAPI(req, res);
        return;
    }

    // /api/family_progress → 学习进度同步（Phase 2 预留）
    if (pathname === '/api/family_progress') {
        handleFamilyProgressAPI(req, res);
        return;
    }

    // /api/tasks → 后台任务管理
    if (pathname === '/api/tasks') {
        if (req.method === 'POST') {
            handleTaskCreate(req, res);
        } else if (req.method === 'GET') {
            handleTaskList(req, res);
        } else if (req.method === 'OPTIONS') {
            sendJSON(res, 204, {});
        } else {
            sendJSON(res, 405, { error: 'Method not allowed' });
        }
        return;
    }

    // /api/tasks/stats → 任务统计
    if (pathname === '/api/tasks/stats') {
        handleTaskStats(req, res);
        return;
    }

    // /api/tasks/cancel → 取消任务
    if (pathname === '/api/tasks/cancel') {
        if (req.method === 'POST') {
            handleTaskCancel(req, res);
        } else if (req.method === 'OPTIONS') {
            sendJSON(res, 204, {});
        } else {
            sendJSON(res, 405, { error: 'Method not allowed' });
        }
        return;
    }

    // /api/metadata/stats → 聚合统计
    if (pathname === '/api/metadata/stats') {
        handleMetadataStats(req, res);
        return;
    }

    // /api/metadata → 列表/详情/更新/删除
    if (pathname === '/api/metadata') {
        if (req.method === 'GET') {
            handleMetadataList(req, res);
        } else if (req.method === 'PUT') {
            handleMetadataUpdate(req, res);
        } else if (req.method === 'DELETE') {
            handleMetadataDelete(req, res);
        } else if (req.method === 'OPTIONS') {
            sendJSON(res, 204, {});
        } else {
            sendJSON(res, 405, { error: 'Method not allowed' });
        }
        return;
    }

    // /api/metadata/sync → 同步暂存区到生产（POST）
    if (pathname === '/api/metadata/sync') {
        if (req.method === 'POST') {
            handleMetadataSync(req, res);
        } else if (req.method === 'OPTIONS') {
            sendJSON(res, 204, {});
        } else {
            sendJSON(res, 405, { error: 'Method not allowed' });
        }
        return;
    }

    // /api/metadata/staging → 查看/删除暂存区数据
    if (pathname === '/api/metadata/staging') {
        if (req.method === 'DELETE') {
            handleMetadataStagingDelete(req, res);
        } else {
            handleMetadataStaging(req, res);
        }
        return;
    }

    // 其他 → 静态文件
    if (pathname === '/') {
        pathname = '/index.html';
    }
    serveStatic(res, pathname);
});

server.listen(PORT, function () {
    console.log('');
    console.log('  \x1b[36m慧惠 · 道德经知识库 — 本地开发服务器\x1b[0m');
    console.log('  \x1b[2m──────────────────────────────────────────\x1b[0m');
    console.log('  地址: \x1b[1mhttp://localhost:' + PORT + '\x1b[0m');
    console.log('');

    if (!DEEPSEEK_API_KEY) {
        console.log('  \x1b[33m⚠ 未检测到 DEEPSEEK_API_KEY 环境变量\x1b[0m');
        console.log('  \x1b[33m  聊天功能将不可用。请按以下步骤配置：\x1b[0m');
        console.log('');
        console.log('  \x1b[2m  1. 复制 .env.example → .env\x1b[0m');
        console.log('  \x1b[2m  2. 在 .env 中填入你的 DeepSeek API Key\x1b[0m');
        console.log('  \x1b[2m  3. 重启服务器\x1b[0m');
        console.log('');
    } else {
        var masked = DEEPSEEK_API_KEY.substring(0, 6) + '...' + DEEPSEEK_API_KEY.substring(DEEPSEEK_API_KEY.length - 4);
        console.log('  \x1b[32m✓ DEEPSEEK_API_KEY 已配置 (' + masked + ')\x1b[0m');
        console.log('');
    }

    // ═══ 初始化后台任务系统 ═══
    (function initTaskSystem() {
        // 初始化任务管理器（启用持久化）
        taskManager.init({ maxConcurrent: 2, maxRetries: 3 });
        taskManager.enablePersistence();

        // ═══ 通过 HTTP 调用独立修订服务（解耦） ═══
        /**
         * 调用独立修订服务的 HTTP 请求
         * @param {number} chapterNum
         * @returns {Promise<object>}
         */
        function callReviserService(chapterNum) {
            return new Promise(function (resolve, reject) {
                var httpModule = require('http');
                var body = JSON.stringify({ chapter: chapterNum });
                var req = httpModule.request({
                    hostname: '127.0.0.1',
                    port: REVISER_PORT,
                    path: '/revise',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    },
                    timeout: 120000
                }, function (resp) {
                    var chunks = [];
                    resp.on('data', function (c) { chunks.push(c); });
                    resp.on('end', function () {
                        try {
                            var data = JSON.parse(Buffer.concat(chunks).toString());
                            if (resp.statusCode === 200 && data.ok) {
                                resolve(data.result);
                            } else {
                                reject(new Error((data.error || '修订服务返回错误') + ' (HTTP ' + resp.statusCode + ')'));
                            }
                        } catch (e) {
                            reject(new Error('修订服务响应解析失败: ' + e.message));
                        }
                    });
                });
                req.on('error', function (err) {
                    reject(new Error('无法连接到修订服务 (端口:' + REVISER_PORT + '): ' + err.message +
                        '。请确保已启动: node scripts/reviser-service.js'));
                });
                req.on('timeout', function () {
                    req.destroy();
                    reject(new Error('修订服务响应超时'));
                });
                req.write(body);
                req.end();
            });
        }

        // 注册任务处理器：meta_revise
        taskManager.registerHandler(taskManager.TASK_TYPES.META_REVISE, function (task) {
            return callReviserService(task.chapter)
                .then(function (result) {
                    console.log('[task-handler] meta_revise OK: 第' + task.chapter + '章');
                    return result;
                });
        });

        // 注册任务处理器：batch_generate
        taskManager.registerHandler(taskManager.TASK_TYPES.BATCH_GENERATE, function (task) {
            return Promise.resolve({
                chapters: task.params.chapters || [],
                subTasks: task.subTasks || [],
                message: '子任务已分配，等待执行'
            });
        });

        // 注册任务处理器：meta_generate
        taskManager.registerHandler(taskManager.TASK_TYPES.META_GENERATE, function (task) {
            return callReviserService(task.chapter)
                .then(function (result) {
                    console.log('[task-handler] meta_generate OK: 第' + task.chapter + '章');
                    return result;
                });
        });

        // 事件
        taskManager.on('completed', function (task) {
            if (task.type === taskManager.TASK_TYPES.META_REVISE ||
                task.type === taskManager.TASK_TYPES.META_GENERATE) {
                console.log('[task-system] 第 ' + task.chapter + ' 章修订任务已完成（暂存区）');
            }
        });

        taskManager.on('failed', function (task) {
            console.error('[task-system] 第 ' + (task.chapter || '?') + ' 章任务最终失败: ' + (task.error || ''));
        });

        console.log('  \x1b[2m✓ 后台任务系统已就绪 → 修订服务端口: ' + REVISER_PORT + '\x1b[0m');
    })();
});

// 优雅退出
process.on('SIGINT', function () {
    console.log('\n  服务器已关闭。');
    process.exit(0);
});
