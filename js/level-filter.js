// 道德经亲子体验营知识库 — 认知层级过滤器
// 功能：根据用户选择的 L1-L4 认知深度，动态显示/隐藏对应内容块
// 依赖：页面需包含 .level-btn（按钮）和 .level-block[data-level]（内容块）
//       .level-block[data-level="all"] 为始终可见的亲子赋能内容
// 增强（v2）：支持 URL 参数 ?level=l1 ~ l4 | all，导航链接自动携带层级参数
//       L1 模式下自动注入 l1-mode.css，设置 body class 用于 CSS 作用域
(function () {
    'use strict';

    var STORAGE_KEY = 'daodejing-level-preference';

    var selector = document.getElementById('level-selector');
    if (!selector) { return; } // 页面无层级选择器则跳过

    var buttons = selector.querySelectorAll('.level-btn');
    if (!buttons.length) { return; }

    // ── 工具函数 ──

    // 将 NodeList 转为 Array（兼容 ES5）
    function toArray(nodeList) {
        return Array.prototype.slice.call(nodeList);
    }

    // ── 新增：URL 参数解析 ──

    function getURLLevel() {
        try {
            var params = new URLSearchParams(window.location.search);
            var level = params.get('level');
            if (level && ['l1', 'l2', 'l3', 'l4', 'all'].indexOf(level) !== -1) {
                return level;
            }
        } catch (e) {
            // URLSearchParams 不可用（极旧浏览器）
        }
        return null;
    }

    // ── 新增：更新 URL 参数（不创建历史记录）──

    function updateURL(level) {
        try {
            var params = new URLSearchParams(window.location.search);
            params.set('level', level);
            var newSearch = params.toString();
            var newURL = window.location.pathname + (newSearch ? '?' + newSearch : '');
            history.replaceState(null, '', newURL);
        } catch (e) {
            // 静默忽略
        }
    }

    // ── 新增：设置 body class 用于 CSS 作用域 ──

    function setBodyClass(level) {
        var cls = document.body.classList;
        cls.remove('level-l1', 'level-l2', 'level-l3', 'level-l4', 'level-all');
        cls.add('level-' + level);
    }

    // ── 新增：按需注入 L1 儿童友好样式 ──

    function injectL1CSS() {
        if (document.getElementById('l1-mode-css')) return;

        var link = document.createElement('link');
        link.id = 'l1-mode-css';
        link.rel = 'stylesheet';

        // 根据页面路径深度计算 stylesheet 的相对路径
        var path = window.location.pathname;
        if (path.indexOf('/chapters/') !== -1 || path.indexOf('/l1/') !== -1) {
            link.href = '../css/l1-mode.css';
        } else {
            link.href = 'css/l1-mode.css';
        }

        document.head.appendChild(link);
    }

    // ── 新增：重写导航链接，保持层级上下文 ──

    function rewriteNavLinks(level) {
        var allLinks = document.querySelectorAll(
            '.nav-chapters a, .chapter-nav a, .back-home a'
        );

        toArray(allLinks).forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href || href.indexOf('#') === 0) {
                return; // 跳过空链接和页内锚点
            }

            // ── 章节间链接（相对路径 chXX.html）──
            if (/^ch\d{1,2}\.html/.test(href)) {
                if (!link.getAttribute('data-orig-href')) {
                    link.setAttribute('data-orig-href', href);
                }
                // 清除已有的 level 参数，追加新的
                var clean = href.replace(/[?&]level=[a-z0-9]+/g, '');
                link.setAttribute('href', clean + '?level=' + level);
                return;
            }

            // ── chapters.html 目录页链接 ──
            if (/chapters\.html/.test(href)) {
                if (!link.getAttribute('data-orig-href')) {
                    link.setAttribute('data-orig-href', href);
                }
                var cleanCh = href.replace(/[?&]level=[a-z0-9]+/g, '');
                var sep = cleanCh.indexOf('?') === -1 ? '?' : '&';
                link.setAttribute('href', cleanCh + sep + 'level=' + level);
                return;
            }
        });
    }

    // ── 核心过滤逻辑 ──

    function applyLevel(level, fromURL) {
        // 更新按钮 active 状态
        toArray(buttons).forEach(function (btn) {
            if (btn.getAttribute('data-level') === level) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 收集所有 level-block 内容块
        var blocks = document.querySelectorAll('.level-block[data-level]');
        var visibleCount = 0;
        toArray(blocks).forEach(function (block) {
            var blockLevel = block.getAttribute('data-level');
            if (level === 'all') {
                // "全部"模式：显示所有块
                block.style.display = 'block';
                visibleCount++;
            } else if (blockLevel === 'all' || blockLevel === level) {
                // 匹配当前层级 或 始终可见块
                block.style.display = 'block';
                visibleCount++;
            } else {
                // 不匹配则隐藏
                block.style.display = 'none';
            }
        });
        // 设置 body CSS class（用于 l1-mode.css 等层级作用域样式）
        setBodyClass(level);

        // L1 模式下注入儿童友好样式表
        if (level === 'l1') {
            injectL1CSS();
        }

        // 持久化偏好（URL 参数触发的初始化不写入 localStorage）
        if (!fromURL) {
            try {
                localStorage.setItem(STORAGE_KEY, level);
            } catch (e) {
                // localStorage 不可用，静默忽略
            }
        }

        // 重写导航链接，保持层级上下文
        rewriteNavLinks(level);
    }

    // ── 偏好恢复 ──

    function restorePreference() {
        // ① URL 参数优先（本次访问专属，不持久化）
        var urlLevel = getURLLevel();
        if (urlLevel) {
            applyLevel(urlLevel, true);
            return urlLevel;
        }

        // ② localStorage 偏好
        var stored = null;
        try {
            stored = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            // localStorage 不可用
        }

        if (stored) {
            var matchBtn = selector.querySelector('.level-btn[data-level="' + stored + '"]');
            if (matchBtn) {
                applyLevel(stored, false);
                return stored;
            }
        }

        // ③ 无偏好时，默认精读 L2（与聊天框一致）
        applyLevel('l2', false);
        return 'l2';
    }

    // ── 事件绑定 ──

    toArray(buttons).forEach(function (btn) {
        btn.addEventListener('click', function () {
            var level = btn.getAttribute('data-level');
            if (level) {
                applyLevel(level, false);
                // 更新 URL 参数
                updateURL(level);
                // 仅 L1-L4 时同步聊天框，'all' 不影响聊天框
                if (level !== 'all') {
                    window.dispatchEvent(new CustomEvent('huihui-level-changed', {
                        detail: { level: level.toUpperCase() }
                    }));
                }
            }
        });
    });

    // ── 初始化 ──

    var restoredLevel = restorePreference();

    // 初始化时同步聊天框（"全部"模式不触发）
    if (restoredLevel && restoredLevel !== 'all') {
        window.dispatchEvent(new CustomEvent('huihui-level-changed', {
            detail: { level: restoredLevel.toUpperCase() }
        }));
    }

    // ── 监听聊天框层级变化，双向同步 ──
    window.addEventListener('huihui-level-changed', function (e) {
        var chatLevel = e.detail && e.detail.level;
        if (chatLevel && chatLevel !== 'ALL') {
            // URL 参数优先：如果 URL 中已有 level 参数，不覆盖
            var urlLevel = getURLLevel();
            if (urlLevel) return;

            var pageLevel = chatLevel.toLowerCase();
            // 确保对应按钮存在
            if (selector.querySelector('.level-btn[data-level="' + pageLevel + '"]')) {
                applyLevel(pageLevel, false);
                updateURL(pageLevel);
            }
        }
    });

})();
