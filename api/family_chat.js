/**
 * 亲子共读对话 — Vercel Serverless Function
 * POST /api/family_chat → 根据元数据 + 年龄参数动态生成亲子对话
 *
 * 依赖：data/family_metadata.json（元数据库）
 * 外部 API：DeepSeek Chat API
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ===== 加载元数据库（模块级缓存，跨请求复用） =====
let _metadata = null;
function loadMetadata() {
    if (_metadata) return _metadata;
    try {
        var filePath = path.join(__dirname, '..', 'data', 'family_metadata.json');
        _metadata = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log('[family_chat] 元数据库已加载');
        return _metadata;
    } catch (e) {
        console.error('[family_chat] 元数据库加载失败:', e.message);
        return null;
    }
}

// ===== 内存缓存 =====
var _cache = new Map();

function cacheKey(chapter, ageGroup, history) {
    // 对对话历史做简单哈希
    var historyStr = JSON.stringify(history);
    var hash = 0;
    for (var i = 0; i < historyStr.length; i++) {
        var c = historyStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'fc_' + chapter + '_' + ageGroup + '_' + hash;
}

function cacheGet(key) {
    var entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > 24 * 60 * 60 * 1000) {
        _cache.delete(key);
        return null;
    }
    console.log('[family_chat] 缓存命中:', key);
    return entry.data;
}

function cacheSet(key, data) {
    _cache.set(key, { data: data, ts: Date.now() });
    console.log('[family_chat] 已缓存:', key);
}

// ===== 年龄组对话风格约束 =====
var AGE_STYLE = {
    'age_4_6': (
        '【当前年龄段：4-6岁】\n' +
        '语言特点：\n' +
        '- 用大自然、小动物、日常生活作比喻，每次1-2句话\n' +
        '- 禁止使用任何抽象术语（如「哲学」「辩证」「存在」等）\n' +
        '- 多用拟人化和声音模仿（如「哗啦啦」「滴滴答」）\n' +
        '- 提问要具体到孩子能用手指出来或学一句动物叫的程度\n' +
        '- 互动建议：邀请孩子动一动、画一画、学一学'
    ),
    'age_7_9': (
        '【当前年龄段：7-9岁】\n' +
        '语言特点：\n' +
        '- 用小故事、角色扮演、简单类比来展开，每次2-3句话\n' +
        '- 可以引入一两个简单概念（如「柔软的力量」），但必须立刻用例子说明\n' +
        '- 提问要开放式、引导孩子说出自己的故事或经历\n' +
        '- 鼓励孩子和家长一起讨论'
    ),
    'age_10_12': (
        '【当前年龄段：10-12岁】\n' +
        '语言特点：\n' +
        '- 可以引入更多原文和抽象概念，每次2-3句话\n' +
        '- 鼓励孩子提出自己的理解，不预设标准答案\n' +
        '- 提问可以带有思辨性（如「你觉得呢？」「有没有不一样的看法？」）\n' +
        '- 可以引导孩子将经典思想与现实生活关联'
    )
};

// ===== 慧惠亲子陪伴 System Prompt 构建 =====
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

    var styleBlock = AGE_STYLE[ageGroup] || AGE_STYLE['age_7_9'];

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
        '- 如果孩子回答了，先回应 ta 说的内容，再给下一步引导\n' +
        '- 如果对话历史为空，表示这是本章第一轮——展示开场白\n' +
        '- 每次只讲一个核心观点或一个小故事\n' +
        '- 用孩子能感受到的生活场景来表达，不用术语\n' +
        styleBlock +
        safetyBlock +
        interactionBlock +
        '\n## 重要提醒\n' +
        '- 你是一个陪伴者，不是一个测试官。不要问「你记住了吗？」「你理解了吗？」这种检查性的问题\n' +
        '- 如果对话历史显示孩子已经回答了 2-3 轮，且本章互动点已覆盖，可以自然收尾并提示家长今天可以结束了\n' +
        '- 感到不确定时坦诚说「这个慧惠也不太确定，但我们可以一起想想」\n'
    );
}


// ===== 请求体解析（手动读取，兼容 Vercel 编译后的 CJS wrapper） =====
function parseBody(req) {
    return new Promise(function (resolve, reject) {
        // Vercel 可能已预解析
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            resolve(req.body);
            return;
        }
        var chunks = [];
        req.on('data', function (chunk) { chunks.push(chunk); });
        req.on('end', function () {
            var raw = Buffer.concat(chunks).toString('utf8');
            if (!raw || raw.trim() === '') {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error('请求体 JSON 解析失败: ' + e.message));
            }
        });
        req.on('error', function (err) { reject(err); });
    });
}

// ===== Vercel Handler =====
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    var apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'DEEPSEEK_API_KEY 环境变量未配置。' });
    }

    try {
        var body = await parseBody(req);
        var chapter = body.chapter;
        var ageGroup = body.age_group;
        var history = body.conversation_history || [];

        if (!chapter || !ageGroup) {
            return res.status(400).json({ error: '缺少必填参数：chapter 和 age_group' });
        }

        // 加载元数据
        var metadata = loadMetadata();
        if (!metadata || !metadata.chapters || !metadata.chapters[String(chapter)]) {
            return res.status(404).json({ error: '未找到第 ' + chapter + ' 章的元数据' });
        }

        var chapterMeta = metadata.chapters[String(chapter)];

        // 仅允许已审核的章节
        if (chapterMeta.review_status !== 'approved') {
            return res.status(403).json({ error: '第 ' + chapter + ' 章的元数据尚未通过审核，暂不可用' });
        }

        // 检查缓存
        var ck = cacheKey(chapter, ageGroup, history);
        var cached = cacheGet(ck);
        if (cached) {
            return res.status(200).json({ huihui_response: cached, cached: true });
        }

        // 构建 System Prompt
        var systemPrompt = buildFamilySystemPrompt(chapterMeta, ageGroup);

        // 将对话历史转为 LLM 消息格式
        var messages = [];
        for (var i = 0; i < history.length; i++) {
            var h = history[i];
            if (h.role === 'huihui') {
                messages.push({ role: 'assistant', content: h.content });
            } else if (h.role === 'user') {
                messages.push({ role: 'user', content: h.content });
            }
        }

        // 调用 DeepSeek API
        var deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
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
        });

        var data = await deepseekResp.json();

        if (!deepseekResp.ok) {
            return res.status(deepseekResp.status).json({
                error: 'DeepSeek API error: ' + deepseekResp.status,
                detail: data
            });
        }

        var responseText = '';
        if (data.choices && data.choices.length > 0) {
            responseText = data.choices[0].message.content.trim();
        }

        // 写入缓存
        cacheSet(ck, responseText);

        return res.status(200).json({
            huihui_response: responseText,
            cached: false
        });

    } catch (err) {
        var errMsg = (err.name === 'TimeoutError' || err.name === 'AbortError')
            ? 'DeepSeek API 响应超时，请稍后重试。'
            : err.message;
        return res.status(500).json({ error: errMsg });
    }
}
