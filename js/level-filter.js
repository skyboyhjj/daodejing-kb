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
                return;
            }
        }

        // 无存储偏好或按钮不存在时，使用 CSS 默认状态
        // CSS 默认：L2+L3 可见，按钮 active 标记为 L3
        // 此处仅需同步按钮状态，无需再操作 DOM 显示（CSS 已处理）
        // 但为了一致性，显式应用 L3
        applyLevel('l3');
    }

    // ── 事件绑定 ──

    toArray(buttons).forEach(function (btn) {
        btn.addEventListener('click', function () {
            var level = btn.getAttribute('data-level');
            if (level) {
                applyLevel(level);
            }
        });
    });

    // ── 初始化 ──

    restorePreference();
})();
