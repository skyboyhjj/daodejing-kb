/**
 * 诊断端点 — 确认 Pages Functions 是否存活
 * GET /api/ping → { ok: true, hasApiKey: boolean }
 */
export async function onRequest(context) {
    const { env } = context;
    return new Response(JSON.stringify({
        ok: true,
        time: Date.now(),
        hasApiKey: !!env.DEEPSEEK_API_KEY,
        type: 'pages-function'
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
