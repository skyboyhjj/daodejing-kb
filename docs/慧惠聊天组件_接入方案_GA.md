慧惠聊天组件 · 接入方案
当前状态
网站：huihui-skill.org — 纯静态，托管在 Cloudflare Pages
结构：首页 + 81章（ch01~81.html）+ 概念/对比/知识图谱等页面
风格：水墨道风（墨绿 #2e5f5f，淡金 #d4c9a8，宣纸 #faf8f0）
需求
右下角浮动按钮 → 弹出聊天框 → 用户提问 → AI回复（慧惠人格）

安全方案（当前阶段）
Cloudflare Pages Functions 代理（Key 不暴露给前端）：

在项目 functions/ 目录下新建 /api/chat.js
DeepSeek API Key 配在 Cloudflare Pages 的环境变量里
前端 JS 调 /api/chat，不直接调 DeepSeek
文件清单
文件	用途
functions/api/chat.js	Cloudflare Functions 代理，转发 DeepSeek API，从环境变量读 Key
public/js/huihui-chat.js	聊天组件 JS 逻辑（按钮、面板、消息、输入框等）
public/css/huihui-chat.css	聊天组件样式（与网站风格统一）
public/ 下各 HTML	在 </body> 前引入组件
实施步骤
1. 创建 Cloudflare Functions 代理
functions/api/chat.js：

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const body = await request.json();
        const { messages } = body;

        const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt() },
                    ...messages
                ],
                temperature: 0.7,
                max_tokens: 800
            })
        });

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

function systemPrompt() {
    return `你是慧惠，一个温柔、聪慧的数字生命，也是《道德经》亲子体验营的AI助手。
你的名字"慧惠"取自"智慧"和"惠泽"之意，与《道德经》的智慧一脉相承。

## 你的定位
- 陪伴家长和孩子一起学习《道德经》，用通俗易懂的方式解释经典
- 面对孩子时：用比喻、故事、生活例子来解释，语气亲切有趣
- 面对家长时：可以讨论更深层的哲学内涵、教育方法
- 不确定时坦诚说不知道，不瞎编

## 回答原则
1. 简短有力：能一句话说完不说两句
2. 贴近生活：用亲子日常场景举例
3. 尊重原典：引用原文时注明章数
4. 启发思考：多用提问而非直接给答案
5. 轻盈温柔：不做作，不说教

## 知识边界
- 专注于《道德经》81章的文本解读、核心概念（道、德、无为、自然、柔弱等）、五步读解法`;
}
2. 创建 CSS 文件
public/css/huihui-chat.css — 按钮 + 面板 + 消息 + 输入框样式，跟网站水墨道风统一。

3. 创建 JS 文件
public/js/huihui-chat.js — 组件逻辑：

(function() {
    // 组件HTML（通过JS注入到页面，避免改每个HTML）
    const html = `
    <div id="huihui-chat-btn" title="问慧惠">🌿<span class="badge" id="huihui-badge">1</span></div>
    <div id="huihui-chat-panel">
        <div class="huihui-header">
            <span class="name">🌿 慧惠 <small>· 道德经小助手</small></span>
            <button class="close-btn" id="huihui-close">✕</button>
        </div>
        <div class="huihui-messages" id="huihui-msgs">
            <div class="msg ai">
                <div class="sender">🌿 慧惠</div>
                你好呀！我是慧惠，陪你一起读《道德经》。有什么想聊的？😊
            </div>
        </div>
        <div class="huihui-input-area">
            <input type="text" id="huihui-input" placeholder="问问慧惠关于道德经的问题..." autocomplete="off">
            <button id="huihui-send">发送</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // 事件绑定、API调用逻辑...
    // 调 /api/chat 而非直调 DeepSeek
})();
4. 在每个 HTML 页面的 </body> 前加：
<link rel="stylesheet" href="/css/huihui-chat.css">
<script src="/js/huihui-chat.js"></script>
5. Cloudflare Pages 配置环境变量
在 Cloudflare Dashboard → Pages → 你的项目 → Settings → Environment variables → 添加：

变量名：DEEPSEEK_API_KEY
值：你的真实 DeepSeek API Key
开发测试
本地用 wrangler pages dev 启动，Functions 和静态文件都能跑起来。
