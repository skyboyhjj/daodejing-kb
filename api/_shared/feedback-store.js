/**
 * 慧惠 反馈数据存储 — 规范定义
 * 这是反馈数据的唯一存储入口。
 *
 * Phase 1: console.log 临时存储（Vercel Logs 可见）
 * Phase 3: 接入飞书 Bitable / Supabase 持久化存储
 *
 * 使用者:
 *   api/chat.js             — 反馈确认时调用 saveFeedback()
 *   api/admin/feedback.js   — 管理后台调用 listFeedback() / updateFeedback()
 */

var counter = 0;

/**
 * 解析反馈汇总内容，提取结构化字段
 * @param {Array} messages - 完整对话历史
 * @param {string} feedbackType - bug | suggestion | help
 * @returns {object} 结构化反馈记录
 */
function extractSummary(messages, feedbackType) {
    var record = {
        type: feedbackType,
        content: '',
        userId: 'anonymous',
        pageUrl: '',
        timestamp: new Date().toISOString()
    };

    // 从对话历史中提取元数据（__META__ 行）和用户描述
    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        if (msg.role === 'user' && msg.content) {
            // 提取元数据行
            var metaMatch = msg.content.match(/__META__:\s*uid=([^|]+)\s*\|\s*url=([^|]+)\s*\|\s*time=(.+)/);
            if (metaMatch) {
                record.userId = metaMatch[1].trim();
                record.pageUrl = metaMatch[2].trim();
                record.timestamp = metaMatch[3].trim();
            }
            // 拼接用户描述（跳过前缀和元数据行）
            var cleanContent = msg.content
                .replace(/\[FEEDBACK[^\]]*\]\s*/g, '')
                .replace(/__META__:.*$/gm, '')
                .trim();
            if (cleanContent) {
                record.content += (record.content ? '\n---\n' : '') + cleanContent;
            }
        }
    }

    return record;
}

/**
 * 保存反馈记录
 * @param {Array} messages - 完整对话历史
 * @param {string} feedbackType - 反馈类型
 * @returns {object} 保存的记录（含生成 ID）
 */
export async function saveFeedback(messages, feedbackType) {
    var dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    counter += 1;
    var id = 'FB-' + dateStr + '-' + String(counter).padStart(3, '0');

    var record = extractSummary(messages, feedbackType);
    record.id = id;
    record.status = 'pending';
    record.assignee = null;
    record.resolution = null;
    record.closedAt = null;

    // Phase 1: console.log 作为临时存储
    console.log('[FeedbackStore] ' + JSON.stringify(record));

    return record;
}

/**
 * 查询反馈列表（预留接口，Phase 3 实现）
 */
export async function listFeedback(options) {
    // Phase 3: 接入数据库查询
    console.log('[FeedbackStore] listFeedback 暂未实现');
    return [];
}

/**
 * 更新反馈状态（预留接口，Phase 3 实现）
 */
export async function updateFeedback(id, updates) {
    // Phase 3: 接入数据库更新
    console.log('[FeedbackStore] updateFeedback 暂未实现, id=' + id);
    return null;
}
