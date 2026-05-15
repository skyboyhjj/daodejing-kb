/**
 * 元数据版本查询 — Cloudflare Pages Functions
 * GET /api/metadata/version → 返回公开版元数据的三重版本标识 + 统计
 *
 * 依赖：/data/family_metadata_public.json（静态资源，部署时包含）
 */
export async function onRequest(context) {
    var request = context.request;

    var corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
        });
    }

    try {
        var url = new URL('/data/family_metadata_public.json', request.url);
        var resp = await fetch(url);

        if (!resp.ok) {
            return new Response(JSON.stringify({
                error: '公开版元数据文件不存在或无法读取 (HTTP ' + resp.status + ')'
            }), {
                status: resp.status,
                headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
            });
        }

        var pub = await resp.json();
        var chapters = pub.chapters || {};
        var chapterKeys = Object.keys(chapters);
        var approvedCount = 0;
        for (var i = 0; i < chapterKeys.length; i++) {
            if (chapters[chapterKeys[i]].review_status === 'approved') approvedCount++;
        }

        var body = JSON.stringify({
            content_hash: pub._content_hash || '',
            generated: pub._generated || '',
            format_version: pub._format_version || '',
            chapter_count: chapterKeys.length,
            approved_count: approvedCount,
            _version: pub._version || '',
            _updated: pub._updated || ''
        });

        return new Response(body, {
            status: 200,
            headers: Object.assign({}, corsHeaders, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=0, must-revalidate'
            })
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: '版本信息查询失败: ' + err.message }), {
            status: 500,
            headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json; charset=utf-8' })
        });
    }
}
