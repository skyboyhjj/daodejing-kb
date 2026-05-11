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

// ===== 创建 HTTP 服务器 =====
var server = http.createServer(function (req, res) {
    var url = new URL(req.url, 'http://localhost:' + PORT);
    var pathname = url.pathname;

    // /api/chat → 代理
    if (pathname === '/api/chat') {
        handleChatAPI(req, res);
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
