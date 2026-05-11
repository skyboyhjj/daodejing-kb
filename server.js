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
        var metaPath = path.join(__dirname, 'data', 'family_metadata.json');
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

            if (chapterMeta.review_status !== 'approved') {
                res.writeHead(403, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: '第 ' + chapter + ' 章的元数据尚未通过审核' }));
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
});

// 优雅退出
process.on('SIGINT', function () {
    console.log('\n  服务器已关闭。');
    process.exit(0);
});
