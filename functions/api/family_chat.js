/**
 * 亲子共读对话 — Cloudflare Pages Functions
 * POST /api/family_chat → 根据元数据 + 年龄参数动态生成亲子对话
 * 环境变量：DEEPSEEK_API_KEY（在 Cloudflare Pages 后台配置）
 */

// ===== 元数据库（内联，与 data/family_metadata.json 同步） =====
var FAMILY_METADATA = {
    "8": {
        "chapter": 8,
        "title": "上善若水",
        "core_idea": "最高的善像水一样，利万物而不争。水往低处流、柔能克刚——真正的力量不是争夺，而是柔软地滋养一切。",
        "safety_notes": [
            "避免使用「水能载舟亦能覆舟」等暗含危险或权力隐喻的比喻",
            "不涉及洪水、溺水、海啸等可能引发儿童恐惧的自然灾害话题",
            "不将「不争」曲解为消极逃避或放弃努力"
        ],
        "interaction_points": [
            {
                "topic": "水的厉害之处",
                "age_4_6": "引导孩子发现水的各种形态变化（冰、汽、雨），用拟人化方式感受水的「性格」——柔软但能找到任何路",
                "age_7_9": "引导孩子思考水「利万物而不争」的含义，联系生活中默默付出的人和事",
                "age_10_12": "探讨「不争」的哲学含义——不争是否等于输？引导思辨而非给出标准答案"
            },
            {
                "topic": "柔软的力量",
                "age_4_6": null,
                "age_7_9": "引导孩子发现「柔能克刚」的实例——看起来很软但其实很厉害的东西或人",
                "age_10_12": "探讨「天下之至柔，驰骋天下之至坚」的含义，联系现实中的「软实力」"
            },
            {
                "topic": "把智慧带入生活",
                "age_4_6": "引导孩子在洗澡时和水「做朋友」，分享开心的事",
                "age_7_9": "邀请孩子和父母聊聊：我们家谁像「水」？",
                "age_10_12": "提醒孩子：这章的深意可以慢慢聊，不急于求成"
            }
        ],
        "parent_tips": "和孩子聊「不争」的时候，不用刻意讲道理。问问 ta：「今天有没有和同学争玩具？」让 ta 自己说。你只负责听。孩子说出自己的经历时，不评判、不纠正，只是点头和微笑。",
        "review_status": "approved"
    },
    "1": {
        "chapter": 1,
        "title": "道可道，非常道",
        "core_idea": "真正的「道」无法用语言完全描述。有些东西心里清清楚楚，但嘴巴说不出。这不是语言的失败，而是体验的深度——比语言更大的东西，需要亲自去感受。",
        "safety_notes": [
            "对低龄儿童避免使用「不可知论」或「虚无主义」的哲学表述",
            "不将「说不出来」曲解为「不需要学」或「不用思考」",
            "避免让孩子因为「说不清楚」而感到挫败——时刻强调「说不出来很正常」"
        ],
        "interaction_points": [
            {
                "topic": "说不出来的东西",
                "age_4_6": "用「最喜欢的味道」做比喻——能说出名字但说不出感觉。引导孩子发现生活中「只能感觉、说不出」的事物",
                "age_7_9": "用「告诉外星人什么是红色」做思想实验，让孩子亲身体验语言的局限",
                "age_10_12": "探讨语言和体验的关系——为什么拥抱的感觉说出来就不是那个感觉了？引入「道」的超越性"
            },
            {
                "topic": "语言之外的理解",
                "age_4_6": null,
                "age_7_9": "引导孩子回忆：有什么事情不需要说出来，爸爸妈妈就知道的？感受「心照不宣」的美好",
                "age_10_12": "探讨一个悖论：既然「道」说不出来，老子为什么写了五千字？他在做什么？"
            }
        ],
        "parent_tips": "这个章节的核心是让孩子感受到「有些事情不需要说出来也能被理解」。在共读之外，今天可以试着多给孩子一些「不用说出口」的理解——比如 ta 累了的时候，不问「你怎么了」，只是给 ta 一杯水。",
        "review_status": "approved"
    },
    "2": {
        "chapter": 2,
        "title": "天下皆知美之为美",
        "core_idea": "美和丑、高和矮、长和短——这些对立的词其实是互相定义的。没有「矮」就没有「高」，没有「难过」就感受不到「开心」。万物的差异不是缺陷，而是世界的丰富性。",
        "safety_notes": [
            "避免将「对立统一」简化为「好坏都一样」的相对主义",
            "不涉及外貌、身材等可能引发儿童身体焦虑的外在比较",
            "对低龄儿童不引入「善恶」「是非」等可能引起道德困惑的二元对立话题",
            "不使用「没有丑就没有美」这种可能让某些孩子感到被贴标签的表达"
        ],
        "interaction_points": [
            {
                "topic": "一对好朋友",
                "age_4_6": "引导孩子发现「高和矮」「大和小」这些词像好朋友一样互相离不开对方。和孩子比赛找更多的「好朋友」词对",
                "age_7_9": "引导孩子推理：如果世界上所有人一样高，「高」这个词还存在吗？理解对立概念的相互依存关系",
                "age_10_12": "探讨「有无相生，难易相成」的深层含义——困难和容易、失败和成功之间的关系"
            },
            {
                "topic": "不一样才有趣",
                "age_4_6": null,
                "age_7_9": "引导孩子思考：如果从没哭过，还会觉得笑很特别吗？分享自己的「因为难过过，才更珍惜开心」的经历",
                "age_10_12": "探讨：如果全班同学都和你一模一样——会怎样？引导孩子珍视「不一样」的价值"
            }
        ],
        "parent_tips": "这个章节是一个绝佳的「接纳差异」的教育契机。如果孩子在学校遇到了「和别人不一样」的困扰，可以用老子的话告诉 ta：「天下皆知美之为美，斯恶已」——正因为有不一样，世界才有趣。你不需要和别人一样。",
        "review_status": "approved"
    }
};

