/**
 * 亲子共读对话 — family.js (P1 混合模式)
 * 慧惠引导的亲子《道德经》共读体验
 *
 * 变更（P0→P1）：
 * - 移除硬编码的 27 组对话模板
 * - 对话内容由 POST /api/family_chat 动态生成
 * - 增加 Loading 状态提示
 * - 对话结束时展示 parent_tips
 */

/* ============================================================
   一、章节元数据（标题/图标/副标题，供 UI 展示）
   ============================================================ */

var CHAPTER_INFO = {
    "chapter8": { "title": "第8章 · 上善若水", "subtitle": "最高的善，像水一样", "icon": "💧" },
    "chapter1": { "title": "第1章 · 道可道，非常道", "subtitle": "真正的道，说不出来", "icon": "🌌" },
    "chapter2": { "title": "第2章 · 天下皆知美之为美", "subtitle": "美和丑，谁也离不开谁", "icon": "☯️" }
};

/* ============================================================
   二、告别语模板（保持不变，静态内容）
   ============================================================ */

var FAREWELL_MESSAGES = {
    "4-6": [
        "今天和你聊天真开心！你和爸爸妈妈都是最棒的故事大王。下次我们再一起读《道德经》——里面还有好多好多有趣的话等着我们呢。再见！",
        "谢谢你今天和慧惠聊天。你刚才说的那些话，每一句都很特别。去抱抱爸爸妈妈吧，下次见！"
    ],
    "7-9": [
        "今天和你聊天真开心！《道德经》里有八十一章呢，我们今天只读了一章，就像打开了一本魔法书的第一页。剩下的故事，等你们慢慢来。再见！",
        "谢谢你和爸爸妈妈今天和慧惠一起读《道德经》。你刚才说的那些想法，真的很厉害。期待下次再和你聊天。再见！"
    ],
    "10-12": [
        "今天和你聊天真开心。老子用五千字写了八十一章，我们今天只读了其中一章的一小部分。不着急——好的思想像好茶，要慢慢品。下次我们再喝第二杯。再见！",
        "谢谢你们今天和慧惠一起读《道德经》。你提出的思考角度很有意思，有些连我都没有想到过。保持这种好奇心，它比任何答案都珍贵。下次见！"
    ]
};

var AUTO_END_MESSAGE = {
    "4-6": "我们今天聊了这么多有趣的东西！该休息一下啦。下次我们再一起读《道德经》，好不好？去给爸爸妈妈一个大大的拥抱吧！",
    "7-9": "今天聊了这么多，你的小脑袋一定很累了。该休息一下了。《道德经》里还有好多故事等着我们，不急，慢慢来。下次见！",
    "10-12": "我们已经聊了十轮了，今天的思想之旅很丰盛。老子说「少则得，多则惑」——少一点，反而收获更多。今天就到这里，保持你的好奇心，下次我们继续探索。再见！"
};


/* ============================================================
   三、状态管理
   ============================================================ */

var state = {
    stage: 'welcome',       // 'welcome' | 'intro' | 'dialogue' | 'chapter_end' | 'ended'
    age: null,              // '4-6' | '7-9' | '10-12'
    chapter: 'chapter8',    // 当前章节 key
    roundIndex: 0,          // 当前章节内的轮次
    totalRounds: 0,         // 总轮数（跨章节累计）
    maxRounds: 10,          // 最大轮数
    chaptersDone: [],        // 已完成章节列表
    conversationHistory: [], // 当前章节的对话历史 [{role: 'huihui'|'user', content: '...'}]
    isLoading: false,        // 是否正在等待 API 响应
    parentTips: ''           // 家长提示（对话结束时展示）
};


/* ============================================================
   四、DOM 引用
   ============================================================ */

var welcomeEl = document.getElementById('huihui-welcome');
var welcomeMsgEl = document.getElementById('welcome-message');
var ageSelectorEl = document.getElementById('age-selector');
var dialogueEl = document.getElementById('dialogue-area');
var chapterSelectorEl = document.getElementById('chapter-selector');
var chapterCardsEl = document.getElementById('chapter-cards');
var userInputEl = document.getElementById('user-input');
var sendBtnEl = document.getElementById('send-btn');
var switchTopicBtnEl = document.getElementById('switch-topic-btn');
var endSessionBtnEl = document.getElementById('end-session-btn');


