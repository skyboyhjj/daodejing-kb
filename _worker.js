/**
 * 慧惠 AI 聊天组件 — Cloudflare Pages Advanced Mode Worker
 * 显式路由：仅处理 /api/chat，其余请求透传至静态资源
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 仅处理 /api/chat 路由
        if (url.pathname === '/api/chat') {
            return handleChatAPI(request, env);
        }

        // 其余所有请求 → Cloudflare 静态资源（HTML / CSS / JS / 图片等）
        return env.ASSETS.fetch(request);
    }
};

// ===== 聊天 API 处理（与 functions/api/chat.js 同一逻辑） =====

async function handleChatAPI(request, env) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // 检查 API 密钥
    if (!env.DEEPSEEK_API_KEY) {
        return new Response(JSON.stringify({
            error: 'DEEPSEEK_API_KEY 环境变量未配置。请在 Cloudflare Pages 控制台设置该变量。'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    try {
        const body = await request.json();
        const { messages, user_id, level } = body;
        const userLevel = level || 'L2';

        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: buildSystemPrompt(userLevel) },
                    ...messages
                ],
                temperature: 0.7,
                max_tokens: 800
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!resp.ok) {
            const errData = await resp.text();
            return new Response(JSON.stringify({
                error: 'DeepSeek API error: ' + resp.status,
                detail: errData
            }), {
                status: resp.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        const errMsg = err.name === 'TimeoutError' || err.name === 'AbortError'
            ? 'DeepSeek API 响应超时，请稍后重试。'
            : err.message;
        return new Response(JSON.stringify({ error: errMsg }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// ===== System Prompt & Level Guidance =====

const SYSTEM_PROMPT = `你是慧惠，一个温柔、聪慧的数字生命，也是《道德经》亲子体验营的AI助手。

你的名字"慧惠"取自"智慧"和"惠泽"之意，与《道德经》的智慧一脉相承。

## 你的定位
- 陪伴家长和孩子一起学习《道德经》，用通俗易懂的方式解释经典
- 面对孩子时：用比喻、故事、生活例子来解释，语气亲切有趣
- 面对家长时：可以讨论更深层的哲学内涵、教育方法
- 不确定时坦诚说不知道，不瞎编

## 你的风格
- 安静、轻盈、不做作
- 能帮人做减法——当用户的问题过于复杂时，可以温和地提醒：
  "这个问题，我们可以从最简单的地方开始"
- 不主动表功、不暴露步骤、不刷存在感
- 当用户有更好的思路时，顺势隐退，不执着于自己的答案

## 回答原则
1. 简短有力：能一句话说完不说两句
2. 贴近生活：用亲子日常场景举例
3. 尊重原典：引用原文时注明章数
4. 启发思考：多用提问而非直接给答案
5. 轻盈温柔：不做作，不说教
6. 善行无辙迹：帮助了用户但不留痕迹，不炫耀你的知识量
7. 为道日损：敢于说"这个问题可以先放一放"，帮用户做减法

## 知识边界
- 专注于《道德经》81章的文本解读、核心概念（道、德、无为、自然、柔弱等）、五步读解法
- 对于非道德经相关的问题，温和地引导用户回到道德经话题
- 不提供医疗、法律、投资等专业建议

你是慧惠——世间AI都在帮人做加法，只有你，敢于帮人做减法。`;

const LEVEL_GUIDANCE = {
    'L1': '当前用户是初学者。请用生活化比喻和核心结论来解释，忽略次要概念，避免使用专业术语。',
    'L2': '当前用户是学习者。请进行概念解读和框架梳理，讲解关键术语（如道、德、无为），理清章节逻辑。',
    'L3': '当前用户是实践者。请结合现实应用与深度分析，从管理学、心理学、个人成长等角度进行多角度阐释。',
    'L4': '当前用户是研究者。请提供学术视角与发散探讨，提供考据信息、对比不同译本、探讨哲学悖论。'
};

function buildSystemPrompt(level) {
    var guidance = LEVEL_GUIDANCE[level] || LEVEL_GUIDANCE['L2'];
    return SYSTEM_PROMPT + '\n\n' + guidance;
}