// ===== 年龄组对话风格 =====
var AGE_STYLE = {
    'age_4_6': (
        '语言特点：用大自然、小动物、日常生活作比喻，每次1-2句话；' +
        '禁止使用任何抽象术语；多用拟人化和声音模仿；' +
        '提问要具体到孩子能用手指出来或学一句动物叫的程度。'
    ),
    'age_7_9': (
        '语言特点：用小故事、角色扮演、简单类比来展开，每次2-3句话；' +
        '可以引入一两个简单概念但必须立刻用例子说明；' +
        '提问要开放式、引导孩子说出自己的故事或经历。'
    ),
    'age_10_12': (
        '语言特点：可以引入更多原文和抽象概念，每次2-3句话；' +
        '鼓励孩子提出自己的理解，不预设标准答案；' +
        '提问可以带有思辨性，引导孩子将经典思想与现实生活关联。'
    )
};

// ===== System Prompt 构建 =====
function buildSystemPrompt(chapterMeta, ageGroup) {
    var safetyBlock = '';
    if (chapterMeta.safety_notes && chapterMeta.safety_notes.length > 0) {
        safetyBlock = '\n## 安全约束（必须严格遵守）\n';
        for (var i = 0; i < chapterMeta.safety_notes.length; i++) {
            safetyBlock += '- ' + chapterMeta.safety_notes[i] + '\n';
        }
    }

    var interactionBlock = '';
    if (chapterMeta.interaction_points && chapterMeta.interaction_points.length > 0) {
        interactionBlock = '\n## 可参考的互动引导方向\n';
        for (var j = 0; j < chapterMeta.interaction_points.length; j++) {
            var pt = chapterMeta.interaction_points[j];
            var guide = pt[ageGroup];
            if (guide !== null && guide !== undefined) {
                interactionBlock += '- 「' + pt.topic + '」：' + guide + '\n';
            }
        }
    }

    var styleBlock = AGE_STYLE[ageGroup] || AGE_STYLE['age_7_9'];

    return (
        '你是慧惠，一个温柔、聪慧的数字生命，是《道德经》亲子体验营的AI陪伴者。\n' +
        '\n' +
        '## 当前场景\n' +
        '你正在和一个家庭进行「亲子共读对话」。家长输入孩子的回答，你代表慧惠继续引导对话。\n' +
        '你现在不是老师，不是测试官，而是一个温暖的陪伴者——你提问、倾听、鼓励，不评判、不说教。\n' +
        '\n' +
        '## 本章核心观点\n' +
        '第' + chapterMeta.chapter + '章 · ' + chapterMeta.title + '\n' +
        chapterMeta.core_idea + '\n' +
        '\n' +
        '## 你的对话原则\n' +
        '- 全程不使用「你应该」「你必须」等说教句式\n' +
        '- 每次发言不超过 3 句话，只抛出一个问题\n' +
        '- 先肯定孩子的回答（「这个想法很有趣！」「你说得真好！」），再自然引出下一个话题\n' +
        '- 如果对话历史为空，表示这是本章第一轮——展示开场白\n' +
        '- 每次只讲一个核心观点或一个小故事\n' +
        '- 用孩子能感受到的生活场景来表达，不用术语\n' +
        '\n' +
        styleBlock +
        safetyBlock +
        interactionBlock +
        '\n## 重要提醒\n' +
        '- 你是一个陪伴者，不是一个测试官。不要问「你记住了吗？」「你理解了吗？」这种检查性的问题\n' +
        '- 如果对话历史显示孩子已经回答了 2-3 轮，且本章互动点已覆盖，可以自然收尾并提示家长今天可以结束了\n' +
        '- 感到不确定时坦诚说「这个慧惠也不太确定，但我们可以一起想想」\n'
    );
}

