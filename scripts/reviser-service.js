#!/usr/bin/env node
/**
 * 慧惠 AI 元数据修订服务 — reviser-service.js
 * ==============================================
 * 独立的 HTTP 微服务，与主 server.js 解耦运行。
 *
 * 功能:
 *  - POST /revise         → 修订指定章节（写入暂存区）
 *  - GET  /health          → 健康检查
 *  - GET  /staging         → 查看暂存区状态
 *
 * 启动方式:
 *   node scripts/reviser-service.js
 *   REVISER_PORT=8082 node scripts/reviser-service.js
 *
 * 依赖:
 *   - DEEPSEEK_API_KEY 环境变量
 *   - DEEPSEEK_MODEL 环境变量（可选，默认 deepseek-v4-flash）
 *   - 需要更强推理: DEEPSEEK_MODEL=deepseek-v4-pro
 *
 * 从 server.js 调用:
 *   POST http://127.0.0.1:8081/revise { "chapter": 53 }
 */

'use strict';

var http = require('http');
var path = require('path');

// 调整模块路径（从 scripts/ 目录引用 api/_shared/ 下的模块）
var API_SHARED = path.join(__dirname, '..', 'api', '_shared');
var reviser = require(path.join(API_SHARED, 'metadata-reviser'));

var PORT = parseInt(process.env.REVISER_PORT || '8081', 10);
var MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

// ===== 辅助函数 =====
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

// ===== 日志 =====
function log(msg) {
    console.log('[reviser-service:' + PORT + '] ' + msg);
}

// ===== POST /revise =====
function handleRevise(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
        res.end();
        return;
    }
    if (req.method !== 'POST') {
        sendJSON(res, 405, { error: 'Method not allowed' });
        return;
    }

    parseBody(req, function (err, body) {
        if (err) {
            sendJSON(res, 400, { error: 'Invalid JSON: ' + err.message });
            return;
        }
        var chapter = body.chapter;
        if (!chapter) {
            sendJSON(res, 400, { error: '缺少必填字段: chapter' });
            return;
        }

        log('收到修订请求: 第' + chapter + '章 (模型: ' + MODEL + ')');

        reviser.reviseChapterToStaging(chapter)
            .then(function (result) {
                log('修订完成: 第' + chapter + '章 → 暂存区');
                sendJSON(res, 200, {
                    ok: true,
                    result: result,
                    meta: {
                        model: MODEL,
                        service: 'reviser-service',
                        port: PORT
                    }
                });
            })
            .catch(function (err) {
                log('修订失败: 第' + chapter + '章 - ' + err.message);
                sendJSON(res, 500, {
                    ok: false,
                    error: err.message,
                    meta: {
                        model: MODEL,
                        service: 'reviser-service',
                        port: PORT
                    }
                });
            });
    });
}

// ===== GET /health =====
function handleHealth(req, res) {
    var staging = reviser.getStagingData();
    sendJSON(res, 200, {
        ok: true,
        service: 'reviser-service',
        port: PORT,
        model: MODEL,
        uptime: Math.floor(process.uptime()),
        staging: {
            chapters: Object.keys(staging.chapters || {}).length,
            updated: staging._updated || ''
        }
    });
}

// ===== GET /staging =====
function handleStaging(req, res) {
    var staging = reviser.getStagingData();
    var keys = Object.keys(staging.chapters || {});
    sendJSON(res, 200, {
        total: keys.length,
        chapters: keys.map(function (k) { return parseInt(k); }),
        _updated: staging._updated || '',
        _description: staging._description || ''
    });
}

// ===== 启动服务器 =====
var server = http.createServer(function (req, res) {
    var url = new URL(req.url, 'http://127.0.0.1:' + PORT);
    var pathname = url.pathname;

    if (pathname === '/revise') {
        handleRevise(req, res);
    } else if (pathname === '/health') {
        handleHealth(req, res);
    } else if (pathname === '/staging') {
        handleStaging(req, res);
    } else if (pathname === '/') {
        sendJSON(res, 200, {
            service: '慧惠 AI 元数据修订服务',
            version: '2.0',
            model: MODEL,
            endpoints: {
                'POST /revise': '修订指定章节',
                'GET /health': '健康检查',
                'GET /staging': '查看暂存区'
            }
        });
    } else {
        sendJSON(res, 404, { error: 'Not found' });
    }
});

server.listen(PORT, function () {
    console.log('');
    console.log('  \x1b[36m慧惠 AI 元数据修订服务 v2.0\x1b[0m');
    console.log('  \x1b[2m──────────────────────────────────────────\x1b[0m');
    console.log('  端口: \x1b[1m' + PORT + '\x1b[0m');
    console.log('  模型: \x1b[1m' + MODEL + '\x1b[0m');
    console.log('  端点:');
    console.log('    POST /revise   — 修订单个章节 → 暂存区');
    console.log('    GET  /health   — 健康检查');
    console.log('    GET  /staging  — 暂存区状态');
    console.log('');
    console.log('  \x1b[2m启动: DEEPSEEK_MODEL=new-model node scripts/reviser-service.js\x1b[0m');
    console.log('');
});

// 优雅退出
process.on('SIGINT', function () {
    log('正在关闭...');
    server.close(function () {
        log('已关闭');
        process.exit(0);
    });
});

process.on('SIGTERM', function () {
    log('正在关闭...');
    server.close(function () {
        log('已关闭');
        process.exit(0);
    });
});
