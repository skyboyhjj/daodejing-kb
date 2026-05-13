/**
 * 亲子共读学习进度同步 — Vercel Serverless Function
 * POST/GET /api/family_progress
 *
 * Phase 2 预留，暂未实现。当前使用前端 localStorage 本地存储。
 * TODO: 实现用户学习进度的服务端持久化
 */
export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // TODO(Phase 2): 实现用户学习进度的服务端持久化
    // - POST /api/family_progress → 保存进度（body: { mode, age, currentChapter, completedChapters, ... }）
    // - GET /api/family_progress  → 读取进度（query: ?user_id=xxx）
    return res.status(501).json({
        error: '学习进度同步功能尚未实现，当前使用 localStorage 本地存储。See TODO: api/family_progress.js'
    });
}