/* ============================================================
   五、UI 渲染函数
   ============================================================ */

function appendHuihuiMessage(text) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-huihui';
    bubble.innerHTML = '<p>' + text.replace(/\n/g, '<br>') + '</p>';
    dialogueEl.appendChild(bubble);
    scrollToBottom();
}

function appendUserMessage(text) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-user';
    bubble.innerHTML = '<p>' + text.replace(/\n/g, '<br>') + '</p>';
    dialogueEl.appendChild(bubble);
    scrollToBottom();
}

function appendSystemMessage(text) {
    var msg = document.createElement('div');
    msg.className = 'chat-system';
    msg.textContent = text;
    dialogueEl.appendChild(msg);
    scrollToBottom();
}

function appendChapterCard(chapterKey) {
    var info = CHAPTER_INFO[chapterKey];
    if (!info) return;
    var card = document.createElement('div');
    card.className = 'chapter-intro-card';
    card.innerHTML =
        '<div class="chapter-icon">' + info.icon + '</div>' +
        '<div class="chapter-title">' + info.title + '</div>' +
        '<div class="chapter-subtitle">' + info.subtitle + '</div>';
    dialogueEl.appendChild(card);
    scrollToBottom();
}

function appendLoadingIndicator() {
    var el = document.createElement('div');
    el.className = 'chat-bubble chat-bubble-huihui loading-bubble';
    el.id = 'loading-indicator';
    el.innerHTML = '<span class="loading-dots">慧惠正在思考<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>';
    dialogueEl.appendChild(el);
    scrollToBottom();
}

function removeLoadingIndicator() {
    var el = document.getElementById('loading-indicator');
    if (el) el.remove();
}

function appendParentTips(tips) {
    if (!tips) return;
    var card = document.createElement('div');
    card.className = 'chapter-intro-card parent-tips-card';
    card.innerHTML =
        '<div class="chapter-icon">💝</div>' +
        '<div class="chapter-title">给家长的话</div>' +
        '<div class="chapter-subtitle" style="text-align:left;line-height:1.8;">' + tips + '</div>';
    dialogueEl.appendChild(card);
    scrollToBottom();
}

function scrollToBottom() {
    requestAnimationFrame(function () {
        dialogueEl.scrollTop = dialogueEl.scrollHeight;
    });
}

function setInputEnabled(enabled) {
    if (state.isLoading) {
        userInputEl.disabled = true;
        sendBtnEl.disabled = true;
        return;
    }
    userInputEl.disabled = !enabled;
    sendBtnEl.disabled = !enabled;
    if (enabled) {
        userInputEl.placeholder = '输入孩子的回答……';
    } else {
        userInputEl.placeholder = '';
    }
}

function setActionButtonsEnabled(enabled) {
    switchTopicBtnEl.disabled = !enabled;
    endSessionBtnEl.disabled = !enabled;
}

function setLoadingState(loading) {
    state.isLoading = loading;
    if (loading) {
        userInputEl.disabled = true;
        sendBtnEl.disabled = true;
        userInputEl.placeholder = '慧惠正在思考……';
        appendLoadingIndicator();
    } else {
        removeLoadingIndicator();
        if (state.stage === 'dialogue') {
            setInputEnabled(true);
        }
    }
}


/* ============================================================
   六、API 调用
   ============================================================ */

function callFamilyChatAPI(callback) {
    var chapterNum = parseInt(state.chapter.replace('chapter', ''), 10);
    var ageGroup = 'age_' + state.age.replace('-', '_');

    var payload = {
        chapter: chapterNum,
        age_group: ageGroup,
        conversation_history: state.conversationHistory
    };

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/family_chat', true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    xhr.timeout = 16000;

    xhr.onload = function () {
        if (xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                callback(null, data);
            } catch (e) {
                callback(new Error('响应解析失败'));
            }
        } else {
            var errMsg = '请求失败 (' + xhr.status + ')';
            try {
                var errData = JSON.parse(xhr.responseText);
                errMsg = errData.error || errMsg;
            } catch (e) { /* ignore */ }
            callback(new Error(errMsg));
        }
    };

    xhr.onerror = function () {
        callback(new Error('网络连接失败，请检查网络后重试'));
    };

    xhr.ontimeout = function () {
        callback(new Error('慧惠思考超时了，请稍后再试'));
    };

    xhr.send(JSON.stringify(payload));
}


