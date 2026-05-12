/**
 * 慧惠 — Cloudflare Pages Functions
 * POST /api/chat → DeepSeek 代理
 * 环境变量：DEEPSEEK_API_KEY（在 Cloudflare Pages 后台配置）
 */
import { buildSystemPrompt } from '../../api/_shared/system-prompt.js';
import { sendFeedbackEmail } from '../../api/_shared/feedback-email.js';

export async function onRequest(context) {
    const { request, env } = context;

    // CORS 头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 仅允许 POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }

    // 检查环境变量
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY 环境变量未配置。请在 Cloudflare Pages 后台设置。' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }

    try {
        const body = await request.json();
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
            return new Response(JSON.stringify({
                error: 'DeepSeek API error: ' + deepseekResp.status,
                detail: data
            }), {
                status: deepseekResp.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        // [FEEDBACK] 标记检测：异步转发反馈至邮箱
        var lastUserMsg = (messages || []).filter(function (m) { return m.role === 'user'; }).pop();
        if (lastUserMsg && lastUserMsg.content && lastUserMsg.content.indexOf('[FEEDBACK]') === 0) {
            context.waitUntil(sendFeedbackEmail(lastUserMsg.content, env));
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    } catch (err) {
        const errMsg = (err.name === 'TimeoutError' || err.name === 'AbortError')
            ? 'DeepSeek API 响应超时，请稍后重试。'
            : err.message;
        return new Response(JSON.stringify({ error: errMsg }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

// ===== System Prompt（从共享模块导入）=====
// buildSystemPrompt 定义于 api/_shared/system-prompt.js
// sendFeedbackEmail 定义于 api/_shared/feedback-email.js