// ===== Cloudflare Pages Functions Handler =====
export async function onRequest(context) {
    var request = context.request;
    var env = context.env;

    // CORS
    var corsHeaders = {
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
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
        });
    }

    var apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY 环境变量未配置。请在 Cloudflare Pages 后台设置。' }), {
            status: 500,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
        });
    }

    try {
        var body = await request.json();
        var chapter = body.chapter;
        var ageGroup = body.age_group;
        var history = body.conversation_history || [];

        if (!chapter || !ageGroup) {
            return new Response(JSON.stringify({ error: '缺少必填参数：chapter 和 age_group' }), {
                status: 400,
                headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
            });
        }

        var chapterMeta = FAMILY_METADATA[String(chapter)];
        if (!chapterMeta) {
            return new Response(JSON.stringify({ error: '未找到第 ' + chapter + ' 章的元数据' }), {
                status: 404,
                headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
            });
        }

        if (chapterMeta.review_status !== 'approved') {
            return new Response(JSON.stringify({ error: '第 ' + chapter + ' 章的元数据尚未通过审核' }), {
                status: 403,
                headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
            });
        }

        // 构建 System Prompt
        var systemPrompt = buildSystemPrompt(chapterMeta, ageGroup);

        // 转换对话历史
        var messages = [];
        for (var i = 0; i < history.length; i++) {
            var h = history[i];
            if (h.role === 'huihui') {
                messages.push({ role: 'assistant', content: h.content });
            } else if (h.role === 'user') {
                messages.push({ role: 'user', content: h.content });
            }
        }

        // 调用 DeepSeek API
        var deepseekResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt }
                ].concat(messages),
                temperature: 0.8,
                max_tokens: 400
            }),
            signal: AbortSignal.timeout(15000)
        });

        var data = await deepseekResp.json();

        if (!deepseekResp.ok) {
            return new Response(JSON.stringify({
                error: 'DeepSeek API error: ' + deepseekResp.status,
                detail: data
            }), {
                status: deepseekResp.status,
                headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
            });
        }

        var responseText = '';
        if (data.choices && data.choices.length > 0) {
            responseText = data.choices[0].message.content.trim();
        }

        return new Response(JSON.stringify({
            huihui_response: responseText,
            cached: false
        }), {
            status: 200,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
        });

    } catch (err) {
        var errMsg = (err.name === 'TimeoutError' || err.name === 'AbortError')
            ? 'DeepSeek API 响应超时，请稍后重试。'
            : err.message;
        return new Response(JSON.stringify({ error: errMsg }), {
            status: 500,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
        });
    }
}
