/**
 * SkillUP — 用户许可管理（v2.0）
 * 版本：v2.0
 * 职责：连续3天访问后在聊天中轻声征求许可（非弹窗）
 *
 * 设计约束：
 * - 独立于 SkillUP 数据，使用单独的 localStorage key
 * - 用户首次访问不征求、不记录学习数据
 * - 连续3天访问后，由聊天组件（huihui-chat.js / family.js）征求许可
 * - 用户拒绝后立即清除临时数据，不再主动询问
 * - 用户忽略（不回应）后不重复征求
 */
(function () {
    'use strict';

    // ===== 常量（独立于 SkillUP 数据存储） =====
    var VISIT_DATES_KEY = 'huihui_visit_dates';     // 访问日期数组 ['2026-05-15','2026-05-16']
    var ASK_DATE_KEY = 'huihui_consent_ask_date';    // 上次征求日期
    var DECLINED_KEY = 'huihui_consent_declined';    // 'true' 表示已拒绝
    var CONSENT_KEY = 'huihui_tracking_consent';     // 'true' 表示已授权

    // ===== 日期工具 =====
    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    // ===== 访问日期追踪 =====
    function recordVisit() {
        var dates = [];
        try {
            var raw = localStorage.getItem(VISIT_DATES_KEY);
            if (raw) { dates = JSON.parse(raw); }
            if (!Array.isArray(dates)) { dates = []; }
        } catch (e) { dates = []; }

        var today = todayStr();
        if (dates.indexOf(today) === -1) {
            dates.push(today);
            // 仅保留最近 14 天
            if (dates.length > 14) { dates = dates.slice(-14); }
            try {
                localStorage.setItem(VISIT_DATES_KEY, JSON.stringify(dates));
            } catch (e) { /* ignore */ }
        }
        return dates;
    }

    function getConsecutiveDays(dates) {
        if (!dates || dates.length === 0) return 0;
        var sorted = dates.slice().sort();
        var today = todayStr();
        var yesterday = (function () {
            var d = new Date(Date.now() - 86400000);
            return d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
        })();

        var lastDate = sorted[sorted.length - 1];
        if (lastDate !== today && lastDate !== yesterday) return 0;

        var consecutive = 1;
        for (var i = sorted.length - 2; i >= 0; i--) {
            var prev = new Date(sorted[i + 1]);
            prev.setDate(prev.getDate() - 1);
            var prevStr = prev.getFullYear() + '-' +
                String(prev.getMonth() + 1).padStart(2, '0') + '-' +
                String(prev.getDate()).padStart(2, '0');
            if (prevStr === sorted[i]) {
                consecutive++;
            } else {
                break;
            }
        }
        return consecutive;
    }

    // ===== 征求条件判断 =====
    function hasUserConsented() {
        return localStorage.getItem(CONSENT_KEY) === 'true';
    }

    function hasUserDeclined() {
        return localStorage.getItem(DECLINED_KEY) === 'true';
    }

    function wasAskedToday() {
        return localStorage.getItem(ASK_DATE_KEY) === todayStr();
    }

    // 7 天内征求过则不再重复征求（用户忽略的情况）
    function wasAskedRecently() {
        var lastAsk = localStorage.getItem(ASK_DATE_KEY);
        if (!lastAsk) return false;
        var askDate = new Date(lastAsk + 'T00:00:00');
        var now = new Date();
        var diffDays = Math.floor((now - askDate) / 86400000);
        return diffDays < 7;
    }

    function shouldAskForConsent() {
        if (hasUserConsented()) return false;
        if (hasUserDeclined()) return false;
        if (wasAskedRecently()) return false;

        var dates = recordVisit();
        var consecutive = getConsecutiveDays(dates);
        // 连续 3 天访问时征求（第 3 天触发）
        return consecutive >= 3;
    }

    function markAsked() {
        try {
            localStorage.setItem(ASK_DATE_KEY, todayStr());
        } catch (e) { /* ignore */ }
    }

    // ===== 许可授予/拒绝 =====
    function grantConsent() {
        try {
            localStorage.setItem(CONSENT_KEY, 'true');
            // 桥接到 SkillUP 现有许可系统
            if (window.SkillUP) {
                window.SkillUP.giveConsent();
                window.SkillUP.enableTracking();
                window.SkillUP.init();
            }
            // 清除临时数据
            localStorage.removeItem(VISIT_DATES_KEY);
            localStorage.removeItem(ASK_DATE_KEY);
        } catch (e) { /* ignore */ }
    }

    function declineConsent() {
        try {
            localStorage.setItem(DECLINED_KEY, 'true');
            // 清除所有临时数据
            localStorage.removeItem(VISIT_DATES_KEY);
            localStorage.removeItem(ASK_DATE_KEY);
        } catch (e) { /* ignore */ }
    }

    // ===== 许可响应文本识别 =====
    var AFFIRMATIVE_PATTERNS = [
        '好的', '好呀', '好', '可以', '行', '行吧',
        '开启', '打开', '开', '是', '是的', '嗯嗯', '嗯',
        '帮我记', '记吧', '要', '要的', '需要', '需要的',
        '没问题', 'ok', 'OK', 'Ok', '好滴', '好吧',
        '同意', '授权', '允许', '没问题呀', '保存'
    ];

    var DECLINING_PATTERNS = [
        '不', '不用', '不要', '不需要', '不了', '不必',
        '算了', '先不', '暂不', '以后再说', '下次',
        '拒绝', '不必了'
    ];

    function isAffirmative(text) {
        if (!text) return false;
        var t = text.replace(/\s+/g, '').toLowerCase();
        // 过滤掉正常提问（如"好不好"不是肯定答复）
        if (t.indexOf('?') !== -1 || t.indexOf('？') !== -1) return false;
        if (t.indexOf('不好') !== -1) return false;
        for (var i = 0; i < AFFIRMATIVE_PATTERNS.length; i++) {
            if (t === AFFIRMATIVE_PATTERNS[i] || t.indexOf(AFFIRMATIVE_PATTERNS[i]) === 0) {
                return true;
            }
        }
        return false;
    }

    function isDeclining(text) {
        if (!text) return false;
        var t = text.replace(/\s+/g, '').toLowerCase();
        for (var i = 0; i < DECLINING_PATTERNS.length; i++) {
            if (t === DECLINING_PATTERNS[i] || t.indexOf(DECLINING_PATTERNS[i]) === 0) {
                return true;
            }
        }
        return false;
    }

    // ===== 征求消息文案 =====
    function getConsentMessage() {
        return '我注意到你最近常来看我。如果你愿意，我可以帮你记住读到哪一章了、你问过哪些问题。都在你自己的浏览器里，不会发到任何地方。要开启吗？';
    }

    function getGrantedMessage() {
        return '好的，我记住了。从今天起，我会帮你记录学习旅程中的足迹。你随时可以在首页「我的成长」卡片中查看或清除。';
    }

    function getDeclinedMessage() {
        return '没问题。我不会记录任何信息。如果你想开启，随时告诉我。';
    }

    // ===== 初始化：记录本次访问 =====
    recordVisit();

    // ===== 公开 API =====
    window.HuihuiConsent = {
        shouldAskForConsent: shouldAskForConsent,
        hasUserConsented: hasUserConsented,
        hasUserDeclined: hasUserDeclined,
        wasAskedToday: wasAskedToday,
        markAsked: markAsked,
        grantConsent: grantConsent,
        declineConsent: declineConsent,
        isAffirmative: isAffirmative,
        isDeclining: isDeclining,
        getConsecutiveDays: function () {
            var dates = [];
            try {
                var raw = localStorage.getItem(VISIT_DATES_KEY);
                if (raw) { dates = JSON.parse(raw); }
            } catch (e) { /* ignore */ }
            return getConsecutiveDays(dates);
        },
        getConsentMessage: getConsentMessage,
        getGrantedMessage: getGrantedMessage,
        getDeclinedMessage: getDeclinedMessage
    };

    console.log('[HuihuiConsent] 许可管理 v2.0 已就绪（3天征求模式）');
})();
