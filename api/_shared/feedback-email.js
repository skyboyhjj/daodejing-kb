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

// 格式化中国大陆北京时间 (UTC+8)，返回 YYYY-MM-DD HH:mm:ss
export function formatBeijingTime() {
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    var y = bj.getUTCFullYear();
    var m = String(bj.getUTCMonth() + 1).padStart(2, '0');
    var d = String(bj.getUTCDate()).padStart(2, '0');
    var h = String(bj.getUTCHours()).padStart(2, '0');
    var min = String(bj.getUTCMinutes()).padStart(2, '0');
    var s = String(bj.getUTCSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
}

/**
 * 构建反馈邮件正文（北京时间 + 用户消息 + AI 汇总）
 * @param {Array}  messages     - 完整对话历史
 * @param {string} feedbackType - 'bug' | 'suggestion' | 'help' | 'general'
 * @param {string} aiContent    - AI 最终回复（含 [FEEDBACK:CONFIRM] 标记）
 * @param {string} userId       - 前端传来的用户 ID
 */
export function buildFeedbackEmailBody(messages, feedbackType, aiContent, userId) {
    var label = TYPE_LABELS[feedbackType] || TYPE_LABELS['general'];
    var bjTime = formatBeijingTime();
    var parts = [];

    parts.push('【反馈类型】' + label + ' (' + feedbackType + ')');
    if (userId) parts.push('【用户ID】' + userId);
    parts.push('【提交时间】' + bjTime + '（北京时间）');
    parts.push('');

    // 用户反馈内容（提取所有不含 SOP 前缀的用户消息）
    parts.push('━━━ 用户反馈内容 ━━━');
    var userMsgs = (messages || []).filter(function (m) { return m.role === 'user'; });
    for (var i = 0; i < userMsgs.length; i++) {
        var msg = (userMsgs[i].content || '').replace(/\[FEEDBACK:SOP=\w+\]\s*/g, '');
        if (msg.trim()) parts.push(msg.trim());
    }
    parts.push('');

    // AI 汇总确认
    var cleanAi = (aiContent || '').replace('[FEEDBACK:CONFIRM]', '').trim();
    if (cleanAi) {
        parts.push('━━━ AI 汇总确认 ━━━');
        parts.push(cleanAi);
    }

    return parts.join('\n');
}

export async function sendFeedbackEmail(content, feedbackType, env) {
    var label = TYPE_LABELS[feedbackType] || TYPE_LABELS['general'];
    var bjTime = formatBeijingTime();

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
            subject: '【道德经亲子体验营】用户反馈 · ' + label + ' · ' + bjTime,
            text: cleanContent
        })
    });

    if (!resp.ok) {
        var errBody = await resp.text();
        throw new Error('Resend API 返回 ' + resp.status + ': ' + errBody);
    }

    console.log('[Feedback] 邮件已成功发送至 contact@metaskill.org.cn');
}
