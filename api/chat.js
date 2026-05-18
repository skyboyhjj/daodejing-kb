/**
 * 慧惠 — Vercel Serverless Function
 * POST /api/chat → DeepSeek 代理
 */
import { buildSystemPrompt } from './_shared/system-prompt.js';
import { sendFeedbackEmail } from './_shared/feedback-email.js';

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

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'DEEPSEEK_API_KEY 环境变量未配置。' });
    }

    try {
        const body = req.body || {};
        const { messages, level } = body;
        const userLevel = level || 'L2';

        const deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: buildSystemPrompt(userLevel) },
                    ...(messages || [])
                ],
                temperature: 0.7,
                max_tokens: 800
            }),
            signal: AbortSignal.timeout(15000)
        });

        const data = await deepseekResp.json();

        if (!deepseekResp.ok) {
            return res.status(deepseekResp.status).json({
                error: 'DeepSeek API error: ' + deepseekResp.status,
                detail: data
            });
        }

        // [FEEDBACK] 标记检测：先发送邮件，再返回 AI 回复
        // 注意：必须先 await 邮件发送，再 json 响应。
        // 在 Serverless 环境中，HTTP 响应发送后进程可能被冻结，
        // 导致异步 fetch 被终止。
        var lastUserMsg = (messages || []).filter(function (m) { return m.role === 'user'; }).pop();
        if (lastUserMsg && lastUserMsg.content && lastUserMsg.content.indexOf('[FEEDBACK]') === 0) {
            try {
                await sendFeedbackEmail(lastUserMsg.content);
            } catch (err) {
                console.error('[Feedback] 邮件发送失败:', err.message);
            }
        }

        // 返回 AI 回复
        res.status(200).json(data);
        return;
    } catch (err) {
        const errMsg = (err.name === 'TimeoutError' || err.name === 'AbortError')
            ? 'DeepSeek API 响应超时，请稍后重试。'
            : err.message;
        return res.status(500).json({ error: errMsg });
    }
}

// ===== System Prompt（从共享模块导入）=====
// buildSystemPrompt 定义于 api/_shared/system-prompt.js
// sendFeedbackEmail 定义于 api/_shared/feedback-email.js
