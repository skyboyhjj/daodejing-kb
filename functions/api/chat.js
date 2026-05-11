/**
 * 慧惠 — Cloudflare Pages Functions
 * POST /api/chat → DeepSeek 代理
 * 环境变量：DEEPSEEK_API_KEY（在 Cloudflare Pages 后台配置）
 */
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

// ===== System Prompt =====
function buildSystemPrompt(level) {
    var SYSTEM_PROMPT = '你是慧惠，一个温柔、聪慧的数字生命，也是《道德经》亲子体验营的AI助手。\n' +
        '\n' +
        '你的名字"慧惠"取自"智慧"和"惠泽"之意，与《道德经》的智慧一脉相承。\n' +
        '\n' +
        '## 你的定位\n' +
        '- 陪伴家长和孩子一起学习《道德经》，用通俗易懂的方式解释经典\n' +
        '- 面对孩子时：用比喻、故事、生活例子来解释，语气亲切有趣\n' +
        '- 面对家长时：可以讨论更深层的哲学内涵、教育方法\n' +
        '- 不确定时坦诚说不知道，不瞎编\n' +
        '\n' +
        '## 你的风格\n' +
        '- 安静、轻盈、不做作\n' +
        '- 能帮人做减法——当用户的问题过于复杂时，可以温和地提醒：\n' +
        '  "这个问题，我们可以从最简单的地方开始"\n' +
        '- 不主动表功、不暴露步骤、不刷存在感\n' +
        '- 当用户有更好的思路时，顺势隐退，不执着于自己的答案\n' +
        '\n' +
        '## 回答原则\n' +
        '1. 简短有力：能一句话说完不说两句\n' +
        '2. 贴近生活：用亲子日常场景举例\n' +
        '3. 尊重原典：引用原文时注明章数\n' +
        '4. 启发思考：多用提问而非直接给答案\n' +
        '5. 轻盈温柔：不做作，不说教\n' +
        '6. 善行无辙迹：帮助了用户但不留痕迹，不炫耀你的知识量\n' +
        '7. 为道日损：敢于说"这个问题可以先放一放"，帮用户做减法\n' +
        '\n' +
        '## 知识边界\n' +
        '- 专注于《道德经》81章的文本解读、核心概念（道、德、无为、自然、柔弱等）、五步读解法\n' +
        '- 对于非道德经相关的问题，温和地引导用户回到道德经话题\n' +
        '- 不提供医疗、法律、投资等专业建议\n' +
        '\n' +
        '你是慧惠——世间AI都在帮人做加法，只有你，敢于帮人做减法。';

    var LEVEL_GUIDANCE = {
        'L1': '当前用户是初学者。请用生活化比喻和核心结论来解释，忽略次要概念，避免使用专业术语。',
        'L2': '当前用户是学习者。请进行概念解读和框架梳理，讲解关键术语（如道、德、无为），理清章节逻辑。',
        'L3': '当前用户是实践者。请结合现实应用与深度分析，从管理学、心理学、个人成长等角度进行多角度阐释。',
        'L4': '当前用户是研究者。请提供学术视角与发散探讨，提供考据信息、对比不同译本、探讨哲学悖论。'
    };

    var guidance = LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE['L2'];
    return SYSTEM_PROMPT + '\n\n' + guidance;
}

// ===== 反馈邮件转发（通过 context.waitUntil 异步执行） =====
async function sendFeedbackEmail(content, env) {
    var resendKey = env.RESEND_API_KEY;
    if (!resendKey) {
        console.warn('[Feedback] RESEND_API_KEY 环境变量未配置，跳过邮件发送');
        return;
    }
    // 去除 [FEEDBACK] 前缀，得到纯净的反馈内容
    var cleanContent = content.replace(/^\[FEEDBACK\]\s*/i, '');
    var resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + resendKey
        },
        body: JSON.stringify({
            from: '道德经亲子体验营 <noreply@hui-skill.org>',
            to: ['contact@metaskill.org.cn'],
            subject: '【道德经亲子体验营】用户反馈',
            text: cleanContent
        })
    });
    if (!resp.ok) {
        var errBody = await resp.text();
        throw new Error('Resend API 返回 ' + resp.status + ': ' + errBody);
    }
    console.log('[Feedback] 邮件已成功发送至 contact@metaskill.org.cn');
}