/* ============================================================
   七、对话流程控制
   ============================================================ */

function showWelcome() {
    state.stage = 'welcome';
    state.conversationHistory = [];
    state.parentTips = '';
    welcomeMsgEl.innerHTML =
        '<p>你好呀！我是慧惠 🌿</p>' +
        '<p>今天想和你一起读一段《道德经》，<br>用最轻松的方式——你说，我听；我问，你和孩子一起想。</p>' +
        '<p>先告诉我：你的孩子多大了？</p>';
    ageSelectorEl.style.display = 'flex';
    setInputEnabled(false);
    setActionButtonsEnabled(false);
    dialogueEl.innerHTML = '';
}

function selectAge(age) {
    state.age = age;
    state.chapter = 'chapter8';
    state.roundIndex = 0;
    state.totalRounds = 0;
    state.chaptersDone = [];
    state.conversationHistory = [];
    state.parentTips = '';
    state.stage = 'intro';

    welcomeEl.style.display = 'none';

    setActionButtonsEnabled(true);
    startChapter();
}

function startChapter() {
    state.roundIndex = 0;
    state.conversationHistory = [];
    state.parentTips = '';
    state.stage = 'intro';

    appendChapterCard(state.chapter);

    // 预加载当前章节的 parent_tips，确保对话结束时可立即展示
    fetchParentTips(state.chapter, function (tips) {
        if (tips) state.parentTips = tips;
    });

    // 第一轮：发送空的对话历史，API 返回开场白
    setLoadingState(true);
    callFamilyChatAPI(function (err, data) {
        setLoadingState(false);
        if (err) {
            appendSystemMessage('⚠️ ' + err.message);
            appendSystemMessage('请点击「换一个话题」重试，或「今天就到这里」。');
            state.stage = 'chapter_end';
            return;
        }

        var response = data.huihui_response;
        appendHuihuiMessage(response);
        state.conversationHistory.push({ role: 'huihui', content: response });
        state.totalRounds = 1;
        state.stage = 'dialogue';
        setInputEnabled(true);
        userInputEl.focus();
    });
}

function sendNextRound() {
    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

    setLoadingState(true);
    callFamilyChatAPI(function (err, data) {
        setLoadingState(false);
        if (err) {
            appendSystemMessage('⚠️ ' + err.message);
            return;
        }

        var response = data.huihui_response;
        appendHuihuiMessage(response);
        state.conversationHistory.push({ role: 'huihui', content: response });
        state.totalRounds++;
        state.stage = 'dialogue';
        setInputEnabled(true);
        userInputEl.focus();

        // 检测是否应该结束（API 返回结尾信号词）
        if (/下次我们再聊|下次见|下次告诉我|下次继续|今天就到这里|该休息一下了|慢慢来/.test(response)) {
            // 延迟给用户看完最后一次回复
            setTimeout(function () {
                if (state.stage === 'dialogue') {
                    endChapter();
                }
            }, 2000);
        }
    });
}

function endChapter() {
    state.stage = 'chapter_end';
    state.chaptersDone.push(state.chapter);

    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

    appendSystemMessage('—— 这一章聊完啦 ——');
    setInputEnabled(false);
    userInputEl.placeholder = '选一个新的章节，或者今天就到这里';
}

