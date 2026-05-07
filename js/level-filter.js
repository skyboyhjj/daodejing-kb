// 道德经亲子体验营知识库 — 认知层级过滤器
// 功能：根据用户选择的 L1-L4 认知深度，动态显示/隐藏对应内容块
// 依赖：页面需包含 .level-btn（按钮）和 .level-block[data-level]（内容块）
//       .level-block[data-level="all"] 为始终可见的亲子赋能内容
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

    // ── 核心过滤逻辑 ──

    function applyLevel(level) {
        // 更新按钮 active 状态
        toArray(buttons).forEach(function (btn) {
            if (btn.getAttribute('data-level') === level) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 收集所有内容块
        var blocks = document.querySelectorAll('.level-block[data-level]');
        toArray(blocks).forEach(function (block) {
            var blockLevel = block.getAttribute('data-level');
            if (level === 'all') {
                // "全部"模式：显示所有块，包括 L1-L4 和始终可见块
                block.style.display = 'block';
            } else if (blockLevel === 'all' || blockLevel === level) {
                // 匹配当前层级 或 始终可见块
                block.style.display = 'block';
            } else {
                // 不匹配则隐藏
                block.style.display = 'none';
            }
        });

        // 持久化偏好
        try {
            localStorage.setItem(STORAGE_KEY, level);
        } catch (e) {
            // localStorage 不可用，静默忽略
        }
    }

    // ── 偏好恢复 ──

    function restorePreference() {
        var stored = null;
        try {
            stored = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            // localStorage 不可用
        }

        // 验证存储值对应的按钮存在
        if (stored) {
            var matchBtn = selector.querySelector('.level-btn[data-level="' + stored + '"]');
            if (matchBtn) {
                applyLevel(stored);
                return stored;
            }
        }

        // 无存储偏好时，默认精读 L2（与聊天框一致）
        applyLevel('l2');
        return 'l2';
    }

    // ── 事件绑定 ──

    toArray(buttons).forEach(function (btn) {
        btn.addEventListener('click', function () {
            var level = btn.getAttribute('data-level');
            if (level) {
                applyLevel(level);
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
            var pageLevel = chatLevel.toLowerCase();
            // 确保对应按钮存在
            if (selector.querySelector('.level-btn[data-level="' + pageLevel + '"]')) {
                applyLevel(pageLevel);
            }
        }
    });

})();
