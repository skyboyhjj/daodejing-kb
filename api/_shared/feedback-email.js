/**
 * 慧惠 反馈邮件转发 — 规范定义
 * 这是 sendFeedbackEmail 的唯一规范来源。
 * 修改此文件后，所有 API 端点自动同步。
 *
 * 使用者:
 *   api/chat.js             — Vercel Serverless Function (process.env)
 *   functions/api/chat.js   — Cloudflare Pages Function (context.env)
 *   server.js               — 本地开发服务器 (process.env)
 *
 * @param {string} content      - 用户反馈内容（可能带 [FEEDBACK] 前缀）
 * @param {string} feedbackType - 反馈类型：'bug' | 'suggestion' | 'help' | 'general'
 * @param {object} [env]        - Cloudflare Pages 环境变量对象 (context.env)
 *                                在 Vercel/Node.js 环境下留空，自动回退到 process.env
 */

var TYPE_LABELS = {
    bug: '我要报错',
    suggestion: '我要建议',
    help: '我要帮助',
    general: '用户反馈'
};

export async function sendFeedbackEmail(content, feedbackType, env) {
    var label = TYPE_LABELS[feedbackType] || TYPE_LABELS['general'];

    // 兼容 Vercel/Node.js (process.env) 与 Cloudflare Pages (context.env)
    var resendKey = (env && env.RESEND_API_KEY) ||
        (typeof process !== 'undefined' && process.env && process.env.RESEND_API_KEY);

    if (!resendKey) {
        console.warn('[Feedback] RESEND_API_KEY 环境变量未配置，跳过邮件发送');
        return;
    }

    // 去除 [FEEDBACK:*] 前缀和 [FEEDBACK:CONFIRM] 标记，得到纯净的反馈内容
    var cleanContent = content
        .replace(/\[FEEDBACK[^\]]*\][ \t]*/gi, '')
        .replace(/\[FEEDBACK:CONFIRM\]/gi, '')
        .trim();

    var resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + resendKey
        },
        body: JSON.stringify({
            from: '道德经亲子体验营 <noreply@hui-skill.org>',
            to: ['contact@metaskill.org.cn'],
            subject: '【道德经亲子体验营】用户反馈 · ' + label,
            text: cleanContent
        })
    });

    if (!resp.ok) {
        var errBody = await resp.text();
        throw new Error('Resend API 返回 ' + resp.status + ': ' + errBody);
    }

    console.log('[Feedback] 邮件已成功发送至 contact@metaskill.org.cn');
}
