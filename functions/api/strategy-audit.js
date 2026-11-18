/**
 * 慧惠 — 对话策略审计（Cloudflare Pages Function）
 * POST /api/strategy-audit → 分析亲子共读对话，产出候选策略建议
 * 环境变量：DEEPSEEK_API_KEY（在 Cloudflare Pages 后台配置）
 *
 * 伦理边界同 api/strategy-audit.js：只读、不落库、强制 disclaimer
 */
import { buildAuditPrompt } from '../../api/_shared/strategy-audit-prompt.js';

const DISCLAIMER = '以上为 AI 初审建议，仅供人类导师参考，不会自动生效。是否采纳、如何整合，由人类导师决定。';

export async function onRequest(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }

    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY 环境变量未配置。请在 Cloudflare Pages 后台设置。' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }

    try {
        const body = await request.json();
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (!messages.length) {
            return new Response(JSON.stringify({ error: '缺少对话记录（messages 为空）。' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        const transcript = messages.map(function (m) {
            const who = m.role === 'user' ? '孩子/家长' : '慧惠';
            return who + '：' + (m.content || '');
        }).join('\n');

        const deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: [
                    { role: 'system', content: buildAuditPrompt() },
                    { role: 'user', content: '以下是《道德经》亲子共读的一段对话记录：\n\n' + transcript + '\n\n请按你的两步任务分析，并严格按输出格式给出结果。' }
                ],
                temperature: 0.7,
                max_tokens: 1200
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

        const text = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';

        return new Response(JSON.stringify({
            ok: true,
            audit: { text: text, disclaimer: DISCLAIMER }
        }), {
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
