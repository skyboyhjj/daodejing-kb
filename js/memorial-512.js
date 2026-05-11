/**
 * 5·12 汶川地震纪念功能 — 独立脚本
 * 仅在 2026-05-12 当天生效，其他日期无任何影响。
 * 5 月 13 日以后可直接删除此文件及 memorial-512.css。
 */
(function () {
    'use strict';

    // ============================================================
    // 日期判断：仅 2026-05-12 (getMonth() 返回 0 基，5月=4)
    // ============================================================
    var today = new Date();
    if (today.getFullYear() !== 2026 || today.getMonth() !== 4 || today.getDate() !== 12) {
        return; // 非纪念日，静默退出
    }

    // ============================================================
    // 方案 C：覆盖慧惠聊天欢迎语（始终生效，不受卡片关闭影响）
    // ============================================================
    var MEMORIAL_WELCOME = '你好呀！我是慧惠。\n\n' +
        '今天是5月12日。十八年前的今天，汶川大地震。\n\n' +
        '老子说：\u201c飘风不终朝，骤雨不终日。\u201d\n' +
        '再大的风雨都会过去，而活着的我们，\n' +
        '带着对生命的郑重，继续前行。\n\n' +
        '今天，你想从《道德经》的哪一章开始？';

    window.HUIHUI_WELCOME_OVERRIDE = MEMORIAL_WELCOME;

    // ============================================================
    // 方案 A：首页纪念卡片
    // ============================================================

    // 检查用户是否已在当天关闭过
    var DISMISSED_KEY = 'huihui_memorial_512_dismissed';
    if (localStorage.getItem(DISMISSED_KEY) === 'true') {
        return;
    }

    // 等待 DOM 就绪后注入卡片
    function injectCard() {
        // ── 遮罩层 ──
        var overlay = document.createElement('div');
        overlay.className = 'memorial-512-overlay';

        // ── 卡片 ──
        var card = document.createElement('div');
        card.className = 'memorial-512-card';

        card.innerHTML =
            '<div class="memorial-512-icon">\uD83D\uDD4A\uFE0F</div>' +
            '<h2 class="memorial-512-title">今天，我们安静地记得</h2>' +
            '<p class="memorial-512-body">' +
            '十八年前的今天，汶川大地震。' +
            '</p>' +
            '<blockquote class="memorial-512-quote">' +
            '\u201c飘风不终朝，骤雨不终日。\u201d' +
            '</blockquote>' +
            '<p class="memorial-512-closing">' +
            '再大的风也会停，再大的雨也会歇。<br>' +
            '而活着的我们，继续前行\u2014\u2014<br>' +
            '带着对逝者的怀念，<br>' +
            '和对生命的郑重。' +
            '</p>' +
            '<div class="memorial-512-actions">' +
            '<button class="memorial-512-btn memorial-512-btn-primary">开始今天的阅读</button>' +
            '<button class="memorial-512-btn memorial-512-btn-ghost">安静地关掉</button>' +
            '</div>';

        // ── 关闭函数 ──
        function dismiss() {
            localStorage.setItem(DISMISSED_KEY, 'true');
            overlay.classList.add('memorial-512-fade-out');
            setTimeout(function () {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 400);
        }

        // ── 按钮事件 ──
        var btnRead = card.querySelector('.memorial-512-btn-primary');
        var btnClose = card.querySelector('.memorial-512-btn-ghost');

        btnRead.addEventListener('click', function () {
            dismiss();
            // 平滑滚动至主内容区
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        btnClose.addEventListener('click', function () {
            dismiss();
        });

        // 遮罩不关闭（防止误触）

        // ── 挂载并淡入 ──
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // 触发重排后添加淡入类
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                overlay.classList.add('memorial-512-visible');
            });
        });
    }

    // DOM 就绪后注入
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectCard);
    } else {
        injectCard();
    }
})();
