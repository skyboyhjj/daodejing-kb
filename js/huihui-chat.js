/**
 * 慧惠 AI 聊天组件 — JS 逻辑
 * 版本：v1.0
 * 功能：浮动按钮、聊天面板、消息收发、DeepSeek API 调用（通过 Functions 代理）
 */
(function () {
    'use strict';
    console.log('[HuihuiChat] 脚本开始执行, document.readyState=' + document.readyState);

    // ===== 常量 =====
    var API_URL = '/api/chat';
    var WELCOME_TEXT = window.HUIHUI_WELCOME_OVERRIDE || '你好呀！我是慧惠。关于《道德经》，有什么想聊的？';

    // ===== 匿名用户 ID =====
    var userId = localStorage.getItem('huihui_uid');
    if (!userId) {
        userId = 'guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        localStorage.setItem('huihui_uid', userId);
    }

    // ===== 注入 HTML 结构 =====
    var chatHTML = '<div id="huihui-chat-btn" class="pulse" title="和慧惠聊聊《道德经》" aria-label="打开慧惠聊天">'
        + '<svg viewBox="0 0 24 24">'
        + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
        + '<path d="M7 9h10M7 13h6" stroke-linecap="round"/>'
        + '</svg>'
        + '</div>'
        + '<div id="huihui-chat-panel">'
        + '<div class="hui-header">'
        + '<div class="hui-header-left">'
        + '<div class="hui-avatar">🌿</div>'
        + '<div>'
        + '<div class="hui-header-title">慧惠</div>'
        + '<div class="hui-header-subtitle">《道德经》AI 助教</div>'
        + '</div>'
        + '</div>'
        + '<button class="hui-close-btn" aria-label="关闭聊天">✕</button>'
        + '</div>'
        + '<div class="huihui-level-bar">'
        + '<button class="huihui-level-btn" data-level="L1">白话</button>'
        + '<button class="huihui-level-btn" data-level="L2">精读</button>'
        + '<button class="huihui-level-btn" data-level="L3">应用</button>'
        + '<button class="huihui-level-btn" data-level="L4">学术</button>'
        + '</div>'
        + '<div class="huihui-feedback-bar" style="display:none">'
        + '<button class="huihui-feedback-btn" data-fb-type="bug">我要报错</button>'
        + '<button class="huihui-feedback-btn" data-fb-type="suggestion">我要建议</button>'
        + '<button class="huihui-feedback-btn" data-fb-type="help">我要帮助</button>'
        + '</div>'
        + '<div class="hui-messages" id="hui-messages"></div>'
        + '<div class="hui-input-area">'
        + '<textarea class="hui-input" id="hui-input" rows="1" placeholder="聊聊《道德经》…" aria-label="输入消息"></textarea>'
        + '<button class="hui-send-btn" id="hui-send-btn" aria-label="发送消息">➤</button>'
        + '</div>'
        + '</div>';

    var container = document.createElement('div');
    container.innerHTML = chatHTML;
    document.body.appendChild(container);
    console.log('[HuihuiChat] HTML 已注入 DOM');

    // ===== DOM 引用 =====
    var chatBtn = document.getElementById('huihui-chat-btn');
    var chatPanel = document.getElementById('huihui-chat-panel');
    var messagesEl = document.getElementById('hui-messages');
    var inputEl = document.getElementById('hui-input');
    var sendBtn = document.getElementById('hui-send-btn');
    var closeBtn = document.querySelector('.hui-close-btn');
    var backToTopBtn = document.querySelector('.back-to-top');
    console.log('[HuihuiChat] DOM 引用获取: chatBtn=' + !!chatBtn + ', panel=' + !!chatPanel + ', messagesEl=' + !!messagesEl + ', inputEl=' + !!inputEl + ', sendBtn=' + !!sendBtn + ', closeBtn=' + !!closeBtn);

    // ===== 认知层级 — localStorage =====
    function getSavedLevel() {
        return localStorage.getItem('huihui_taoism_level') || 'L2';
    }

    function setSavedLevel(level) {
        localStorage.setItem('huihui_taoism_level', level);
    }

    // 更新聊天框层级按钮高亮状态
    function highlightChatLevelBtn(level) {
        var btns = document.querySelectorAll('.huihui-level-btn');
        for (var i = 0; i < btns.length; i++) {
            var btn = btns[i];
            if (btn.getAttribute('data-level') === level) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }

    // 初始化层级按钮 + 绑定事件
    var levelBtns = document.querySelectorAll('.huihui-level-btn');
    var currentLevel = getSavedLevel();

    // URL 参数优先：如果 URL 中有 level 参数，同步到聊天框
    try {
        var urlParams = new URLSearchParams(window.location.search);
        var urlLevel = urlParams.get('level');
        if (urlLevel && ['l1', 'l2', 'l3', 'l4'].indexOf(urlLevel) >= 0) {
            currentLevel = urlLevel.toUpperCase();
            setSavedLevel(currentLevel);
        }
    } catch (e) { }

    // 如果聊天框无存储值但页面已有偏好（非 'all'），跟随页面
    if (!localStorage.getItem('huihui_taoism_level')) {
        var pagePref = localStorage.getItem('daodejing-level-preference');
        if (pagePref && pagePref !== 'all' && ['l1', 'l2', 'l3', 'l4'].indexOf(pagePref) >= 0) {
            currentLevel = pagePref.toUpperCase();
        }
    }
    setSavedLevel(currentLevel);  // 持久化默认值，确保 localStorage 有值
    highlightChatLevelBtn(currentLevel);

    // 初始化时派发事件，让章节页面（若已加载）同步到当前层级
    window.dispatchEvent(new CustomEvent('huihui-level-changed', {
        detail: { level: currentLevel }
    }));

    function onLevelBtnClick(btn) {
        return function () {
            var level = btn.getAttribute('data-level');
            if (!level) return;
            var oldLevel = getSavedLevel();
            setSavedLevel(level);
            highlightChatLevelBtn(level);
            // 派发自定义事件，供章节页面 level-selector 监听
            window.dispatchEvent(new CustomEvent('huihui-level-changed', {
                detail: { level: level }
            }));
            // SkillUP: 记录认知水平切换
            if (window.SkillUP && oldLevel !== level) {
                window.SkillUP.recordLevelSwitch(oldLevel, level);
                // 检查触发规则2：切换到L3 + 溪流阶段
                if (window.SkillUP.isTrackingEnabled()) {
                    var l3Trigger = window.SkillUP.checkTriggerL3Switch();
                    if (l3Trigger) {
                        setTimeout(function () {
                            addMessage('ai', l3Trigger.message);
                        }, 800);
                    }
                }
            }
        };
    }

    for (var j = 0; j < levelBtns.length; j++) {
        levelBtns[j].addEventListener('click', onLevelBtnClick(levelBtns[j]));
    }

    // ===== 反馈类型按钮 =====
    var feedbackBtns = document.querySelectorAll('.huihui-feedback-btn');
    for (var fb = 0; fb < feedbackBtns.length; fb++) {
        feedbackBtns[fb].addEventListener('click', function () {
            var fbType = this.getAttribute('data-fb-type');
            if (!fbType || isSending) return;

            // 发送反馈消息（通过 sendMessage 检测意图）
            inputEl.value = this.textContent.trim();
            sendMessage();
        });
    }

    // 监听章节页面 level-selector 变化，同步高亮聊天框按钮
    window.addEventListener('huihui-level-changed', function (e) {
        var newLevel = e.detail && e.detail.level;
        if (newLevel && newLevel !== 'ALL') {
            setSavedLevel(newLevel);
            highlightChatLevelBtn(newLevel);
        }
    });

    var isOpen = false;
    var isSending = false;
    var feedbackSessionActive = false;  // 反馈会话进行中
    var launchMode = 'normal';  // 聊天入口来源：'normal' | 'feedback'
    var panelJustOpened = false; // 防止 openPanel() 后的同一个点击事件触发 closePanel()

    // ===== 初始化：显示欢迎消息 =====
    addMessage('ai', WELCOME_TEXT);

    // 3 秒后移除脉冲动画
    setTimeout(function () {
        if (chatBtn) chatBtn.classList.remove('pulse');
    }, 3000);

    // ===== 打开/关闭面板 =====
    chatBtn.addEventListener('click', function () {
        console.log('[HuihuiChat] 浮动按钮被点击，调用 openPanel()');
        launchMode = 'normal';
        if (feedbackSessionActive) {
            endFeedbackSession();
        }
        openPanel();
    });

    closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log('[HuihuiChat] 关闭按钮被点击');
        closePanel();
    });

    function openPanel() {
        console.log('[HuihuiChat] openPanel() 执行，当前 isOpen=' + isOpen + ', launchMode=' + launchMode);
        isOpen = true;
        panelJustOpened = true;

        // 根据入口来源确保按钮栏状态正确
        var levelBar = document.querySelector('.huihui-level-bar');
        var feedbackBar = document.querySelector('.huihui-feedback-bar');
        if (launchMode === 'normal') {
            if (levelBar) levelBar.style.display = '';
            if (feedbackBar) feedbackBar.style.display = 'none';

            // 如果消息区无用户消息（仅有引导语），恢复欢迎语
            if (messagesEl && messagesEl.querySelectorAll('.hui-msg.user').length === 0) {
                messagesEl.innerHTML = '';
                addMessage('ai', WELCOME_TEXT);
            }
        }

        chatPanel.classList.add('open');
        chatBtn.style.display = 'none';
        // 隐藏返回顶部按钮，避免与聊天面板重叠
        if (backToTopBtn) {
            backToTopBtn.style.display = 'none';
        }
        inputEl.focus();
        scrollToBottom();
        if (window.innerWidth <= 480) {
            document.body.style.overflow = 'hidden';
        }

        // SkillUP: 检查所有触发规则（§4.1 + Phase 3 动态反馈）
        if (window.SkillUP && window.SkillUP.isTrackingEnabled()) {
            // 始终记录本次访问（更新追踪数据）
            window.SkillUP.recordChapterVisit();

            var messages = [];

            // Phase 3: 待展示动态反馈（81章完成 > 阶段跃迁）
            var feedback = window.SkillUP.getPendingFeedback();
            if (feedback) {
                // 81章完成纪念或阶段跃迁欢迎语优先展示
                messages.push(feedback.message);
                // 如果已有优先反馈，跳过常规规则以避免消息过载
                // （ch8 里程碑和连续3天将在下次无优先反馈时展示）
            } else {
                // 常规规则：首次阅读第8章后（chaptersVisited>=3 且 水滴）
                var ch8Trigger = window.SkillUP.checkTriggerCh8Milestone();
                if (ch8Trigger) {
                    messages.push(ch8Trigger.message);
                }

                // 常规规则：连续三天访问
                var consecTrigger = window.SkillUP.checkTriggerConsecutiveDays();
                if (consecTrigger) {
                    messages.push(consecTrigger.message);
                }
            }

            // 逐条显示反馈（每条间隔 800ms）
            if (messages.length > 0) {
                var delay = 600;
                messages.forEach(function (msg) {
                    setTimeout(function () {
                        addMessage('ai', msg);
                    }, delay);
                    delay += 1000;
                });
            }
        }

        // ===== 用户许可征求（连续3天访问后轻声询问） =====
        if (window.HuihuiConsent && window.HuihuiConsent.shouldAskForConsent()) {
            window.HuihuiConsent.markAsked();
            // 放在里程碑消息之后展示
            setTimeout(function () {
                addMessage('ai', window.HuihuiConsent.getConsentMessage());
            }, 2000);
        } else if (window.__skillupCardTrigger && window.HuihuiConsent &&
                   !window.HuihuiConsent.hasUserConsented() &&
                   !window.HuihuiConsent.hasUserDeclined() &&
                   !window.HuihuiConsent.wasAskedToday()) {
            // 用户点击了「我的成长」卡片，立即触发许可征求（跳过3天等待）
            window.HuihuiConsent.markAsked();
            window.__skillupCardTrigger = false;
            setTimeout(function () {
                addMessage('ai', window.HuihuiConsent.getConsentMessage());
            }, 2000);
        }

        // 300ms 后解除防护，允许后续的"点击面板外关闭"正常生效
        setTimeout(function () {
            panelJustOpened = false;
        }, 300);
    }

    function closePanel() {
        console.log('[HuihuiChat] closePanel() 执行, 当前 isOpen=' + isOpen + ', launchMode=' + launchMode);
        isOpen = false;
        var wasFeedback = (launchMode === 'feedback');
        launchMode = 'normal';
        chatPanel.classList.remove('open');
        chatBtn.style.display = 'flex';
        // 恢复返回顶部按钮
        if (backToTopBtn) {
            backToTopBtn.style.display = '';
        }
        if (window.innerWidth <= 480) {
            document.body.style.overflow = '';
        }
        // 如果在反馈会话中关闭面板，重置反馈状态
        if (feedbackSessionActive) {
            endFeedbackSession();
        } else if (wasFeedback) {
            // 进入反馈模式但未开始会话就关闭，手动恢复标准聊天 UI
            var levelBar = document.querySelector('.huihui-level-bar');
            var feedbackBar = document.querySelector('.huihui-feedback-bar');
            if (levelBar) levelBar.style.display = '';
            if (feedbackBar) feedbackBar.style.display = 'none';
            inputEl.placeholder = '聊聊《道德经》…';
        }
    }

    // ===== 每日镜鉴关键词识别 =====
    function detectMirrorIntent(userMessage) {
        var msg = userMessage.trim();
        // 事件镜鉴触发
        if (msg === '做个镜鉴') {
            return 'event';
        }
        // 晚间回顾触发
        if (msg === '晚间回顾') {
            return 'evening';
        }
        return null;
    }

    function handleMirrorIntent(intentType, userMessage) {
        var prefix = '';
        switch (intentType) {
            case 'event':
                prefix = '[MIRROR:EVENT] ';
                break;
            case 'evening':
                prefix = '[MIRROR:EVENING] ';
                break;
        }
        return prefix + userMessage;
    }

    // ===== 用户反馈关键词识别 =====
    function detectFeedbackIntent(userMessage) {
        var msg = userMessage.trim();
        if (msg === '我要报错') return 'bug';
        if (msg === '我要建议') return 'suggestion';
        if (msg === '我要帮助') return 'help';
        return null;
    }

    function handleFeedbackIntent(feedbackType, userMessage) {
        return '[FEEDBACK:SOP=' + feedbackType + '] ' + userMessage;
    }

    // ===== 结束反馈会话 =====
    function endFeedbackSession() {
        if (!feedbackSessionActive) return;
        feedbackSessionActive = false;
        launchMode = 'normal';

        // 恢复 L1-L4 按钮
        var levelBar = document.querySelector('.huihui-level-bar');
        var feedbackBar = document.querySelector('.huihui-feedback-bar');
        if (levelBar) levelBar.style.display = '';
        if (feedbackBar) feedbackBar.style.display = 'none';

        // 恢复输入框提示
        inputEl.placeholder = '聊聊《道德经》…';

        console.log('[HuihuiChat] 反馈会话已结束');
    }

    // ===== 发送消息 =====
    function sendMessage() {
        var text = inputEl.value.trim();
        if (!text || isSending) return;

        // SkillUP: 记录用户消息
        if (window.SkillUP) {
            window.SkillUP.recordMessage(text, getSavedLevel());
        }

        // SkillUP: 技能查询拦截（本地回答，不调 API）—— 触发规则4
        if (window.SkillUP && window.SkillUP.isTrackingEnabled()) {
            var progressResponse = window.SkillUP.checkProgressQuery(text);
            if (progressResponse) {
                addMessage('user', text);
                inputEl.value = '';
                autoResizeInput();
                addMessage('ai', progressResponse.message);
                return;
            }
        }

        // ===== 用户许可征求响应拦截 =====
        if (window.HuihuiConsent && !window.HuihuiConsent.hasUserConsented() &&
            !window.HuihuiConsent.hasUserDeclined() && window.HuihuiConsent.wasAskedToday()) {
            if (window.HuihuiConsent.isAffirmative(text)) {
                window.HuihuiConsent.grantConsent();
                addMessage('user', text);
                inputEl.value = '';
                autoResizeInput();
                addMessage('ai', window.HuihuiConsent.getGrantedMessage());
                return;
            }
            if (window.HuihuiConsent.isDeclining(text)) {
                window.HuihuiConsent.declineConsent();
                addMessage('user', text);
                inputEl.value = '';
                autoResizeInput();
                addMessage('ai', window.HuihuiConsent.getDeclinedMessage());
                return;
            }
        }

        // ===== 每日镜鉴关键词检测 =====
        var mirrorIntent = detectMirrorIntent(text);

        // ===== 用户反馈关键词检测 =====
        var feedbackIntent = detectFeedbackIntent(text);

        // 添加用户消息（UI 显示原文，不含技术标记）
        addMessage('user', text);
        inputEl.value = '';
        autoResizeInput();

        // 显示打字指示器
        isSending = true;
        sendBtn.disabled = true;
        var typingEl = addTypingIndicator();

        // 调用 API（10 秒超时保护）
        var controller = new AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, 10000);

        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: (function () {
                    var msgs = getMessages();
                    if (mirrorIntent) {
                        // 找到最后一条用户消息，添加镜鉴引导标记
                        for (var k = msgs.length - 1; k >= 0; k--) {
                            if (msgs[k].role === 'user') {
                                msgs[k].content = handleMirrorIntent(mirrorIntent, msgs[k].content);
                                break;
                            }
                        }
                    }
                    if (feedbackIntent) {
                        // 找到最后一条用户消息，添加反馈 SOP 标记
                        for (var k = msgs.length - 1; k >= 0; k--) {
                            if (msgs[k].role === 'user') {
                                msgs[k].content = handleFeedbackIntent(feedbackIntent, msgs[k].content);
                                break;
                            }
                        }
                        // 进入反馈会话模式
                        feedbackSessionActive = true;
                    }
                    return msgs;
                })(),
                user_id: userId,
                level: getSavedLevel()
            }),
            signal: controller.signal
        })
            .then(function (resp) {
                clearTimeout(timeoutId);
                // 先用 text() 读取，避免 resp.json() 直接崩溃
                return resp.text().then(function (text) {
                    var data = null;
                    try {
                        data = text ? JSON.parse(text) : {};
                    } catch (e) {
                        // 响应体不是有效 JSON
                        if (!resp.ok) {
                            throw new Error('服务器返回异常（' + resp.status + '），请稍后重试。');
                        }
                        throw new Error('服务器返回了无法解析的数据，请稍后重试。');
                    }
                    if (!resp.ok) {
                        throw new Error(data.error || '服务器出了点问题（' + resp.status + '）');
                    }
                    return data;
                });
            })
            .then(function (data) {
                // 移除打字指示器
                removeTypingIndicator(typingEl);

                if (data.choices && data.choices[0] && data.choices[0].message) {
                    addMessage('ai', data.choices[0].message.content);

                    // 反馈会话：检测确认标记，仅重置会话标志（保持反馈界面）
                    if (data._feedbackConfirmed && feedbackSessionActive) {
                        feedbackSessionActive = false;
                        inputEl.placeholder = '继续反馈或聊聊《道德经》…';
                    }
                } else if (data.error) {
                    addError(data.error);
                } else {
                    addError('慧惠暂时无法回应，请稍后再试。');
                }

                isSending = false;
                sendBtn.disabled = false;
                inputEl.focus();
            })
            .catch(function (err) {
                clearTimeout(timeoutId);
                removeTypingIndicator(typingEl);
                if (err.name === 'AbortError') {
                    addError('请求超时，慧惠正在思考中，请稍后重试。');
                } else {
                    addError(err.message || '网络连接失败，请稍后重试。');
                }
                isSending = false;
                sendBtn.disabled = false;
            });
    }

    // ===== 发送按钮点击 =====
    sendBtn.addEventListener('click', sendMessage);

    // ===== 回车发送（Shift+Enter 换行） =====
    inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ===== 输入框自动调整高度 =====
    inputEl.addEventListener('input', autoResizeInput);

    function autoResizeInput() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    }

    // ===== 辅助函数 =====

    /** 添加消息气泡 */
    function addMessage(role, text) {
        var msgDiv = document.createElement('div');
        msgDiv.className = 'hui-msg ' + role;

        var avatar = document.createElement('div');
        avatar.className = 'hui-msg-avatar';
        avatar.textContent = role === 'ai' ? '🌿' : '👤';

        var bubble = document.createElement('div');
        bubble.className = 'hui-msg-bubble';
        bubble.textContent = text;

        msgDiv.appendChild(role === 'user' ? bubble : avatar);
        msgDiv.appendChild(role === 'user' ? avatar : bubble);
        messagesEl.appendChild(msgDiv);
        scrollToBottom();
    }

    /** 添加错误提示 */
    function addError(text) {
        var errDiv = document.createElement('div');
        errDiv.className = 'hui-error';
        errDiv.textContent = text;
        messagesEl.appendChild(errDiv);
        scrollToBottom();
    }

    /** 添加打字指示器 */
    function addTypingIndicator() {
        var typingDiv = document.createElement('div');
        typingDiv.className = 'hui-msg ai';
        typingDiv.id = 'hui-typing';

        var avatar = document.createElement('div');
        avatar.className = 'hui-msg-avatar';
        avatar.textContent = '🌿';

        var bubble = document.createElement('div');
        bubble.className = 'hui-msg-bubble';
        bubble.innerHTML = '<div class="hui-typing"><span></span><span></span><span></span></div>';

        typingDiv.appendChild(avatar);
        typingDiv.appendChild(bubble);
        messagesEl.appendChild(typingDiv);
        scrollToBottom();
        return typingDiv;
    }

    /** 移除打字指示器 */
    function removeTypingIndicator(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    /** 获取当前对话历史（欢迎语 + 最近 10 轮） */
    function getMessages() {
        var bubbles = messagesEl.querySelectorAll('.hui-msg-bubble');
        var result = [];
        // 跳过第一条欢迎语
        var start = bubbles.length > 1 ? 1 : 0;
        // 最多取最近 20 条（10 轮对话）
        var maxBubbles = Math.min(bubbles.length, 21);
        start = Math.max(start, bubbles.length - maxBubbles);

        for (var i = start; i < bubbles.length; i++) {
            var bubble = bubbles[i];
            var msgDiv = bubble.parentElement;
            var role = msgDiv.classList.contains('user') ? 'user' : 'assistant';
            var text = bubble.textContent.trim();
            if (text) {
                result.push({ role: role, content: text });
            }
        }
        return result;
    }

    /** 滚动到底部 */
    function scrollToBottom() {
        requestAnimationFrame(function () {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }

    // ===== ESC 关闭面板 =====
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) {
            closePanel();
        }
    });

    // ===== 点击面板外关闭 =====
    document.addEventListener('click', function (e) {
        // 防止 openPanel() 刚执行完就被同一用户操作的冒泡事件关闭
        // 典型场景：点击卡片 → btn.click() → openPanel() → 原始事件冒泡到 document → 误触发 closePanel()
        if (panelJustOpened) {
            console.log('[HuihuiChat] document click 被 panelJustOpened 拦截, target:', e.target.tagName, e.target.className);
            return;
        }
        if (isOpen && !chatPanel.contains(e.target) && !chatBtn.contains(e.target)) {
            console.log('[HuihuiChat] 点击面板外，关闭面板, target:', e.target.tagName, e.target.className);
            closePanel();
        }
    });

    console.log('[HuihuiChat] 脚本初始化完成, chatBtn=' + !!chatBtn + ', panel=' + !!chatPanel);

    // ===== 用户反馈入口（全局函数） =====
    window.openHuihuiFeedback = function () {
        console.log('[HuihuiChat] openHuihuiFeedback 被调用, isOpen=' + isOpen + ', launchMode=' + launchMode);

        launchMode = 'feedback';

        // 在打开面板前设置反馈专用 UI，消除闪现
        var levelBar = document.querySelector('.huihui-level-bar');
        var feedbackBar = document.querySelector('.huihui-feedback-bar');
        if (levelBar) levelBar.style.display = 'none';
        if (feedbackBar) feedbackBar.style.display = 'flex';

        // 重新启用反馈按钮（可能被之前的点击禁用）
        var fbBtns = document.querySelectorAll('.huihui-feedback-btn');
        for (var fb = 0; fb < fbBtns.length; fb++) {
            fbBtns[fb].disabled = false;
        }

        // 显示反馈专属引导语（仅在非反馈会话中显示，避免重复）
        if (!feedbackSessionActive) {
            if (messagesEl) messagesEl.innerHTML = '';
            addMessage('ai',
                '你好呀！有什么想反馈的吗？\n\n' +
                '请先点击上方三个按钮，选一个你想反馈的类型：\n' +
                '  「我要报错」— 发现网站问题或错误\n' +
                '  「我要建议」— 分享改进想法\n' +
                '  「我要帮助」— 遇到使用困难\n\n' +
                '选好后慧惠会一步步了解你的具体情况。'
            );
        }

        if (!isOpen) {
            openPanel();
        }

        inputEl.value = '';
        inputEl.focus();
        scrollToBottom();
    };
})();
// force deploy trigger
