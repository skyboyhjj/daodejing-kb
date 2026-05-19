/**
 * 慧惠 — Cloudflare Pages Functions
 * POST /api/chat → DeepSeek 代理
 * 环境变量：DEEPSEEK_API_KEY（在 Cloudflare Pages 后台配置）
 */
import { buildSystemPrompt } from '../../api/_shared/system-prompt.js';
import { sendFeedbackEmail, buildFeedbackEmailBody } from '../../api/_shared/feedback-email.js';
import { saveFeedback } from '../../api/_shared/feedback-store.js';

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
        const { messages, level, user_id } = body;
        const userLevel = level || 'L2';

        const deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
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

        // [FEEDBACK:CONFIRM] 检测：AI 反馈汇总确认后，存储 + 邮件
        var aiContent = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';

        if (aiContent && aiContent.indexOf('[FEEDBACK:CONFIRM]') !== -1) {
            // 提取反馈类型
            var feedbackType = 'general';
            var firstUserMsg = (messages || []).filter(function (m) { return m.role === 'user'; })[0];
            if (firstUserMsg && firstUserMsg.content) {
                var typeMatch = firstUserMsg.content.match(/\[FEEDBACK:SOP=(\w+)\]/);
                if (typeMatch) feedbackType = typeMatch[1];
            }

            // 存储反馈（Cloudflare 使用 context.waitUntil 处理异步）
            context.waitUntil(
                saveFeedback(messages, feedbackType)
                    .then(function (record) {
                        console.log('[Feedback] 反馈已存储:', record.id);
                        return record;
                    })
                    .catch(function (err) {
                        console.error('[Feedback] 存储失败:', err.message);
                    })
            );

            // 发送邮件
            var emailBody = buildFeedbackEmailBody(messages, feedbackType, aiContent, user_id);
            context.waitUntil(
                sendFeedbackEmail(emailBody, feedbackType, env).catch(function (err) {
                    console.error('[Feedback] 邮件发送失败:', err.message);
                })
            );

            // 剥离标记并添加确认信号
            data.choices[0].message.content = aiContent.replace('[FEEDBACK:CONFIRM]', '').trim();
            data._feedbackConfirmed = true;
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
