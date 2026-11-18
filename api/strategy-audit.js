/**
 * 慧惠 — 对话策略审计（Vercel Serverless Function）
 * POST /api/strategy-audit → 分析一段亲子共读对话，产出「提出+探测」候选策略建议
 *
 * 伦理边界（宪法第 195 行「慧惠AI初审 + 人类导师深度修订」）：
 *   1. 只读：本端点无写 system-prompt.js 的能力，整合只在 git 工作流发生
 *   2. 不落库：请求体用完即弃，不持久化
 *   3. 强制 disclaimer：响应固定带「不会自动生效」
 */
import { buildAuditPrompt } from './_shared/strategy-audit-prompt.js';

const DISCLAIMER = '以上为 AI 初审建议，仅供人类导师参考，不会自动生效。是否采纳、如何整合，由人类导师决定。';

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
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (!messages.length) {
            return res.status(400).json({ error: '缺少对话记录（messages 为空）。' });
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
            return res.status(deepseekResp.status).json({
                error: 'DeepSeek API error: ' + deepseekResp.status,
                detail: data
            });
        }

        const text = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';

        return res.status(200).json({
            ok: true,
            audit: { text: text, disclaimer: DISCLAIMER }
        });
    } catch (err) {
        const errMsg = (err.name === 'TimeoutError' || err.name === 'AbortError')
            ? 'DeepSeek API 响应超时，请稍后重试。'
            : err.message;
        return res.status(500).json({ error: errMsg });
    }
}
