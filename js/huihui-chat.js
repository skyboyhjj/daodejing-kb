/**
 * 慧惠 AI 聊天组件 — JS 逻辑
 * 版本：v1.0
 * 功能：浮动按钮、聊天面板、消息收发、DeepSeek API 调用（通过 Functions 代理）
 */
(function () {
    'use strict';

    // ===== 常量 =====
    var API_URL = 'https://daodejing-kb.vercel.app/api/chat';
    var WELCOME_TEXT = '你好呀！我是慧惠。关于《道德经》，有什么想聊的？';

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
        + '<div class="hui-messages" id="hui-messages"></div>'
        + '<div class="hui-input-area">'
        + '<textarea class="hui-input" id="hui-input" rows="1" placeholder="聊聊《道德经》…" aria-label="输入消息"></textarea>'
        + '<button class="hui-send-btn" id="hui-send-btn" aria-label="发送消息">➤</button>'
        + '</div>'
        + '</div>';

    var container = document.createElement('div');
    container.innerHTML = chatHTML;
    document.body.appendChild(container);

    // ===== DOM 引用 =====
    var chatBtn = document.getElementById('huihui-chat-btn');
    var chatPanel = document.getElementById('huihui-chat-panel');
    var messagesEl = document.getElementById('hui-messages');
    var inputEl = document.getElementById('hui-input');
    var sendBtn = document.getElementById('hui-send-btn');
    var closeBtn = document.querySelector('.hui-close-btn');
    var backToTopBtn = document.querySelector('.back-to-top');

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
            setSavedLevel(level);
            highlightChatLevelBtn(level);
            // 派发自定义事件，供章节页面 level-selector 监听
            window.dispatchEvent(new CustomEvent('huihui-level-changed', {
                detail: { level: level }
            }));
        };
    }

    for (var j = 0; j < levelBtns.length; j++) {
        levelBtns[j].addEventListener('click', onLevelBtnClick(levelBtns[j]));
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

    // ===== 初始化：显示欢迎消息 =====
    addMessage('ai', WELCOME_TEXT);

    // 3 秒后移除脉冲动画
    setTimeout(function () {
        if (chatBtn) chatBtn.classList.remove('pulse');
    }, 3000);

    // ===== 打开/关闭面板 =====
    chatBtn.addEventListener('click', function () {
        openPanel();
    });

    closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePanel();
    });

    function openPanel() {
        isOpen = true;
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
    }

    function closePanel() {
        isOpen = false;
        chatPanel.classList.remove('open');
        chatBtn.style.display = 'flex';
        // 恢复返回顶部按钮
        if (backToTopBtn) {
            backToTopBtn.style.display = '';
        }
        if (window.innerWidth <= 480) {
            document.body.style.overflow = '';
        }
    }

    // ===== 发送消息 =====
    function sendMessage() {
        var text = inputEl.value.trim();
        if (!text || isSending) return;

        // 添加用户消息
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
                messages: getMessages(),
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
        if (isOpen && !chatPanel.contains(e.target) && !chatBtn.contains(e.target)) {
            closePanel();
        }
    });

})();
