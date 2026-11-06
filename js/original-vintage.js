/* =====================================================================
   《道德经》原文古版展示 — 外挂增强模块（IIFE · 零服务端）
   ---------------------------------------------------------------------
   作用对象：chapters/*.html 中的 <div class="original-text">
   行为：运行时注入「古版·竖排 ⇄ 今文·横排」双视图 + 弱存在感切换 + 底本标注
   伦理对齐（慧惠·伦理即道体）：
     - 用户主权(第7条)  → localStorage 记住选择，不强制
     - 减法优先(第5条)   → 默认回归原文古版；切换控件弱存在感
     - 坦诚透明(第9条)   → 底本 / 异文 / AI辅助 显性标注
     - 外挂增强(第10条)  → 不改动 .original-text 内部结构，运行时叠加
   ===================================================================== */
(function () {
    'use strict';

    var STORAGE_KEY = 'daodejing-original-view-preference';
    var META_TEXT =
        '底本：王弼本（原文简体；竖排古版依上下文转繁体）｜异文校：帛书本、河上公本、郭店楚简';

    function readPref() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'modern' ? 'modern' : 'vintage';
        } catch (e) {
            return 'vintage';
        }
    }

    function writePref(mode) {
        try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* 忽略（受限/隐私模式） */ }
    }

    // 竖排视图：去掉横向 <br>，让文字在 vertical-rl 容器中自然铺列；并转繁体（若数据已加载）
    function toVerticalMarkup(originalEl) {
        var text = originalEl.innerHTML.replace(/<br\s*\/?>\s*/gi, '');
        if (typeof window.__dao_s2t__ === 'function') {
            text = window.__dao_s2t__(text);
        }
        return text;
    }

    function enhance(originalEl) {
        if (originalEl.getAttribute('data-vintage-enhanced') === '1') return;
        originalEl.setAttribute('data-vintage-enhanced', '1');

        // 1) 弱存在感切换条
        var toggle = document.createElement('div');
        toggle.className = 'vintage-toggle';
        toggle.setAttribute('role', 'tablist');
        toggle.setAttribute('aria-label', '原文展示方式');
        toggle.innerHTML =
            '<button type="button" data-mode="vintage">古版 · 竖排</button>' +
            '<button type="button" data-mode="modern">今文 · 横排</button>';

        // 2) 古版竖排视图
        var vintage = document.createElement('div');
        vintage.className = 'original-vintage';
        vintage.innerHTML = toVerticalMarkup(originalEl);

        // 3) 底本 / 异文 / AI 标注
        var meta = document.createElement('div');
        meta.className = 'vintage-meta';
        meta.textContent = META_TEXT;

        // 4) 组装到原文之前；原文保留作「今文视图」
        var parent = originalEl.parentNode;
        parent.insertBefore(toggle, originalEl);
        parent.insertBefore(vintage, originalEl);
        parent.insertBefore(meta, originalEl);

        // 5) 切换逻辑
        function setMode(mode) {
            var isVintage = mode === 'vintage';
            vintage.classList.toggle('vintage-hide', !isVintage);
            originalEl.classList.toggle('vintage-hide', isVintage);
            var btns = toggle.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('is-active', btns[i].getAttribute('data-mode') === mode);
            }
            writePref(mode);
        }

        toggle.addEventListener('click', function (ev) {
            var target = ev.target;
            if (target && target.getAttribute && target.getAttribute('data-mode')) {
                setMode(target.getAttribute('data-mode'));
            }
        });

        setMode(readPref());
    }

    function init() {
        var els = document.querySelectorAll('.original-text');
        for (var i = 0; i < els.length; i++) enhance(els[i]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();