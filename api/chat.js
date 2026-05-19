/**
 * 慧惠 — Vercel Serverless Function
 * POST /api/chat → DeepSeek 代理
 */
import { buildSystemPrompt } from './_shared/system-prompt.js';
import { sendFeedbackEmail, buildFeedbackEmailBody } from './_shared/feedback-email.js';
import { saveFeedback } from './_shared/feedback-store.js';

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
        const { messages, level, user_id, feedback_type } = body;
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
            return res.status(deepseekResp.status).json({
                error: 'DeepSeek API error: ' + deepseekResp.status,
                detail: data
            });
        }

        // [FEEDBACK:CONFIRM] 检测：AI 反馈汇总确认后，存储 + 邮件
        // 当 System Prompt 驱动 AI 完成多轮反馈 SOP 后，AI 输出的最后一行
        // 包含 [FEEDBACK:CONFIRM] 标记。后端检测到此标记时：
        //   1. 提取反馈类型（从对话历史中）
        //   2. 存储反馈数据
        //   3. 发送邮件通知
        //   4. 剥离标记后返回给前端
        var aiContent = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';

        if (aiContent && aiContent.indexOf('[FEEDBACK:CONFIRM]') !== -1) {
            // 提取反馈类型：优先使用前端显式传入的 feedback_type，
            // 回退到从第一条用户消息的 [FEEDBACK:SOP=*] 中解析
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

            // 存储反馈数据（必须在 res.json 之前 await）
            var savedRecord = null;
            try {
                savedRecord = await saveFeedback(messages, feedbackType);
                console.log('[Feedback] 反馈已存储:', savedRecord.id);
            } catch (err) {
                console.error('[Feedback] 存储失败:', err.message);
            }

            // 发送邮件通知（必须在 res.json 之前 await）
            try {
                var emailBody = buildFeedbackEmailBody(messages, feedbackType, aiContent, user_id);
                await sendFeedbackEmail(emailBody, feedbackType);
            } catch (err) {
                console.error('[Feedback] 邮件发送失败:', err.message);
            }

            // 剥离 [FEEDBACK:CONFIRM] 标记，返回纯净内容给前端
            data.choices[0].message.content = aiContent.replace('[FEEDBACK:CONFIRM]', '').trim();
            data._feedbackConfirmed = true;
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
