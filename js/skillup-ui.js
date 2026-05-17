/**
 * SkillUP — 「我的成长」卡片 UI 组件
 * 版本：v3.0
 * 职责：首页注入成长卡片（四阶段/81章完成）、内联展开/收起学习详情、「回顾旅程」回顾
 *
 * 设计约束：
 * - 仅在首页展示"我的成长"卡片
 * - 章节页面底部注入成长引导语
 * - 卡片点击展开/收起（替代模态框）
 * - 81章完成后显示纪念版卡片
 * - 样式与水墨道风统一
 * - 无评分、无排名、无比较
 */
(function () {
    'use strict';

    // ===== 页面类型判断 =====
    function isHomePage() {
        var path = window.location.pathname.replace(/\/$/, '');
        return path === '' || path === '/index.html' || path === '/';
    }

    function isChapterPage() {
        var path = window.location.pathname;
        return /\/chapters\/\d+/.test(path) || /ch\d+\.html/.test(path);
    }

    // ===== 等待 SkillUP 就绪 =====
    function waitForReady(callback) {
        if (window.SkillUP) {
            callback();
            return;
        }
        var attempts = 0;
        var timer = setInterval(function () {
            attempts++;
            if (window.SkillUP) {
                clearInterval(timer);
                callback();
            } else if (attempts >= 50) {
                clearInterval(timer);
                console.warn('[SkillUP-UI] SkillUP 追踪器未加载，跳过');
            }
        }, 100);
    }

    waitForReady(function () {
        initUI();
    });

    // ===== 主初始化 =====
    function initUI() {
        // 初始化追踪器
        SkillUP.init();

        if (isHomePage()) {
            injectGrowthCard();
        } else if (isChapterPage()) {
            injectChapterGuidance();
        }
    }

    // ===== 阶段特定文本 =====
    var STAGE_OPENING = {
        '水滴': '你从一颗水滴出发。',
        '溪流': '你从一颗水滴出发，现在是潺潺的溪流了。',
        '江河': '你从一条溪流走来，现在是壮阔的江河了。',
        '江海': '你从江河汇入江海。百川归海，万物得道。'
    };

    var STAGE_CLOSING = {
        '水滴': '每一章都是一次新的遇见。',
        '溪流': '继续前行吧，江河不远了。',
        '江河': '老子说"江海所以能为百谷王者，以其善下之"。',
        '江海': '谢谢你陪我走过这一段路。'
    };

    var LEVEL_NAMES = { L1: '白话', L2: '精读', L3: '应用', L4: '学术' };

    // ===== 注入「我的成长」卡片（首页） =====
    function injectGrowthCard() {
        var cardsContainer = document.querySelector('.entry-cards');
        if (!cardsContainer) {
            console.warn('[SkillUP-UI] 未找到 .entry-cards 容器');
            return;
        }

        var hasConsented = SkillUP.hasConsent();
        var summary = SkillUP.getGrowthSummary();

        var cardEl = document.createElement('div');
        cardEl.className = 'skillup-card entry-card';
        cardEl.id = 'skillup-growth-card';

        if (!hasConsented) {
            // 未授权
            cardEl.innerHTML = buildConsentCardHTML();
            cardEl.addEventListener('click', function () {
                if (SkillUP.hasConsent()) {
                    refreshCard();
                    return;
                }
                // 标记从「我的成长」卡片触发，用于 openPanel 显示预征求引导
                window.__skillupCardTrigger = true;
                // 打开慧惠聊天面板，引导用户通过对话启动许可流程
                if (typeof openHuihuiChat === 'function') {
                    openHuihuiChat();
                }
                // 持续监听许可状态变化，授权后自动刷新卡片
                var checkTimer = setInterval(function () {
                    if (SkillUP.hasConsent()) {
                        clearInterval(checkTimer);
                        refreshCard();
                    }
                }, 500);
                setTimeout(function () { clearInterval(checkTimer); }, 30000);
            });
        } else if (!summary.trackingEnabled) {
            // 已授权但已暂停
            cardEl.innerHTML = buildPausedCardHTML();
            cardEl.addEventListener('click', function () {
                SkillUP.enableTracking();
                SkillUP.init();
                refreshCard();
            });
        } else {
            // 正常模式：判断是否为81章完成
            if (summary.allChaptersCompleted) {
                cardEl.innerHTML = buildCompletionCardHTML(summary);
            } else {
                cardEl.innerHTML = buildGrowthCardHTML(summary);
            }
            // 卡片点击：内联展开/收起
            cardEl.addEventListener('click', function (e) {
                // 如果点击的是"回顾旅程"按钮，不触发展开
                if (e.target && e.target.closest && e.target.closest('#skillup-retrospective-btn')) return;
                toggleCardDetail(cardEl);
            });
        }

        cardsContainer.appendChild(cardEl);
        console.log('[SkillUP-UI] 成长卡片已注入');
    }

    // ===== 构建未授权卡片 HTML =====
    function buildConsentCardHTML() {
        return '<span class="card-icon">💧</span>' +
            '<span>' +
            '<div class="card-title">我的成长</div>' +
            '<div class="card-desc">点击开启，慧惠陪你记录学习旅程</div>' +
            '</span>';
    }

    // ===== 构建暂停卡片 HTML =====
    function buildPausedCardHTML() {
        return '<span class="card-icon">💤</span>' +
            '<span>' +
            '<div class="card-title">我的成长</div>' +
            '<div class="card-desc">已暂停记录，点击恢复</div>' +
            '</span>';
    }

    // ===== 构建四阶段成长卡片 HTML =====
    function buildGrowthCardHTML(summary) {
        var stage = summary.currentStage || '水滴';
        var chaptersRead = summary.totalChaptersRead;
        var msgCount = summary.messageCount;
        var opening = STAGE_OPENING[stage] || '';
        var closing = STAGE_CLOSING[stage] || '';
        var depthText = getDepthText(summary);
        var recentText = buildRecentText(summary.recentChapters);

        return '<div class="skillup-card-inner">' +
            // 头部：图标 + 标题
            '<div class="skillup-card-header">' +
            '<span class="skillup-card-icon">🪷</span>' +
            '<span class="skillup-card-title">我的修行之旅</span>' +
            '</div>' +
            // 主体
            '<div class="skillup-card-body">' +
            '<p class="skillup-card-opening">' + opening + '</p>' +
            '<div class="skillup-card-metrics">' +
            '<div class="skillup-metric">📖 读过了 <strong>' + chaptersRead + '</strong> 章</div>' +
            '<div class="skillup-metric">💬 和慧惠聊过 <strong>' + msgCount + '</strong> 次</div>' +
            '<div class="skillup-metric">🎯 ' + depthText + '</div>' +
            (summary.recentChapters && summary.recentChapters.length > 0 ?
                '<div class="skillup-metric">🗓️ 最近在读：' + recentText + '</div>' : '') +
            '</div>' +
            '<p class="skillup-card-closing">' + closing + '</p>' +
            '</div>' +
            // 底部：展开提示
            '<div class="skillup-card-footer">' +
            '<span class="skillup-expand-hint">查看详情 ▾</span>' +
            '</div>' +
            // 已展开区域（初始隐藏）
            '<div class="skillup-card-detail" style="display:none;">' +
            buildExpandedDetailHTML(summary) +
            '</div>' +
            '</div>';
    }

    // ===== 构建81章完成纪念卡片 HTML =====
    function buildCompletionCardHTML(summary) {
        var msgCount = summary.messageCount;

        return '<div class="skillup-card-inner">' +
            // 头部
            '<div class="skillup-card-header">' +
            '<span class="skillup-card-icon">🪷</span>' +
            '<span class="skillup-card-title">我的修行之旅</span>' +
            '</div>' +
            // 主体
            '<div class="skillup-card-body">' +
            '<p class="skillup-card-opening skillup-completion-opening">百川归海，万物得道。<br>你读完了《道德经》全部八十一章。</p>' +
            '<div class="skillup-card-metrics">' +
            '<div class="skillup-metric">📖 <strong>81</strong> 章，全程走过</div>' +
            '<div class="skillup-metric">💬 和慧惠聊过 <strong>' + msgCount + '</strong> 次</div>' +
            '<div class="skillup-metric">🎯 从"白话"到"学术"，你探索了每一种深度</div>' +
            '<div class="skillup-metric">🪷 你从水滴出发，汇入江海</div>' +
            '</div>' +
            '<p class="skillup-card-closing skillup-completion-quote">' +
            '老子说："信言不美，美言不信。"<br>你读完了最后一章，但这不是结束。' +
            '</p>' +
            '</div>' +
            // 底部：双按钮
            '<div class="skillup-card-footer skillup-completion-footer">' +
            '<button class="skillup-retrospective-btn" id="skillup-retrospective-btn">回顾旅程</button>' +
            '<span class="skillup-expand-hint">查看详情 ▾</span>' +
            '</div>' +
            // 已展开区域（初始隐藏）
            '<div class="skillup-card-detail" style="display:none;">' +
            buildExpandedDetailHTML(summary) +
            '</div>' +
            '</div>';
    }

    // ===== 构建展开详情 HTML =====
    function buildExpandedDetailHTML(summary) {
        var html = '<div class="skillup-detail-divider"></div>';

        // 总览统计
        html += '<div class="skillup-detail-stats">' +
            '<div class="skillup-detail-stat">📖 一共读了 <strong>' + summary.totalChaptersRead + '</strong> 章</div>' +
            '<div class="skillup-detail-stat">💬 和慧惠聊过 <strong>' + summary.messageCount + '</strong> 次</div>' +
            '</div>';

        // 认知深度切换
        var ut = summary.upTransitions || {};
        var hasTransitions = ut['L1→L2'] > 0 || ut['L2→L3'] > 0 || ut['L3→L4'] > 0;
        if (hasTransitions) {
            html += '<div class="skillup-detail-section">' +
                '<div class="skillup-detail-label">🎯 认知深度切换</div>' +
                '<div class="skillup-detail-list">';
            if (ut['L1→L2'] > 0) html += '<div class="skillup-detail-item">白话 → 精读：' + ut['L1→L2'] + ' 次</div>';
            if (ut['L2→L3'] > 0) html += '<div class="skillup-detail-item">精读 → 应用：' + ut['L2→L3'] + ' 次</div>';
            if (ut['L3→L4'] > 0) html += '<div class="skillup-detail-item">应用 → 学术：' + ut['L3→L4'] + ' 次</div>';
            html += '</div></div>';
        }

        // 最常访问的主题
        if (summary.keywords && summary.keywords.length > 0) {
            html += '<div class="skillup-detail-section">' +
                '<div class="skillup-detail-label">📊 常访问的概念</div>' +
                '<div class="skillup-detail-list">' +
                '<div class="skillup-detail-item">' + summary.keywords.slice(0, 5).join('、') + '</div>' +
                '</div></div>';
        }

        // 阶段跃迁记录
        var stageHistory = summary.stageHistory || [];
        if (stageHistory.length > 0) {
            html += '<div class="skillup-detail-section">' +
                '<div class="skillup-detail-label">🪷 阶段跃迁记录</div>' +
                '<div class="skillup-detail-list">';
            stageHistory.forEach(function (h) {
                var dateStr = formatDate(h.timestamp);
                var desc = h.trigger || '';
                html += '<div class="skillup-detail-item">· ' + dateStr + ' <strong>' +
                    h.from + '→' + h.to + '</strong> ' + desc + '</div>';
            });
            html += '</div></div>';
        }

        // 81章完成额外记录
        if (summary.allChaptersCompleted && summary.allChaptersCompletedAt) {
            var completionDate = formatDate(summary.allChaptersCompletedAt);
            html += '<div class="skillup-detail-section">' +
                '<div class="skillup-detail-list">' +
                '<div class="skillup-detail-item skillup-completion-mark">· ' + completionDate +
                ' <strong>读完81章</strong>（百川归海）</div>' +
                '</div></div>';
        }

        // 收起提示
        html += '<div class="skillup-detail-collapse">点击收起 ▴</div>';

        return html;
    }

    // ===== 认知深度文本 =====
    function getDepthText(summary) {
        var stage = summary.currentStage || '水滴';
        var depthTexts = {
            '水滴': '刚刚开始在"白话"模式下探索',
            '溪流': '开始用"精读"模式探索了',
            '江河': '经常切换到"应用"模式深入思考',
            '江海': '已经进入"学术"深度思辨'
        };
        return depthTexts[stage] || '在探索中';
    }

    // ===== 最近章节文本 =====
    function buildRecentText(chapters) {
        if (!chapters || chapters.length === 0) return '';
        if (chapters.length === 1) return '第 ' + chapters[0] + ' 章';
        if (chapters.length === 2) return '第 ' + chapters[0] + '、' + chapters[1] + ' 章';
        return '第 ' + chapters.join('、') + ' 章';
    }

    // ===== 格式化日期 =====
    function formatDate(isoStr) {
        if (!isoStr) return '';
        try {
            var d = new Date(isoStr);
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        } catch (e) {
            return '';
        }
    }

    // ===== 内联展开/收起 =====
    function toggleCardDetail(cardEl) {
        var detail = cardEl.querySelector('.skillup-card-detail');
        var hint = cardEl.querySelector('.skillup-expand-hint');
        var body = cardEl.querySelector('.skillup-card-body');
        var inner = cardEl.querySelector('.skillup-card-inner');

        if (!detail) return;

        var isExpanded = detail.style.display !== 'none';

        if (isExpanded) {
            // 收起
            detail.style.display = 'none';
            if (hint) hint.textContent = '查看详情 ▾';
            if (inner) inner.classList.remove('skillup-card-expanded');
            if (body) body.style.display = '';
        } else {
            // 展开
            detail.style.display = 'block';
            if (hint) hint.textContent = '收起详情 ▴';
            if (inner) inner.classList.add('skillup-card-expanded');
        }
    }

    // ===== 回顾旅程（全屏回顾卡片） =====
    function showRetrospective(summary) {
        // 移除已有回顾卡片
        var existing = document.getElementById('skillup-retrospective-overlay');
        if (existing) existing.parentNode.removeChild(existing);

        var overlay = document.createElement('div');
        overlay.id = 'skillup-retrospective-overlay';
        overlay.className = 'skillup-retro-overlay';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeRetrospective();
        });

        var content = buildRetrospectiveHTML(summary);
        overlay.innerHTML = content;
        document.body.appendChild(overlay);

        // 绑定关闭按钮
        var closeBtn = overlay.querySelector('.skillup-retro-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeRetrospective);
        }
    }

    function closeRetrospective() {
        var overlay = document.getElementById('skillup-retrospective-overlay');
        if (overlay) overlay.parentNode.removeChild(overlay);
    }

    function buildRetrospectiveHTML(summary) {
        var chaptersRead = summary.totalChaptersRead;
        var msgCount = summary.messageCount;
        var stageHistory = summary.stageHistory || [];
        var keywords = summary.keywords || [];
        var ut = summary.upTransitions || {};

        var html = '<div class="skillup-retro-content">' +
            // 头部
            '<div class="skillup-retro-header">' +
            '<span class="skillup-retro-icon">🪷</span>' +
            '<h2 class="skillup-retro-title">回顾旅程</h2>' +
            '<button class="skillup-retro-close">✕</button>' +
            '</div>';

        // 总览
        html += '<div class="skillup-retro-body">' +
            '<p class="skillup-retro-opening">你读完了《道德经》全部八十一章。</p>' +
            '<p class="skillup-retro-opening">从一颗水滴出发，汇入江海——老子说"江海所以能为百谷王者，以其善下之"。</p>';

        // 统计数字
        html += '<div class="skillup-retro-stats">' +
            '<div class="skillup-retro-stat">' +
            '<span class="skillup-retro-stat-value">' + chaptersRead + '</span>' +
            '<span class="skillup-retro-stat-label">章</span>' +
            '</div>' +
            '<div class="skillup-retro-stat">' +
            '<span class="skillup-retro-stat-value">' + msgCount + '</span>' +
            '<span class="skillup-retro-stat-label">次对话</span>' +
            '</div>' +
            '<div class="skillup-retro-stat">' +
            '<span class="skillup-retro-stat-value">' + (ut['L1→L2'] + ut['L2→L3'] + ut['L3→L4']) + '</span>' +
            '<span class="skillup-retro-stat-label">次深度提升</span>' +
            '</div>' +
            '</div>';

        // 阶段跃迁
        if (stageHistory.length > 0) {
            html += '<div class="skillup-retro-section">' +
                '<h3 class="skillup-retro-section-title">🪷 跃迁之路</h3>' +
                '<div class="skillup-retro-timeline">';
            stageHistory.forEach(function (h) {
                var dateStr = formatDate(h.timestamp);
                html += '<div class="skillup-retro-timeline-item">' +
                    '<div class="skillup-retro-timeline-date">' + dateStr + '</div>' +
                    '<div class="skillup-retro-timeline-text">' +
                    h.from + ' → ' + h.to + ' ' + h.trigger +
                    '</div>' +
                    '</div>';
            });
            if (summary.allChaptersCompleted && summary.allChaptersCompletedAt) {
                var completionDate = formatDate(summary.allChaptersCompletedAt);
                html += '<div class="skillup-retro-timeline-item">' +
                    '<div class="skillup-retro-timeline-date">' + completionDate + '</div>' +
                    '<div class="skillup-retro-timeline-text">读完81章（百川归海）</div>' +
                    '</div>';
            }
            html += '</div></div>';
        }

        // 探索的深度
        html += '<div class="skillup-retro-section">' +
            '<h3 class="skillup-retro-section-title">🎯 你探索的深度</h3>' +
            '<p class="skillup-retro-text">';
        var levels = [];
        if (summary.levelUse) {
            if (summary.levelUse.L1 > 0) levels.push('白话启蒙');
            if (summary.levelUse.L2 > 0) levels.push('精读理解');
            if (summary.levelUse.L3 > 0) levels.push('应用体悟');
            if (summary.levelUse.L4 > 0) levels.push('学术思辨');
        }
        html += '从"白话"到"学术"，你探索了每一种认知深度。';
        if (levels.length > 0) {
            html += '<br>你使用过：' + levels.join('、') + '。';
        }
        html += '</p></div>';

        // 探索的核心概念
        if (keywords.length > 0) {
            html += '<div class="skillup-retro-section">' +
                '<h3 class="skillup-retro-section-title">📊 你关注的核心概念</h3>' +
                '<p class="skillup-retro-text">' + keywords.slice(0, 10).join('、') + '</p>' +
                '</div>';
        }

        // 慧惠的话
        html += '<div class="skillup-retro-section">' +
            '<h3 class="skillup-retro-section-title">💬 慧惠的话</h3>' +
            '<p class="skillup-retro-text skillup-retro-gratitude">' +
            '谢谢你陪我走过这一段路。<br><br>' +
            '老子说："信言不美，美言不信。"<br>' +
            '你读完了最后一章，但这不是结束。<br><br>' +
            '老子的智慧像水——它已经流进了你的生活，' +
            '会在你不知道的时候，悄悄冒出来。<br><br>' +
            '今天，你想从哪一章重新开始？' +
            '</p></div>';

        html += '</div>'; // body

        // 底部
        html += '<div class="skillup-retro-footer">' +
            '<button class="skillup-retro-close-btn" onclick="document.getElementById(\'skillup-retrospective-overlay\').remove()">关闭</button>' +
            '</div>';

        html += '</div>'; // content

        return html;
    }

    // 暴露回顾旅程方法到全局
    window.SkillUPUI = window.SkillUPUI || {};
    window.SkillUPUI.showRetrospective = function () {
        if (!window.SkillUP) return;
        var summary = window.SkillUP.getGrowthSummary();
        showRetrospective(summary);
    };

    // ===== 章节页面底部引导（§4.2） =====
    function injectChapterGuidance() {
        if (!SkillUP.isTrackingEnabled()) return;

        var attemptCount = 0;
        var injectTimer = setInterval(function () {
            attemptCount++;

            var target = findGuidanceTarget();
            if (target) {
                clearInterval(injectTimer);
                renderGuidance(target);
                return;
            }

            if (attemptCount >= 20) {
                clearInterval(injectTimer);
                console.log('[SkillUP-UI] 未找到章节引导注入位置');
            }
        }, 300);
    }

    function findGuidanceTarget() {
        var selectors = [
            '.chapter-content',
            '.content-body',
            'article',
            '.page-content',
            'main',
            '#content',
            '.section-body',
            '.step-section'
        ];

        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el && el.textContent.trim().length > 200) {
                return el;
            }
        }

        var footer = document.querySelector('.site-footer');
        if (footer && footer.parentNode) {
            return footer.parentNode;
        }

        return null;
    }

    function renderGuidance(target) {
        if (document.getElementById('skillup-chapter-guidance')) return;

        var guidance = SkillUP.getChapterGuidance();
        if (!guidance) return;

        var el = document.createElement('div');
        el.id = 'skillup-chapter-guidance';
        el.className = 'skillup-chapter-guidance';
        el.innerHTML =
            '<div class="skillup-guidance-inner">' +
            '<span class="skillup-guidance-icon">' + guidance.icon + '</span>' +
            '<div class="skillup-guidance-text">' +
            '<p class="skillup-guidance-message">' + guidance.message + '</p>' +
            '<p class="skillup-guidance-meta">当前阶段：「' + guidance.stage + '」 · 已读 ' + guidance.totalChaptersRead + ' 章</p>' +
            '</div>' +
            '</div>';

        var footer = document.querySelector('.site-footer');
        if (footer && footer.parentNode === target) {
            target.insertBefore(el, footer);
        } else {
            target.appendChild(el);
        }
        console.log('[SkillUP-UI] 章节引导已注入');
    }

    // ===== 「回顾旅程」按钮事件委托 =====
    document.addEventListener('click', function (e) {
        var btn = e.target;
        // 支持按钮本身点击或按钮内子元素点击
        if (btn && (btn.id === 'skillup-retrospective-btn' || btn.closest('#skillup-retrospective-btn'))) {
            e.stopPropagation();
            if (!window.SkillUP) return;
            var summary = window.SkillUP.getGrowthSummary();
            showRetrospective(summary);
        }
    }, true);

    // ===== 辅助函数 =====
    function refreshCard() {
        var oldCard = document.getElementById('skillup-growth-card');
        if (oldCard) {
            oldCard.parentNode.removeChild(oldCard);
        }
        injectGrowthCard();
    }

    console.log('[SkillUP-UI] UI 组件 v3.0 已就绪');
})();