function showChapterSelector() {
    // 如果三个章节全部完成，显示温馨结束语
    if (state.chaptersDone.length >= 3) {
        chapterSelectorEl.style.display = 'block';
        chapterCardsEl.innerHTML =
            '<div class="chapter-card chapter-card-done" style="max-width:none;text-align:center;cursor:default;border-color:var(--family-accent);">' +
            '<div class="card-chapter-num" style="font-size:1.2em;">🌿</div>' +
            '<div class="card-chapter-title" style="font-size:1.05em;">今天表现非常棒，共读就到这里啦，明天再见！</div>' +
            '</div>';
        chapterCardsEl.querySelector('.chapter-card').addEventListener('click', function () {
            endSession();
        });
        chapterSelectorEl.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    var chapters = ['chapter8', 'chapter1', 'chapter2'];
    var html = '';
    for (var i = 0; i < chapters.length; i++) {
        var key = chapters[i];
        var info = CHAPTER_INFO[key];
        var done = state.chaptersDone.indexOf(key) !== -1;
        html +=
            '<div class="chapter-card" data-chapter="' + key + '">' +
            '<div class="card-chapter-num">' + (done ? '✓ 已读 · ' : '') + info.icon + '</div>' +
            '<div class="card-chapter-title">' + info.title + '</div>' +
            '</div>';
    }
    chapterCardsEl.innerHTML = html;
    chapterSelectorEl.style.display = 'block';
    chapterSelectorEl.scrollIntoView({ behavior: 'smooth' });

    var cards = chapterCardsEl.querySelectorAll('.chapter-card');
    for (var j = 0; j < cards.length; j++) {
        cards[j].addEventListener('click', function () {
            var ch = this.getAttribute('data-chapter');
            selectChapter(ch);
        });
    }
}

function selectChapter(chapterKey) {
    state.chapter = chapterKey;
    chapterSelectorEl.style.display = 'none';
    startChapter();
}

function endSession() {
    state.stage = 'ended';

    var farewells = FAREWELL_MESSAGES[state.age];
    var msg = farewells[Math.floor(Math.random() * farewells.length)];

    appendSystemMessage('—— 今天就到这里 ——');
    appendHuihuiMessage(msg);

    // 展示家长提示
    if (state.parentTips) {
        appendParentTips(state.parentTips);
    } else {
        // 回退：从元数据中获取 parent_tips
        fetchParentTips(state.chapter, function (tips) {
            if (tips) appendParentTips(tips);
        });
    }

    setInputEnabled(false);
    setActionButtonsEnabled(false);
    userInputEl.placeholder = '感谢你和孩子的参与 🌿';

    if (welcomeEl.style.display !== 'none') {
        welcomeEl.style.display = 'none';
    }

    scrollToBottom();
}

function autoEndSession() {
    state.stage = 'ended';

    var msg = AUTO_END_MESSAGE[state.age];

    appendSystemMessage('—— 今天聊了好多，该歇歇啦 ——');
    appendHuihuiMessage(msg);

    if (state.parentTips) {
        appendParentTips(state.parentTips);
    } else {
        fetchParentTips(state.chapter, function (tips) {
            if (tips) appendParentTips(tips);
        });
    }

    setInputEnabled(false);
    setActionButtonsEnabled(false);
    userInputEl.placeholder = '感谢你和孩子的参与 🌿';

    scrollToBottom();
}

/**
 * 从元数据获取家长提示（用于 API 可能未返回时回退）
 */
function fetchParentTips(chapterKey, callback) {
    var chapterNum = parseInt(chapterKey.replace('chapter', ''), 10);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/family_metadata.json', true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            try {
                var meta = JSON.parse(xhr.responseText);
                if (meta.chapters && meta.chapters[String(chapterNum)]) {
                    callback(meta.chapters[String(chapterNum)].parent_tips || '');
                    return;
                }
            } catch (e) { /* ignore */ }
        }
        callback('');
    };
    xhr.onerror = function () { callback(''); };
    xhr.send();
}


/* ============================================================
   八、事件处理
   ============================================================ */

sendBtnEl.addEventListener('click', function () {
    if (state.stage !== 'dialogue') return;
    if (sendBtnEl.disabled) return;
    if (state.isLoading) return;

    var text = userInputEl.value.trim();
    if (!text) return;

    // 显示用户消息
    appendUserMessage(text);
    state.conversationHistory.push({ role: 'user', content: text });
    userInputEl.value = '';
    setInputEnabled(false);

    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

    // 调用 API 获取下一轮
    sendNextRound();
});

userInputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtnEl.click();
    }
});

ageSelectorEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.age-btn');
    if (!btn || btn.disabled) return;
    var age = btn.getAttribute('data-age');
    if (age) selectAge(age);
});

switchTopicBtnEl.addEventListener('click', function () {
    if (switchTopicBtnEl.disabled) return;
    showChapterSelector();
});

endSessionBtnEl.addEventListener('click', function () {
    if (endSessionBtnEl.disabled) return;
    endSession();
});


/* ============================================================
   九、初始化
   ============================================================ */

(function init() {
    showWelcome();
})();
