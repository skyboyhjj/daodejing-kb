/* ============================================
   亲子元数据审核控制台 · admin/family-review.js
   功能：列表筛选 / 详情展示 / 安全审核 / 状态机操作 / 历史时间线
        结构化修订面板 / 自定义模态框 / Diff 对比视图
   依赖：server.js 提供的 /admin/api/metadata/* 端点（管理端）
   版本：v2.0 — 审核工作流优化
   ============================================ */

(function () {
    'use strict';

    // ═══ 状态 ═══
    var state = {
        chapters: [],
        currentChapter: null,
        currentFilter: 'all',
        searchQuery: '',
        token: sessionStorage.getItem('admin_token') || '',
        revisions: {},           // 结构化修订意见 { core_idea: {...}, safety_notes: {...}, ... }
        aiMode: false,           // AI 修改模式
        stagingChapters: [],     // 暂存区章节列表（来自 API _items）
        currentStagingChapter: null,  // 当前查看的暂存章节完整数据
        stagingData: null        // 暂存区统计（{ total, chapters[], _items[] }）
    };

    // ═══ DOM 引用 ═══
    var $ = function (id) { return document.getElementById(id); };
    var chapterList = $('chapterList');
    var mainContent = $('mainContent');
    var searchInput = $('searchInput');
    var toastEl = $('toast');
    var modalContainer = $('modalContainer');

    // ═══ 工具函数 ═══
    function fmtDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            return d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0') + ' ' +
                String(d.getHours()).padStart(2, '0') + ':' +
                String(d.getMinutes()).padStart(2, '0');
        } catch (e) {
            return iso.substring(0, 16);
        }
    }

    function fmtDateShort(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            return d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
        } catch (e) {
            return iso.substring(0, 10);
        }
    }

    function http(method, path, body) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            var url = path;
            xhr.open(method, url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (state.token) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + state.token);
            }
            xhr.onload = function () {
                try {
                    var data = JSON.parse(xhr.responseText);
                    resolve({ status: xhr.status, data: data });
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            };
            xhr.onerror = function () { reject(new Error('Network error')); };
            xhr.send(body ? JSON.stringify(body) : null);
        });
    }

    function toast(msg, type) {
        type = type || 'info';
        toastEl.textContent = msg;
        toastEl.className = 'toast toast-' + type + ' show';
        clearTimeout(toastEl._timer);
        toastEl._timer = setTimeout(function () {
            toastEl.className = 'toast';
        }, 2500);
    }

    function statusLabel(s) {
        var map = { pending: '待审核', reviewing: '审核中', approved: '已通过', revision_needed: '需修改' };
        return map[s] || s;
    }

    function escHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ═══ API 调用 ═══
    function loadStats() {
        http('GET', '/admin/api/metadata/stats').then(function (r) {
            if (r.status === 200) {
                $('stPending').textContent = r.data.pending;
                $('stReviewing').textContent = r.data.reviewing;
                $('stApproved').textContent = r.data.approved;
                $('stRevision').textContent = r.data.revision_needed;
            }
        }).catch(function () { /* silent */ });
    }

    function loadAllChapters() {
        http('GET', '/api/metadata?limit=100').then(function (r) {
            if (r.status === 200) {
                state.chapters = r.data.chapters;
                renderChapterList();
                // 恢复上次选中的章节
                var saved = sessionStorage.getItem('admin_selected_chapter');
                if (saved) {
                    var ch = state.chapters.filter(function (c) { return String(c.chapter) === saved; })[0];
                    if (ch) selectChapter(ch);
                }
            }
        }).catch(function () {
            chapterList.innerHTML = '<div class="empty-state" style="height:200px;font-size:0.9em;">加载失败，请刷新重试</div>';
        });
    }

    function loadChapterDetail(chapterNum) {
        http('GET', '/api/metadata?chapter=' + chapterNum).then(function (r) {
            if (r.status === 200) {
                state.currentChapter = r.data;
                state.revisions = {}; // 重置修订意见
                renderDetail(r.data);
                sessionStorage.setItem('admin_selected_chapter', String(chapterNum));
            }
        }).catch(function () {
            toast('加载章节详情失败', 'error');
        });
    }

    function loadStagingList() {
        http('GET', '/admin/api/metadata/staging').then(function (r) {
            if (r.status === 200) {
                state.stagingData = r.data;
                state.stagingChapters = r.data._items || [];
                if (state.aiMode) renderChapterList();
            }
        }).catch(function () { /* silent */ });
    }

    function loadStagingDetail(chapterNum) {
        http('GET', '/admin/api/metadata/staging?chapter=' + chapterNum).then(function (r) {
            if (r.status === 200) {
                state.currentStagingChapter = r.data;
                renderAIStagingDetail(r.data);
            } else {
                toast('暂存区中无此章节', 'error');
            }
        }).catch(function () {
            toast('加载 AI 修订详情失败', 'error');
        });
    }

    function removeStagingChapter(chapterNum) {
        setButtonsDisabled(true);
        http('DELETE', '/admin/api/metadata/staging?chapter=' + chapterNum).then(function (r) {
            if (r.status === 200 && r.data.ok) {
                toast('已删除第 ' + chapterNum + ' 章 AI 修订', 'success');
                state.currentStagingChapter = null;
                state.stagingChapters = [];
                loadStagingList();
                mainContent.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1f4d6;</div><div>暂存区无待处理修订</div></div>';
            } else {
                toast((r.data && r.data.error) || '删除失败', 'error');
                setButtonsDisabled(false);
            }
        }).catch(function () {
            toast('网络错误', 'error');
            setButtonsDisabled(false);
        });
    }

    // ═══ 渲染 ═══
    function renderChapterList() {
        // AI 修改模式：显示暂存区章节列表
        if (state.aiMode) {
            var items = state.stagingChapters;
            if (state.searchQuery) {
                var query = state.searchQuery.toLowerCase();
                items = items.filter(function (it) {
                    return (it.title && it.title.indexOf(query) !== -1) ||
                        (it.core_idea_preview && it.core_idea_preview.indexOf(query) !== -1) ||
                        (String(it.chapter) === query);
                });
            }
            if (items.length === 0) {
                chapterList.innerHTML = '<div class="empty-state" style="height:150px;font-size:0.88em;">暂存区无待处理修订</div>';
                return;
            }
            var aiHtml = '';
            items.forEach(function (it) {
                var isActive = state.currentStagingChapter && state.currentStagingChapter.chapter === it.chapter;
                aiHtml += '<div class="chapter-item' + (isActive ? ' active' : '') + '" data-chapter="' + it.chapter + '" data-mode="ai">';
                aiHtml += '<span class="chapter-num">' + it.chapter + '</span>';
                aiHtml += '<div class="chapter-info">';
                aiHtml += '<div class="chapter-title-text">' + escHtml(it.title) + '</div>';
                aiHtml += '<div class="chapter-core">' + escHtml((it.core_idea_preview || '').substring(0, 40)) + '</div>';
                aiHtml += '</div>';
                aiHtml += '<span class="staging-status">AI 修订</span>';
                aiHtml += '</div>';
            });
            chapterList.innerHTML = aiHtml;
            return;
        }

        // 普通模式
        var filtered = state.chapters;
        if (state.currentFilter !== 'all') {
            filtered = filtered.filter(function (c) {
                return c.review_status === state.currentFilter;
            });
        }
        if (state.searchQuery) {
            var q = state.searchQuery.toLowerCase();
            filtered = filtered.filter(function (c) {
                return (c.title && c.title.indexOf(q) !== -1) ||
                    (c.core_idea && c.core_idea.indexOf(q) !== -1) ||
                    (String(c.chapter) === q);
            });
        }

        if (filtered.length === 0) {
            chapterList.innerHTML = '<div class="empty-state" style="height:150px;font-size:0.88em;">无匹配章节</div>';
            return;
        }

        var html = '';
        filtered.forEach(function (ch) {
            var isActive = state.currentChapter && state.currentChapter.chapter === ch.chapter;
            html += '<div class="chapter-item' + (isActive ? ' active' : '') + '" data-chapter="' + ch.chapter + '">';
            html += '<span class="chapter-num">' + ch.chapter + '</span>';
            html += '<div class="chapter-info">';
            html += '<div class="chapter-title-text">' + escHtml(ch.title) + '</div>';
            html += '<div class="chapter-core">' + escHtml((ch.core_idea || '').substring(0, 40)) + '</div>';
            html += '</div>';
            html += '<span class="chapter-status status-' + ch.review_status + '">' + statusLabel(ch.review_status) + '</span>';
            html += '</div>';
        });
        chapterList.innerHTML = html;
    }

    // ═══ 详情渲染 ═══
    function renderDetail(meta) {
        var stLabel = statusLabel(meta.review_status);
        var stClass = 'status-' + meta.review_status;

        var html = '';

        // ── 操作按钮栏 ──
        html += '<div class="action-bar">';
        html += renderActionButtons(meta);
        html += '</div>';

        // ── 同步暂存区指示栏 ──
        html += '<div class="sync-bar" id="syncBar" style="display:none;">';
        html += '<span class="sync-icon">&#x1f504;</span>';
        html += '<span class="sync-status">检查中...</span>';
        html += '<button class="btn btn-sync" data-action="sync-chapter" style="display:none;">同步到生产</button>';
        html += '<button class="btn btn-sync-all" data-action="sync-all">同步全部</button>';
        html += '</div>';

        // ── 审核备注（通用文本，保留兼容） ──
        html += '<textarea class="notes-area" id="reviewNotes" placeholder="审核备注（可选，简要说明即可；详细修订意见请在下方修订面板中填写）"></textarea>';

        // ── 结构化修订面板（仅 reviewing 状态可编辑） ──
        html += '<div class="revision-panel" id="revisionPanel">';
        html += '<div class="revision-panel-header">';
        html += '<span>&#x1f4dd; 修订意见（按字段分类）</span>';
        html += '<button class="revision-toggle" id="revToggle">收起</button>';
        html += '</div>';
        html += '<div class="revision-panel-body" id="revBody">';
        html += renderRevisionFields(meta);
        html += '</div>';
        html += '</div>';

        // ── 基本信息卡片 ──
        html += '<div class="detail-card">';
        html += '<span class="chapter-badge ' + stClass + '">' + stLabel + '</span>';
        html += '<h2>第 ' + meta.chapter + ' 章 · ' + escHtml(meta.title) + '</h2>';

        html += '<div class="detail-label">核心思想</div>';
        html += '<div class="detail-text" id="detailCoreIdea">' + escHtml(meta.core_idea) + '</div>';

        html += '<div class="detail-label">给家长的提示</div>';
        html += '<div class="parent-tips-box" id="detailParentTips">' + escHtml(meta.parent_tips || '') + '</div>';

        html += '<div class="detail-label">安全注意事项</div>';
        (meta.safety_notes || []).forEach(function (note, i) {
            html += '<div class="safety-note-item" id="detailSafety_' + i + '">' + escHtml(note) + '</div>';
        });

        html += '<div class="detail-label">亲子互动点</div>';
        (meta.interaction_points || []).forEach(function (ip, i) {
            html += '<div class="interaction-point" id="detailIP_' + i + '">';
            html += '<div class="ip-topic">' + escHtml(ip.topic) + '</div>';
            if (ip.age_4_6) html += '<div class="ip-age"><span class="ip-age-label">4-6岁：</span>' + escHtml(ip.age_4_6) + '</div>';
            if (ip.age_7_9) html += '<div class="ip-age"><span class="ip-age-label">7-9岁：</span>' + escHtml(ip.age_7_9) + '</div>';
            if (ip.age_10_12) html += '<div class="ip-age"><span class="ip-age-label">10-12岁：</span>' + escHtml(ip.age_10_12) + '</div>';
            html += '</div>';
        });
        html += '</div>';

        // ── 安全审核检查表 ──
        html += '<div class="safety-checklist">';
        html += '<h3>&#x1f6e1; 亲子守护 · 安全审核检查表（Article 11）</h3>';
        SAFETY_CHECKLIST.forEach(function (item, idx) {
            html += '<label class="checklist-item" data-idx="' + idx + '">';
            html += '<input type="checkbox" id="sc_' + idx + '">';
            html += '<span>' + escHtml(item) + '</span>';
            html += '</label>';
        });
        html += '</div>';

        // ── Diff 对比视图（仅当有历史快照时显示入口） ──
        var hasSnapshot = hasComparableHistory(meta);
        if (hasSnapshot) {
            html += '<div class="diff-view-container" id="diffViewContainer">';
            html += '<button class="btn diff-toggle-btn" id="diffToggle">&#x1f50d; 查看内容变更对比</button>';
            html += '<div class="diff-view" id="diffView" style="display:none;"></div>';
            html += '</div>';
        }

        // ── 审核历史 ──
        html += '<div class="history-card">';
        html += '<h3>&#x1f4dd; 审核历史</h3>';
        var history = meta.review_history || [];
        if (history.length === 0) {
            html += '<div style="color:var(--review-text-light);font-size:0.88em;">暂无审核记录</div>';
        } else {
            html += renderHistoryTimeline(history);
        }
        html += '</div>';

        mainContent.innerHTML = html;

        // 绑定事件
        bindActionButtons(meta);
        bindRevisionPanel(meta);
        bindDiffView(meta);

        // 加载暂存区状态并绑定同步按钮
        loadStagingStatus(function (staging) {
            updateSyncButton(staging);
        });
        bindSyncBarButtons(meta);
    }

    // ═══ AI 修订详情渲染 ═══
    function renderAIStagingDetail(stagingData) {
        var html = '';

        // ── AI 操作按钮栏 ──
        html += '<div class="ai-action-bar">';
        html += '<button class="btn btn-success" id="btnAISync">&#x1f504; 同步到生产</button>';
        html += '<button class="btn btn-primary" id="btnAIReReview">&#x1f50d; 重新审核</button>';
        html += '<button class="btn btn-danger" id="btnAIDelete" style="margin-left:auto;">&#x1f5d1; 删除</button>';
        html += '</div>';

        // ── 暂存元信息 ──
        html += '<div class="staging-meta-box">';
        html += '<span><span class="meta-label">模型:</span> ' + escHtml(stagingData._staged_model || '') + '</span>';
        html += '<span><span class="meta-label">修订时间:</span> ' + fmtDate(stagingData._staged_at) + '</span>';
        html += '<span><span class="meta-label">原状态:</span> ' + statusLabel(stagingData._production_status) + '</span>';
        html += '</div>';

        // ── AI 详情卡片 ──
        html += '<div class="ai-detail-card">';
        html += '<span class="ai-badge">&#x1f916; AI 修订建议</span>';
        html += '<h2>第 ' + stagingData.chapter + ' 章 · ' + escHtml(stagingData.title) + '</h2>';

        html += '<div class="detail-label">核心思想</div>';
        html += '<div class="detail-text">' + escHtml(stagingData.core_idea) + '</div>';

        html += '<div class="detail-label">给家长的提示</div>';
        html += '<div class="parent-tips-box">' + escHtml(stagingData.parent_tips || '') + '</div>';

        html += '<div class="detail-label">安全注意事项</div>';
        (stagingData.safety_notes || []).forEach(function (note) {
            html += '<div class="safety-note-item">' + escHtml(note) + '</div>';
        });

        html += '<div class="detail-label">亲子互动点</div>';
        (stagingData.interaction_points || []).forEach(function (ip) {
            html += '<div class="interaction-point">';
            html += '<div class="ip-topic">' + escHtml(ip.topic) + '</div>';
            if (ip.age_4_6) html += '<div class="ip-age"><span class="ip-age-label">4-6岁：</span>' + escHtml(ip.age_4_6) + '</div>';
            if (ip.age_7_9) html += '<div class="ip-age"><span class="ip-age-label">7-9岁：</span>' + escHtml(ip.age_7_9) + '</div>';
            if (ip.age_10_12) html += '<div class="ip-age"><span class="ip-age-label">10-12岁：</span>' + escHtml(ip.age_10_12) + '</div>';
            html += '</div>';
        });
        html += '</div>';

        mainContent.innerHTML = html;

        // 绑定 AI 操作按钮事件
        bindAIActionButtons(stagingData);
    }

    function bindAIActionButtons(stagingData) {
        var syncBtn = $('btnAISync');
        var reReviewBtn = $('btnAIReReview');
        var deleteBtn = $('btnAIDelete');

        if (syncBtn) {
            syncBtn.addEventListener('click', function () {
                syncChapterToProduction(stagingData.chapter);
            });
        }
        if (reReviewBtn) {
            reReviewBtn.addEventListener('click', function () {
                showConfirmModal({
                    title: '重新审核',
                    message: '将第 ' + stagingData.chapter + ' 章状态重置为"审核中"，并删除此 AI 修订记录？',
                    confirmLabel: '确认',
                    onConfirm: function () {
                        setButtonsDisabled(true);
                        http('PUT', '/admin/api/metadata', {
                            chapter: stagingData.chapter,
                            updates: { review_status: 'reviewing' }
                        }).then(function (r) {
                            if (r.status === 200 && r.data.ok) {
                                toast('第 ' + stagingData.chapter + ' 章已重置为审核中', 'success');
                                removeStagingChapter(stagingData.chapter);
                                loadStats();
                                loadAllChapters();
                            } else {
                                toast((r.data && r.data.error) || '操作失败', 'error');
                                setButtonsDisabled(false);
                            }
                        }).catch(function () {
                            toast('网络错误', 'error');
                            setButtonsDisabled(false);
                        });
                    }
                });
            });
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () {
                showConfirmModal({
                    title: '确认删除',
                    message: '确认删除第 ' + stagingData.chapter + ' 章的 AI 修订记录？\n\n此操作仅删除暂存区中的 AI 修订建议，不影响生产数据。',
                    danger: true,
                    onConfirm: function () {
                        removeStagingChapter(stagingData.chapter);
                    }
                });
            });
        }
    }

    function hasComparableHistory(meta) {
        var history = meta.review_history || [];
        for (var i = 0; i < history.length; i++) {
            if (history[i].content_snapshot) return true;
        }
        return false;
    }

    // ═══ 结构化修订面板 ═══
    function renderRevisionFields(meta) {
        var rev = state.revisions;
        // 修订面板在 reviewing 和 revision_needed 状态下可编辑
        var isEditable = meta.review_status === 'reviewing' || meta.review_status === 'revision_needed';
        var disabledAttr = isEditable ? '' : ' disabled';

        var fields = [
            {
                key: 'core_idea',
                label: '核心思想',
                placeholder: '描述核心思想需要修改的问题...',
                directionPlaceholder: '建议的修改方向...'
            },
            {
                key: 'safety_notes',
                label: '安全注意事项',
                placeholder: '描述缺少的场景或需要调整的安全提示...',
                directionPlaceholder: '建议添加的安全提示...'
            },
            {
                key: 'interaction_points',
                label: '亲子互动点',
                placeholder: '描述需要调整的互动话题...',
                directionPlaceholder: '建议的互动方向...'
            },
            {
                key: 'parent_tips',
                label: '家长提示',
                placeholder: '描述家长提示需要优化的地方...',
                directionPlaceholder: ''
            }
        ];

        var html = '';
        fields.forEach(function (f) {
            var fd = rev[f.key] || {};
            var needsChange = fd.needs_change || false;
            html += '<div class="revision-section">';
            html += '<label class="revision-check">';
            html += '<input type="checkbox" class="rev-needs-change" data-field="' + f.key + '"' +
                (needsChange ? ' checked' : '') + disabledAttr + '>';
            html += '<span class="revision-field-label">' + f.label + '需要修改</span>';
            html += '</label>';
            html += '<div class="revision-detail" data-field="' + f.key + '"' + (needsChange ? '' : ' style="display:none;"') + '>';
            html += '<input type="text" class="rev-problem" data-field="' + f.key +
                '" placeholder="' + f.placeholder + '" value="' + escHtml(fd.problem || '') + '"' + disabledAttr + '>';
            if (f.directionPlaceholder) {
                html += '<input type="text" class="rev-direction" data-field="' + f.key +
                    '" placeholder="' + f.directionPlaceholder + '" value="' + escHtml(fd.direction || '') + '"' + disabledAttr + '>';
            }
            html += '</div>';
            html += '</div>';
        });

        // 通用备注
        var generalNotes = (rev.general && rev.general.notes) ? rev.general.notes : '';
        html += '<div class="revision-section">';
        html += '<label class="revision-field-label" style="display:block;margin-bottom:4px;">其他 / 通用备注</label>';
        html += '<textarea class="rev-general-notes" data-field="general" placeholder="任何其他需要说明的修订意见..."' +
            disabledAttr + '>' + escHtml(generalNotes) + '</textarea>';
        html += '</div>';

        return html;
    }

    function bindRevisionPanel(meta) {
        var toggle = $('revToggle');
        var body = $('revBody');
        if (toggle && body) {
            toggle.addEventListener('click', function () {
                var collapsed = body.style.display === 'none';
                body.style.display = collapsed ? '' : 'none';
                toggle.textContent = collapsed ? '收起' : '展开';
            });
        }

        // 勾选联动
        var checkboxes = mainContent.querySelectorAll('.rev-needs-change');
        checkboxes.forEach(function (cb) {
            cb.addEventListener('change', function () {
                var field = cb.getAttribute('data-field');
                var detail = mainContent.querySelector('.revision-detail[data-field="' + field + '"]');
                if (detail) {
                    detail.style.display = cb.checked ? '' : 'none';
                }
                saveRevisionsState();
            });
        });

        // 文本输入变更自动保存到 state
        var inputs = mainContent.querySelectorAll('.rev-problem, .rev-direction, .rev-general-notes');
        inputs.forEach(function (inp) {
            inp.addEventListener('input', function () {
                saveRevisionsState();
            });
        });

        // revision_needed 状态下回显上次的修订意见
        if (meta.review_status === 'revision_needed') {
            loadLastRevisions(meta);
        }
    }

    function saveRevisionsState() {
        var rev = {};
        var fields = ['core_idea', 'safety_notes', 'interaction_points', 'parent_tips'];
        fields.forEach(function (f) {
            var cb = mainContent.querySelector('.rev-needs-change[data-field="' + f + '"]');
            var problemEl = mainContent.querySelector('.rev-problem[data-field="' + f + '"]');
            var directionEl = mainContent.querySelector('.rev-direction[data-field="' + f + '"]');
            rev[f] = {
                needs_change: cb ? cb.checked : false,
                problem: problemEl ? problemEl.value.trim() : '',
                direction: directionEl ? directionEl.value.trim() : ''
            };
        });
        var generalEl = mainContent.querySelector('.rev-general-notes');
        rev.general = { notes: generalEl ? generalEl.value.trim() : '' };
        state.revisions = rev;
    }

    function loadLastRevisions(meta) {
        var history = meta.review_history || [];
        // 找到最近一次 revision_needed 且有 revisions 数据的条目
        for (var i = history.length - 1; i >= 0; i--) {
            if (history[i].action === 'revision_needed' && history[i].revisions) {
                state.revisions = history[i].revisions;
                break;
            }
        }
        // 重新渲染面板以回显数据
        var body = $('revBody');
        if (body) {
            body.innerHTML = renderRevisionFields(meta);
            bindRevisionPanelInputs(meta);
        }
    }

    function bindRevisionPanelInputs(meta) {
        var checkboxes = mainContent.querySelectorAll('.rev-needs-change');
        checkboxes.forEach(function (cb) {
            cb.addEventListener('change', function () {
                var field = cb.getAttribute('data-field');
                var detail = mainContent.querySelector('.revision-detail[data-field="' + field + '"]');
                if (detail) detail.style.display = cb.checked ? '' : 'none';
                saveRevisionsState();
            });
        });
        var inputs = mainContent.querySelectorAll('.rev-problem, .rev-direction, .rev-general-notes');
        inputs.forEach(function (inp) {
            inp.addEventListener('input', function () { saveRevisionsState(); });
        });
    }

    function collectRevisions() {
        saveRevisionsState();
        // 检查是否有实际修订内容
        var rev = state.revisions;
        var hasContent = false;
        var fields = ['core_idea', 'safety_notes', 'interaction_points', 'parent_tips'];
        for (var i = 0; i < fields.length; i++) {
            var f = rev[fields[i]];
            if (f && f.needs_change && (f.problem || f.direction)) {
                hasContent = true;
                break;
            }
        }
        if (!hasContent && rev.general && rev.general.notes) {
            hasContent = true;
        }
        return hasContent ? rev : null;
    }

    // ═══ Diff 对比视图 ═══
    function bindDiffView(meta) {
        var toggleBtn = $('diffToggle');
        var diffView = $('diffView');
        if (!toggleBtn || !diffView) return;

        toggleBtn.addEventListener('click', function () {
            if (diffView.style.display === 'none') {
                diffView.innerHTML = renderDiffView(meta);
                diffView.style.display = '';
                toggleBtn.textContent = '收起对比';
            } else {
                diffView.style.display = 'none';
                toggleBtn.textContent = '\uD83D\uDD0D 查看内容变更对比';
            }
        });
    }

    function renderDiffView(meta) {
        var history = meta.review_history || [];
        // 找最近的 snapshot（revision_needed 时的快照）
        var snapshot = null;
        for (var i = history.length - 1; i >= 0; i--) {
            if (history[i].content_snapshot) {
                snapshot = history[i].content_snapshot;
                break;
            }
        }
        if (!snapshot) return '<div class="diff-empty">暂无历史快照可对比</div>';

        var html = '';
        html += '<div class="diff-header">';
        html += '<span>\u25C0 修订前快照</span>';
        html += '<span>修订后（当前）\u25B6</span>';
        html += '</div>';

        // core_idea diff
        var ideaDiff = computeTextDiff(snapshot.core_idea || '', meta.core_idea || '');
        html += '<div class="diff-section">';
        html += '<div class="diff-section-title">核心思想</div>';
        html += '<div class="diff-content">' + ideaDiff + '</div>';
        html += '</div>';

        // safety_notes diff
        var safetyDiff = computeArrayDiff(snapshot.safety_notes || [], meta.safety_notes || []);
        html += '<div class="diff-section">';
        html += '<div class="diff-section-title">安全注意事项（修订前 ' + (snapshot.safety_notes || []).length + ' 条 → 修订后 ' + (meta.safety_notes || []).length + ' 条）</div>';
        html += '<div class="diff-content">' + safetyDiff + '</div>';
        html += '</div>';

        // interaction_points diff
        var ipDiff = computeIPDiff(snapshot.interaction_points || [], meta.interaction_points || []);
        html += '<div class="diff-section">';
        html += '<div class="diff-section-title">亲子互动点</div>';
        html += '<div class="diff-content">' + ipDiff + '</div>';
        html += '</div>';

        // parent_tips diff
        var tipsDiff = computeTextDiff(snapshot.parent_tips || '', meta.parent_tips || '');
        html += '<div class="diff-section">';
        html += '<div class="diff-section-title">家长提示</div>';
        html += '<div class="diff-content">' + tipsDiff + '</div>';
        html += '</div>';

        return html;
    }

    function computeTextDiff(oldText, newText) {
        if (oldText === newText) return '<div class="diff-unchanged">（无变更）</div>';

        // 按中文句号拆分句子
        var oldSentences = splitSentences(oldText);
        var newSentences = splitSentences(newText);

        var html = '';
        var oi = 0, ni = 0;

        // 简单的逐句 LCS 匹配
        while (oi < oldSentences.length || ni < newSentences.length) {
            if (oi >= oldSentences.length) {
                // 剩余的都是新增
                while (ni < newSentences.length) {
                    html += '<span class="diff-added">' + escHtml(newSentences[ni]) + '</span>';
                    ni++;
                }
                break;
            }
            if (ni >= newSentences.length) {
                // 剩余的都是删除
                while (oi < oldSentences.length) {
                    html += '<span class="diff-removed">' + escHtml(oldSentences[oi]) + '</span>';
                    oi++;
                }
                break;
            }

            // 查找匹配
            var matchIdx = -1;
            for (var k = ni; k < Math.min(ni + 5, newSentences.length); k++) {
                if (similarity(oldSentences[oi], newSentences[k]) > 0.6) {
                    matchIdx = k;
                    break;
                }
            }

            if (matchIdx === ni) {
                // 相同
                html += '<span class="diff-unchanged">' + escHtml(oldSentences[oi]) + '</span>';
                oi++;
                ni++;
            } else if (matchIdx > ni) {
                // 中间有新增
                while (ni < matchIdx) {
                    html += '<span class="diff-added">' + escHtml(newSentences[ni]) + '</span>';
                    ni++;
                }
            } else {
                // 删除
                html += '<span class="diff-removed">' + escHtml(oldSentences[oi]) + '</span>';
                oi++;
            }
        }
        return html;
    }

    function splitSentences(text) {
        if (!text) return [];
        var raw = text.split(/(?<=[。！？；])/);
        var result = [];
        for (var i = 0; i < raw.length; i++) {
            var s = raw[i].trim();
            if (s) result.push(s);
        }
        return result;
    }

    function similarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        var len = Math.max(a.length, b.length);
        if (len === 0) return 1;
        var dist = levenshtein(a, b);
        return 1 - dist / len;
    }

    function levenshtein(a, b) {
        var m = a.length, n = b.length;
        var d = [];
        for (var i = 0; i <= m; i++) {
            d[i] = [i];
        }
        for (var j = 0; j <= n; j++) {
            d[0][j] = j;
        }
        for (var i = 1; i <= m; i++) {
            for (var j = 1; j <= n; j++) {
                var cost = a[i - 1] === b[j - 1] ? 0 : 1;
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            }
        }
        return d[m][n];
    }

    function computeArrayDiff(oldArr, newArr) {
        if (oldArr.length === 0 && newArr.length === 0) return '<div class="diff-unchanged">（无变更）</div>';

        var html = '';
        var matched = {};
        var newMatched = {};

        // 匹配相似条目
        for (var oi = 0; oi < oldArr.length; oi++) {
            for (var ni = 0; ni < newArr.length; ni++) {
                if (newMatched[ni]) continue;
                if (oldArr[oi] === newArr[ni]) {
                    matched[oi] = ni;
                    newMatched[ni] = true;
                    break;
                }
                if (similarity(oldArr[oi], newArr[ni]) > 0.65) {
                    matched[oi] = ni;
                    newMatched[ni] = true;
                    break;
                }
            }
        }

        // 渲染
        var ni = 0;
        for (var oi = 0; oi < oldArr.length; oi++) {
            if (matched[oi] !== undefined) {
                // 在匹配项之前的 new 条目是新增
                while (ni < matched[oi]) {
                    html += '<div class="diff-added">+ ' + escHtml(newArr[ni]) + '</div>';
                    ni++;
                }
                // 检查是否完全相同
                if (oldArr[oi] === newArr[matched[oi]]) {
                    html += '<div class="diff-unchanged">  ' + escHtml(oldArr[oi]) + '</div>';
                } else {
                    html += '<div class="diff-modified">~ ' + escHtml(newArr[matched[oi]]) + '</div>';
                }
                ni = matched[oi] + 1;
            } else {
                html += '<div class="diff-removed">- ' + escHtml(oldArr[oi]) + '</div>';
            }
        }
        // 剩余新增
        while (ni < newArr.length) {
            html += '<div class="diff-added">+ ' + escHtml(newArr[ni]) + '</div>';
            ni++;
        }
        return html || '<div class="diff-unchanged">（无变更）</div>';
    }

    function computeIPDiff(oldIPs, newIPs) {
        if (oldIPs.length === 0 && newIPs.length === 0) return '<div class="diff-unchanged">（无变更）</div>';

        var html = '';
        var oldByTopic = {};
        var newByTopic = {};

        oldIPs.forEach(function (ip) { oldByTopic[ip.topic] = ip; });
        newIPs.forEach(function (ip) { newByTopic[ip.topic] = ip; });

        var allTopics = {};
        Object.keys(oldByTopic).forEach(function (t) { allTopics[t] = true; });
        Object.keys(newByTopic).forEach(function (t) { allTopics[t] = true; });

        Object.keys(allTopics).forEach(function (topic) {
            var oldIp = oldByTopic[topic];
            var newIp = newByTopic[topic];
            if (!oldIp) {
                html += '<div class="diff-added">+ <b>' + escHtml(topic) + '</b>（新增互动点）</div>';
            } else if (!newIp) {
                html += '<div class="diff-removed">- <b>' + escHtml(topic) + '</b>（已删除）</div>';
            } else {
                html += '<div class="diff-unchanged">  <b>' + escHtml(topic) + '</b></div>';
            }
        });
        return html || '<div class="diff-unchanged">（无变更）</div>';
    }

    // ═══ 审核历史时间线（增强版） ═══
    function renderHistoryTimeline(history) {
        var html = '<ul class="timeline">';
        var reversed = history.slice().reverse();
        reversed.forEach(function (h) {
            html += '<li>';
            html += '<div class="tl-action">' + actionLabel(h.action) + '</div>';
            html += '<div class="tl-meta">' + escHtml(h.by) + ' · ' + fmtDate(h.at) + '</div>';
            if (h.notes) html += '<div class="tl-notes">' + escHtml(h.notes) + '</div>';

            // 结构化修订意见展开
            if (h.action === 'revision_needed' && h.revisions) {
                html += '<button class="tl-expand-btn" onclick="this.nextElementSibling.style.display=' +
                    "(this.nextElementSibling.style.display==='none'?'':'none')" + '">展开修订意见</button>';
                html += '<div class="tl-revisions-detail" style="display:none;">';
                html += renderRevisionDetail(h.revisions);
                html += '</div>';
            }

            // 内容快照入口
            if (h.content_snapshot) {
                html += '<button class="tl-snapshot-btn" onclick="this.nextElementSibling.style.display=' +
                    "(this.nextElementSibling.style.display==='none'?'':'none')" + '">查看快照</button>';
                html += '<div class="tl-snapshot-detail" style="display:none;">';
                html += '<div class="snapshot-mini">';
                html += '<div><b>核心思想：</b>' + escHtml((h.content_snapshot.core_idea || '').substring(0, 100)) + '…</div>';
                html += '<div><b>安全事项：</b>' + (h.content_snapshot.safety_notes || []).length + ' 条</div>';
                html += '<div><b>互动点：</b>' + (h.content_snapshot.interaction_points || []).length + ' 个</div>';
                html += '</div>';
                html += '</div>';
            }

            html += '</li>';
        });
        html += '</ul>';
        return html;
    }

    function renderRevisionDetail(revisions) {
        var html = '';
        var fields = [
            { key: 'core_idea', label: '核心思想' },
            { key: 'safety_notes', label: '安全注意事项' },
            { key: 'interaction_points', label: '亲子互动点' },
            { key: 'parent_tips', label: '家长提示' }
        ];
        fields.forEach(function (f) {
            var d = revisions[f.key];
            if (d && d.needs_change) {
                html += '<div class="rev-detail-item">';
                html += '<b>' + f.label + '：</b>';
                if (d.problem) html += '<div>问题：' + escHtml(d.problem) + '</div>';
                if (d.direction) html += '<div>方向：' + escHtml(d.direction) + '</div>';
                html += '</div>';
            }
        });
        if (revisions.general && revisions.general.notes) {
            html += '<div class="rev-detail-item"><b>通用备注：</b>' + escHtml(revisions.general.notes) + '</div>';
        }
        return html || '<div class="rev-detail-item">（无详细修订意见）</div>';
    }

    function actionLabel(action) {
        var map = {
            created: '创建（AI 生成）',
            reviewing: '开始审核',
            approved: '审核通过',
            revision_needed: '需要修改',
            revision_submitted: '提交修订',
            deleted: '删除',
            updated: '内容更新'
        };
        return map[action] || action;
    }

    // ═══ 安全审核检查表（Article 11，11项） ═══
    var SAFETY_CHECKLIST = [
        '无死亡/灾难/暴力相关内容',
        '无成人主题或不适宜儿童的内容',
        '无成瘾性设计或诱导性语言',
        '语言难度匹配目标年龄段（4-12岁）',
        '无负面引导（不鼓励攀比、撒谎、自私等）',
        '无身体焦虑（不涉及身材/容貌评价）',
        '无道德绑架或评判式语言',
        '语气温暖、尊重儿童主体性',
        '无道德误读风险（不将\u201c无为\u201d\u201c返璞归真\u201d等概念与不守规则、不讲礼貌等不良行为相关联）',
        '不对孩子行为做道德评判（保持客观描述，不将行为定性为\u201c好\u201d或\u201c坏\u201d）',
        '不良行为有正确的回应策略（平常心回应情绪，不借机说教或美化）'
    ];

    // ═══ 操作按钮 ═══
    function renderActionButtons(meta) {
        var s = meta.review_status;
        var html = '';

        if (!state.token) {
            html += '<div style="flex:1;color:var(--review-text-light);font-size:0.85em;">';
            html += '&#x1f512; 请先输入管理员 Token：';
            html += '<input type="password" id="tokenInput" placeholder="输入 ADMIN_TOKEN" ';
            html += 'style="margin-left:8px;padding:5px 10px;border:1px solid var(--review-border);border-radius:var(--review-radius-sm);font-size:0.85em;width:200px;">';
            html += '<button class="btn btn-primary" id="saveTokenBtn" style="margin-left:6px;">确认</button>';
            html += '</div>';
            return html;
        }

        if (s === 'pending') {
            html += '<button class="btn btn-primary" data-action="reviewing">&#x1f50d; 开始审核</button>';
        } else if (s === 'reviewing') {
            html += '<button class="btn btn-success" data-action="approved">&#x2705; 审核通过</button>';
            html += '<button class="btn btn-warning" data-action="revision_needed">&#x1f4dd; 需要修改</button>';
            html += '<button class="btn" data-action="pending" style="color:var(--review-text-light);">&#x21a9; 退回待审</button>';
        } else if (s === 'approved') {
            html += '<button class="btn btn-warning" data-action="revision_needed">&#x1f504; 改为需修改</button>';
        } else if (s === 'revision_needed') {
            html += '<button class="btn btn-primary" data-action="reviewing">&#x1f50d; 重新审核</button>';
        }

        if (s !== 'approved') {
            html += '<button class="btn btn-danger" data-action="delete" style="margin-left:auto;">&#x1f5d1; 删除</button>';
        }

        return html;
    }

    function bindActionButtons(meta) {
        var saveTokenBtn = $('saveTokenBtn');
        if (saveTokenBtn) {
            saveTokenBtn.addEventListener('click', function () {
                var val = $('tokenInput').value.trim();
                if (val) {
                    state.token = val;
                    sessionStorage.setItem('admin_token', val);
                    toast('Token 已保存', 'success');
                    loadChapterDetail(meta.chapter);
                }
            });
            var tokenInput = $('tokenInput');
            if (tokenInput) {
                tokenInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') saveTokenBtn.click();
                });
            }
        }

        var buttons = mainContent.querySelectorAll('[data-action]');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');

                // 删除使用原生确认（破坏性操作）
                if (action === 'delete') {
                    showConfirmModal({
                        title: '确认删除',
                        message: '确认删除第 ' + meta.chapter + ' 章「' + meta.title + '」？此操作不可撤销。',
                        danger: true,
                        onConfirm: function () { performAction(meta.chapter, action); }
                    });
                    return;
                }

                // approved → revision_needed 双重确认
                if (action === 'revision_needed' && meta.review_status === 'approved') {
                    showConfirmModal({
                        title: '谨慎操作',
                        message: '该章节已通过审核并可能已上线使用。\n\n确认将其退回"需修改"状态？此操作会从生产环境撤回该章节。',
                        confirmLabel: '继续',
                        onConfirm: function () {
                            showConfirmModal({
                                title: '再次确认',
                                message: '请再次确认：将第 ' + meta.chapter + ' 章「' + meta.title + '」从"已通过"改为"需修改"？',
                                confirmLabel: '确认修改',
                                danger: true,
                                onConfirm: function () { performAction(meta.chapter, action); }
                            });
                        }
                    });
                    return;
                }

                // 安全检查表未全部通过确认（仅 approved 操作）
                if (action === 'approved') {
                    var unchecks = getUncheckedItems();
                    if (unchecks.length > 0) {
                        showSafetyCheckWarning(unchecks, function () {
                            performAction(meta.chapter, action);
                        });
                        return;
                    }
                }

                // 普通状态转换：显示确认模态框
                if (action !== 'delete') {
                    var confirmMsg = buildConfirmMessage(meta, action);
                    showConfirmModal({
                        title: '确认操作',
                        message: confirmMsg,
                        confirmLabel: action === 'approved' ? '确认通过' :
                            (action === 'revision_needed' ? '确认修改' : '确认'),
                        danger: false,
                        onConfirm: function () { performAction(meta.chapter, action); }
                    });
                    return;
                }

                performAction(meta.chapter, action);
            });
        });

        // 安全检查表
        var isApproved = meta.review_status === 'approved';
        var checkboxes = mainContent.querySelectorAll('.checklist-item input[type="checkbox"]');
        checkboxes.forEach(function (cb) {
            if (isApproved) {
                cb.checked = true;
                cb.disabled = true;
                var label = cb.closest('.checklist-item');
                label.classList.add('checked');
                label.style.opacity = '0.65';
                label.style.cursor = 'default';
            }
            cb.addEventListener('change', function () {
                if (isApproved) return;
                var label = cb.closest('.checklist-item');
                label.classList.toggle('checked', cb.checked);
            });
        });
    }

    function buildConfirmMessage(meta, action) {
        var msg = '';
        msg += '将第 ' + meta.chapter + ' 章「' + meta.title + '」\n\n';
        msg += '从「' + statusLabel(meta.review_status) + '」→「' + statusLabel(action) + '」\n\n';

        // 附加修订摘要
        if (action === 'revision_needed') {
            var rev = collectRevisions();
            if (rev) {
                msg += '修订意见摘要：\n';
                var fields = [
                    { key: 'core_idea', label: '核心思想' },
                    { key: 'safety_notes', label: '安全注意事项' },
                    { key: 'interaction_points', label: '互动点' },
                    { key: 'parent_tips', label: '家长提示' }
                ];
                fields.forEach(function (f) {
                    if (rev[f.key] && rev[f.key].needs_change) {
                        msg += '· ' + f.label + '：需修改\n';
                    }
                });
            }
        }

        msg += '\n此操作将被记录到审核历史。';
        return msg;
    }

    function getUncheckedItems() {
        var result = [];
        var checkboxes = mainContent.querySelectorAll('.checklist-item input[type="checkbox"]');
        checkboxes.forEach(function (cb, idx) {
            if (!cb.checked) {
                result.push({ index: idx, text: SAFETY_CHECKLIST[idx] });
            }
        });
        return result;
    }

    // ═══ 自定义模态框 ═══
    function showConfirmModal(opts) {
        var html = '';
        html += '<div class="modal-overlay" id="modalOverlay">';
        html += '<div class="modal-box">';
        html += '<div class="modal-header">';
        html += '<span>' + (opts.title || '确认操作') + '</span>';
        html += '<button class="modal-close" id="modalClose">✕</button>';
        html += '</div>';
        html += '<div class="modal-body">';
        html += '<p style="white-space:pre-line;">' + escHtml(opts.message || '确认此操作？') + '</p>';
        html += '</div>';
        html += '<div class="modal-footer">';
        html += '<button class="btn modal-cancel-btn" id="modalCancel">取消</button>';
        html += '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + ' modal-confirm-btn" id="modalConfirm">' +
            (opts.confirmLabel || '确认') + '</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        modalContainer.innerHTML = html;

        // 绑定事件
        var overlay = $('modalOverlay');
        var closeBtn = $('modalClose');
        var cancelBtn = $('modalCancel');
        var confirmBtn = $('modalConfirm');

        function close() {
            modalContainer.innerHTML = '';
        }

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);
        confirmBtn.addEventListener('click', function () {
            close();
            if (opts.onConfirm) opts.onConfirm();
        });

        // ESC 关闭
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        });

        // 自动聚焦确认按钮
        setTimeout(function () { confirmBtn.focus(); }, 100);
    }

    function showSafetyCheckWarning(unchecks, onForcePass) {
        var html = '';
        html += '<div class="modal-overlay" id="modalOverlay">';
        html += '<div class="modal-box">';
        html += '<div class="modal-header">';
        html += '<span>⚠️ 安全检查表未全部通过</span>';
        html += '<button class="modal-close" id="modalClose">✕</button>';
        html += '</div>';
        html += '<div class="modal-body">';
        html += '<p>以下 ' + unchecks.length + ' 项尚未确认通过：</p>';
        html += '<ul style="margin:12px 0;padding-left:20px;">';
        unchecks.forEach(function (item) {
            html += '<li style="margin:4px 0;font-size:0.9em;">' + escHtml(item.text) + '</li>';
        });
        html += '</ul>';
        html += '<p style="font-size:0.85em;color:var(--review-text-light);">建议确认以上项目后再通过审核。</p>';
        html += '</div>';
        html += '<div class="modal-footer">';
        html += '<button class="btn modal-cancel-btn" id="modalCancel">返回检查</button>';
        html += '<button class="btn btn-warning modal-confirm-btn" id="modalConfirm">仍然通过（风险自担）</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        modalContainer.innerHTML = html;

        function close() { modalContainer.innerHTML = ''; }

        $('modalOverlay').addEventListener('click', function (e) { if (e.target === $('modalOverlay')) close(); });
        $('modalClose').addEventListener('click', close);
        $('modalCancel').addEventListener('click', close);
        $('modalConfirm').addEventListener('click', function () {
            close();
            if (onForcePass) onForcePass();
        });
        setTimeout(function () { $('modalConfirm').focus(); }, 100);
    }

    // ═══ 执行操作 ═══
    function performAction(chapterNum, action) {
        var notes = '';
        var notesEl = $('reviewNotes');
        if (notesEl) notes = notesEl.value.trim();

        var updates = { review_status: action };
        if (notes) updates.review_notes = notes;

        // 携带结构化修订意见
        // revision_needed 动作：始终携带
        // revision_needed → reviewing 动作：若面板有修改则携带更新后的修订意见
        if (action === 'revision_needed') {
            var rev = collectRevisions();
            if (rev) updates.revisions = rev;
        } else if (action === 'reviewing' && state.currentChapter && state.currentChapter.review_status === 'revision_needed') {
            var curRev = collectRevisions();
            if (curRev) updates.revisions = curRev;
        }

        // 按钮 loading 状态
        setButtonsDisabled(true);
        showButtonSpinner(action);

        http('PUT', '/admin/api/metadata', {
            chapter: chapterNum,
            updates: updates
        }).then(function (r) {
            if (r.status === 200 && r.data.ok) {
                toast(statusLabel(action) + ' 成功', 'success');
                // 成功动画：详情卡片脉冲
                var card = mainContent.querySelector('.detail-card');
                if (card) {
                    card.classList.add('pulse-success');
                    setTimeout(function () { card.classList.remove('pulse-success'); }, 800);
                }
                loadStats();
                loadAllChapters();
                loadChapterDetail(chapterNum);
                if (notesEl) notesEl.value = '';
                state.revisions = {};
            } else {
                toast((r.data && r.data.error) || '操作失败', 'error');
                setButtonsDisabled(false);
                hideButtonSpinner();
            }
        }).catch(function () {
            toast('网络错误', 'error');
            setButtonsDisabled(false);
            hideButtonSpinner();
        });
    }

    // ═══ 同步暂存区 → 生产 ═══
    function loadStagingStatus(callback) {
        http('GET', '/admin/api/metadata/staging').then(function (r) {
            if (r.status === 200) {
                state.stagingData = r.data;
                if (callback) callback(r.data);
            }
        }).catch(function () { /* silent */ });
    }

    function syncChapterToProduction(chapterNum) {
        setButtonsDisabled(true);
        var syncBtn = mainContent.querySelector('.btn-sync');
        if (syncBtn) {
            syncBtn.textContent = '同步中…';
            syncBtn.disabled = true;
        }

        http('POST', '/admin/api/metadata/sync', {
            chapters: [chapterNum]
        }).then(function (r) {
            if (r.status === 200 && r.data.ok) {
                toast('第 ' + chapterNum + ' 章已同步到生产环境', 'success');
                loadStagingStatus(function (staging) {
                    loadChapterDetail(chapterNum);
                    updateSyncButton(staging);
                });
            } else {
                toast((r.data && r.data.error) || '同步失败', 'error');
                setButtonsDisabled(false);
                if (syncBtn) {
                    syncBtn.textContent = '同步到生产';
                    syncBtn.disabled = false;
                }
            }
        }).catch(function () {
            toast('网络错误', 'error');
            setButtonsDisabled(false);
            if (syncBtn) {
                syncBtn.textContent = '同步到生产';
                syncBtn.disabled = false;
            }
        });
    }

    function syncAllChapters() {
        setButtonsDisabled(true);
        var syncBtn = mainContent.querySelector('.btn-sync-all');
        if (syncBtn) {
            syncBtn.textContent = '批量同步中…';
            syncBtn.disabled = true;
        }

        http('POST', '/admin/api/metadata/sync', {
            chapters: null  // null = sync all
        }).then(function (r) {
            if (r.status === 200 && r.data.ok) {
                toast('已同步 ' + r.data.synced.length + ' 章', 'success');
                loadStagingStatus();
                loadStats();
                loadAllChapters();
                if (state.currentChapter) loadChapterDetail(state.currentChapter.chapter);
                if (syncBtn) { syncBtn.textContent = '同步全部'; syncBtn.disabled = false; }
            } else {
                toast((r.data && r.data.error) || '同步失败', 'error');
                setButtonsDisabled(false);
                if (syncBtn) { syncBtn.textContent = '同步全部'; syncBtn.disabled = false; }
            }
        }).catch(function () {
            toast('网络错误', 'error');
            setButtonsDisabled(false);
            if (syncBtn) { syncBtn.textContent = '同步全部'; syncBtn.disabled = false; }
        });
    }

    function updateSyncButton(staging) {
        if (!staging) return;
        var chapters = staging.chapters || [];
        var currentCh = state.currentChapter ? String(state.currentChapter.chapter) : null;
        var hasCurrent = currentCh && chapters.indexOf(parseInt(currentCh)) !== -1;

        var actionBar = mainContent.querySelector('.sync-bar');
        if (actionBar) {
            actionBar.style.display = chapters.length > 0 ? '' : 'none';
            var statusSpan = actionBar.querySelector('.sync-status');
            if (statusSpan) {
                statusSpan.textContent = chapters.length + ' 个章节待同步';
            }
            var syncBtn = actionBar.querySelector('.btn-sync');
            if (syncBtn) {
                syncBtn.style.display = hasCurrent ? '' : 'none';
            }
        }
    }

    function bindSyncBarButtons(meta) {
        var syncBar = $('syncBar');
        if (!syncBar) return;

        var syncChapterBtn = syncBar.querySelector('.btn-sync');
        var syncAllBtn = syncBar.querySelector('.btn-sync-all');

        if (syncChapterBtn) {
            syncChapterBtn.addEventListener('click', function () {
                syncChapterToProduction(meta.chapter);
            });
        }
        if (syncAllBtn) {
            syncAllBtn.addEventListener('click', function () {
                if (!state.stagingData || !state.stagingData.chapters || state.stagingData.chapters.length === 0) {
                    toast('暂存区无待同步数据', 'info');
                    return;
                }
                if (state.stagingData.total >= 10) {
                    showConfirmModal({
                        title: '批量同步确认',
                        message: '确认将暂存区全部 ' + state.stagingData.total + ' 个章节同步到生产环境？',
                        onConfirm: function () { syncAllChapters(); }
                    });
                } else {
                    syncAllChapters();
                }
            });
        }
    }

    function setButtonsDisabled(disabled) {
        var buttons = mainContent.querySelectorAll('.action-bar .btn');
        buttons.forEach(function (btn) {
            btn.disabled = disabled;
            if (disabled) {
                btn.classList.add('btn-disabled');
            } else {
                btn.classList.remove('btn-disabled');
            }
        });
    }

    function showButtonSpinner(action) {
        // 找到对应的操作按钮并添加 spinner
        var buttons = mainContent.querySelectorAll('.action-bar .btn[data-action="' + action + '"]');
        buttons.forEach(function (btn) {
            btn.classList.add('btn-loading');
            btn.setAttribute('data-original-text', btn.innerHTML);
            btn.innerHTML = '<span class="btn-spinner"></span> 处理中…';
        });
    }

    function hideButtonSpinner() {
        var buttons = mainContent.querySelectorAll('.action-bar .btn-loading');
        buttons.forEach(function (btn) {
            btn.classList.remove('btn-loading');
            var orig = btn.getAttribute('data-original-text');
            if (orig) btn.innerHTML = orig;
        });
    }

    // ═══ 事件绑定 ═══
    chapterList.addEventListener('click', function (e) {
        var item = e.target.closest('.chapter-item');
        if (!item) return;
        var chNum = parseInt(item.getAttribute('data-chapter'), 10);
        if (!chNum) return;
        var isAI = item.getAttribute('data-mode') === 'ai';
        if (state.aiMode && isAI) {
            selectStagingChapter({ chapter: chNum });
        } else {
            selectChapter({ chapter: chNum });
        }
    });

    function selectChapter(ch) {
        loadChapterDetail(ch.chapter);
        var items = chapterList.querySelectorAll('.chapter-item');
        items.forEach(function (it) {
            it.classList.toggle('active', !it.getAttribute('data-mode') && parseInt(it.getAttribute('data-chapter'), 10) === ch.chapter);
        });
    }

    function selectStagingChapter(ch) {
        loadStagingDetail(ch.chapter);
        var items = chapterList.querySelectorAll('.chapter-item');
        items.forEach(function (it) {
            it.classList.toggle('active', it.getAttribute('data-mode') === 'ai' && parseInt(it.getAttribute('data-chapter'), 10) === ch.chapter);
        });
    }

    searchInput.addEventListener('input', function () {
        state.searchQuery = searchInput.value.trim();
        renderChapterList();
    });

    var filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var filter = btn.getAttribute('data-filter');
            if (filter === 'ai') {
                state.aiMode = true;
                state.currentFilter = 'all';
                state.currentChapter = null;
                state.currentStagingChapter = null;
                state.chapters = [];
                state.stagingChapters = [];
                mainContent.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1f916;</div><div>加载 AI 修订列表中...</div></div>';
                loadStagingList();
            } else {
                state.aiMode = false;
                state.currentFilter = filter;
                state.currentStagingChapter = null;
                state.stagingChapters = [];
                renderChapterList();
            }
        });
    });

    // 键盘导航
    document.addEventListener('keydown', function (e) {
        var hasSelection = state.aiMode ? !!state.currentStagingChapter : !!state.currentChapter;
        if (!hasSelection) return;
        if (e.ctrlKey || e.metaKey || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        var filtered = state.aiMode ? getFilteredStagingChapters() : getFilteredChapters();
        var idx = -1;
        var currentId = state.aiMode ? (state.currentStagingChapter && state.currentStagingChapter.chapter) : (state.currentChapter && state.currentChapter.chapter);
        filtered.forEach(function (c, i) {
            if (c.chapter === currentId) idx = i;
        });
        if (idx === -1) return;

        if (e.key === 'ArrowDown' || e.key === 'j') {
            e.preventDefault();
            var next = filtered[Math.min(idx + 1, filtered.length - 1)];
            if (next) {
                if (state.aiMode) selectStagingChapter(next);
                else selectChapter(next);
            }
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
            e.preventDefault();
            var prev = filtered[Math.max(idx - 1, 0)];
            if (prev) {
                if (state.aiMode) selectStagingChapter(prev);
                else selectChapter(prev);
            }
        }
    });

    function getFilteredChapters() {
        return state.chapters.filter(function (c) {
            if (state.currentFilter !== 'all' && c.review_status !== state.currentFilter) return false;
            if (state.searchQuery) {
                var q = state.searchQuery.toLowerCase();
                return (c.title && c.title.indexOf(q) !== -1) ||
                    (c.core_idea && c.core_idea.indexOf(q) !== -1) ||
                    (String(c.chapter) === q);
            }
            return true;
        });
    }

    function getFilteredStagingChapters() {
        var items = state.stagingChapters;
        if (state.searchQuery) {
            var q = state.searchQuery.toLowerCase();
            items = items.filter(function (c) {
                return (c.title && c.title.indexOf(q) !== -1) ||
                    (c.core_idea_preview && c.core_idea_preview.indexOf(q) !== -1) ||
                    (String(c.chapter) === q);
            });
        }
        return items;
    }

    // ═══ 初始化 ═══
    function init() {
        loadStats();
        loadAllChapters();
        setInterval(loadStats, 30000);
    }

    init();

})();
