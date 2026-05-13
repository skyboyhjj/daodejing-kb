/**
 * 亲子共读对话 — family.js (P2 学习模式)
 * 慧惠引导的亲子《道德经》共读体验
 *
 * 变更（P1→P2）：
 * - 新增连续学习模式（1→81 章顺序推进，进度持久化）
 * - 新增自由探索模式（任意章节跳转，全部 81 章可见）
 * - 导航栏模式切换按钮
 * - 学习进度 localStorage 持久化（预留 API 同步接口）
 * - 未审核章降级到五步读解法页面
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

// 保留原 3 章硬编码作为向后兼容（自由模式默认显示）
var CHAPTER_INFO = {
    "chapter8": { "title": "第8章 · 上善若水", "subtitle": "最高的善，像水一样", "icon": "💧" },
    "chapter1": { "title": "第1章 · 道可道，非常道", "subtitle": "真正的道，说不出来", "icon": "🌌" },
    "chapter2": { "title": "第2章 · 天下皆知美之为美", "subtitle": "美和丑，谁也离不开谁", "icon": "☯️" }
};

// 全部 81 章标题（紧凑存储，供章节选择器使用）
var CHAPTER_TITLES = [
    '',  // 占位，索引 1 开始
    '道可道，非常道', '天下皆知美之为美', '不尚贤使民不争', '道冲而用之或不盈',
    '天地不仁', '谷神不死', '天长地久', '上善若水', '持而盈之不如其已',
    '载营魄抱一', '三十辐共一毂', '五色令人目盲', '宠辱若惊', '视之不见名曰夷',
    '古之善为士者', '致虚极守静笃', '太上不知有之', '大道废有仁义', '绝圣弃智',
    '孔德之容', '曲则全', '希言自然', '企者不立', '有物混成',
    '重为轻根', '善行无辙迹', '知其雄守其雌', '将欲取天下而为之', '以道佐人主者',
    '夫佳兵者不祥之器', '道常无名', '知人者智', '大道泛兮', '执大象天下往',
    '将欲歙之', '道常无为', '上德不德', '昔之得一者', '反者道之动',
    '上士闻道', '道生一', '天下之至柔', '名与身孰亲', '大成若缺',
    '天下有道', '不出户知天下', '为学日益', '圣人无常心', '出生入死',
    '道生之', '天下有始', '使我介然有知', '善建者不拔', '含德之厚',
    '知者不言', '以正治国', '其政闷闷', '治人事天莫若啬', '治大国若烹小鲜',
    '大国者下流', '道者万物之奥', '为无为事无事', '其安易持', '古之善为道者',
    '天下皆谓我道大', '我有三宝', '善为士者不武', '用兵有言', '吾言甚易知',
    '知不知上', '民不畏威', '勇于敢则杀', '民不畏死', '民之饥',
    '人之生也柔弱', '天之道其犹张弓', '天下柔弱莫过于水', '和大怨', '小国寡民',
    '信言不美'
];

// 13 个主题板块（与 chapters.html 一致）
var CHAPTER_GROUPS = [
    { name: '⛩️ 道体论', chapters: [1, 4, 6, 14, 21, 25] },
    { name: '☯️ 辩证法', chapters: [2, 22, 36, 40] },
    { name: '🧘 修身论', chapters: [7, 8, 10, 12, 15, 16, 20, 26] },
    { name: '🌊 无为论', chapters: [3, 17, 19, 23, 29, 37, 48] },
    { name: '🤝 处世论', chapters: [9, 13, 24, 27, 33] },
    { name: '🏛️ 治国论', chapters: [5, 11, 18, 30, 31, 32, 35] },
    { name: '🔗 上经回环', chapters: [28, 34] },
    { name: '🏞️ 德论', chapters: [38, 39, 51] },
    { name: '🧘 下经修身', chapters: [42, 44, 45, 46, 50, 52, 54, 55] },
    { name: '🤝 下经处世', chapters: [41, 43, 47, 56, 63, 70, 71] },
    { name: '🏛️ 下经治国', chapters: [49, 53, 57, 58, 59, 60, 61, 64, 65, 66, 72, 74, 75] },
    { name: '⚔️ 兵论', chapters: [67, 68, 69, 73, 76] },
    { name: '🔗 下经总结', chapters: [62, 77, 78, 79, 80, 81] }
];

// 章节图标映射（emoji 作为默认图标）
var CHAPTER_ICONS = {
    1: '🌌', 2: '☯️', 3: '🌿', 4: '💫', 5: '🌾', 6: '🌊', 7: '🌍', 8: '💧',
    9: '🍵', 10: '🧘', 11: '🪵', 12: '🎨', 13: '💛', 14: '👁️', 15: '🏔️',
    16: '🌲', 17: '🌤️', 18: '📜', 19: '🌸', 20: '🍃', 21: '✨', 22: '🌀',
    23: '🌬️', 24: '🦶', 25: '🌐', 26: '⚓', 27: '🛤️', 28: '🕊️', 29: '🏺',
    30: '🛡️', 31: '⚔️', 32: '🌳', 33: '🧠', 34: '🌊', 35: '🎵', 36: '🪞',
    37: '🔄', 38: '💎', 39: '🏆', 40: '♻️', 41: '👂', 42: '🔢', 43: '💧',
    44: '⚖️', 45: '🏆', 46: '🐎', 47: '👁️', 48: '📚', 49: '❤️', 50: '🚪',
    51: '🌱', 52: '👶', 53: '🛣️', 54: '🏗️', 55: '🐉', 56: '🤫', 57: '⚖️',
    58: '🌦️', 59: '🌾', 60: '🍲', 61: '🏛️', 62: '💎', 63: '🔍', 64: '🌳',
    65: '🛶', 66: '🌊', 67: '💎', 68: '🛡️', 69: '⚔️', 70: '💬', 71: '🧘',
    72: '⚖️', 73: '⚡', 74: '⚖️', 75: '💰', 76: '🌿', 77: '🏹', 78: '💧',
    79: '🤝', 80: '🏡', 81: '💚'
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
    chapter: 'chapter8',    // 当前章节 key（向后兼容）
    chapterNum: 8,          // 当前章节号（1-81）
    roundIndex: 0,          // 当前章节内的轮次
    totalRounds: 0,         // 总轮数（跨章节累计）
    maxRounds: 10,          // 最大轮数
    chaptersDone: [],        // 当前会话已完成的章节 key 列表（向后兼容）
    allChaptersCompleted: [],// 历史累计完成的章节号列表（持久化）
    conversationHistory: [], // 当前章节的对话历史 [{role: 'huihui'|'user', content: '...'}]
    isLoading: false,        // 是否正在等待 API 响应
    parentTips: '',          // 家长提示（对话结束时展示）

    // ===== P2 新增字段 =====
    mode: 'continuous',     // 学习模式：'continuous' | 'free'
    isResumed: false,       // 是否为恢复的会话
    lastAccessDate: '',     // 'YYYY-MM-DD' 最后访问日期
    metadataCache: null     // 元数据缓存（减少重复 fetch）
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

// ===== P2 新增 DOM 引用 =====
var modeSwitchEl = document.getElementById('mode-switch');
var resumePromptEl = document.getElementById('resume-prompt');
var resumeTextEl = document.getElementById('resume-text');
var resumeContinueBtn = document.getElementById('resume-continue-btn');
var resumeResetBtn = document.getElementById('resume-reset-btn');
var chapterInputAreaEl = document.getElementById('chapter-input-area');
var chapterNumInputEl = document.getElementById('chapter-num-input');
var chapterInputBtn = document.getElementById('chapter-input-btn');
var browseAllBtn = document.getElementById('browse-all-btn');
var chapterProgressEl = document.getElementById('chapter-progress');
var progressFillEl = document.getElementById('progress-fill');
var progressTextEl = document.getElementById('progress-text');


/* ============================================================
   五、进度持久化（API 预留接口）
   ============================================================ */

var PROGRESS_KEY = 'daodejing-family-progress';

/**
 * 保存学习进度到持久化存储。
 * Phase 1: localStorage
 * Phase 2: POST /api/family_progress
 */
function saveProgress(callback) {
    var progress = {
        mode: state.mode,
        age: state.age,
        currentChapter: state.chapterNum,
        completedChapters: state.allChaptersCompleted,
        lastAccessDate: new Date().toISOString().split('T')[0],
        totalRoundsToday: state.totalRounds,
        sessionStarted: state.lastAccessDate || new Date().toISOString()
    };
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
        if (callback) callback(null, { saved: true, backend: 'localStorage' });
    } catch (e) {
        if (callback) callback(e, null);
    }
}

/**
 * 从持久化存储读取学习进度。
 * Phase 1: localStorage
 * Phase 2: GET /api/family_progress
 */
function loadProgress(callback) {
    try {
        var raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) { callback(null, null); return; }
        var progress = JSON.parse(raw);
        if (!progress || !progress.mode) { callback(null, null); return; }
        callback(null, progress);
    } catch (e) {
        callback(e, null);
    }
}

/**
 * 清除全部学习进度。
 */
function resetProgress() {
    try {
        localStorage.removeItem(PROGRESS_KEY);
    } catch (e) { /* ignore */ }
    state.allChaptersCompleted = [];
    state.chapterNum = 1;
    state.chaptersDone = [];
    state.lastAccessDate = '';
    state.isResumed = false;
}


/* ============================================================
   六、章节辅助函数
   ============================================================ */

function chapterToKey(num) {
    return 'chapter' + num;
}

function chapterToNum(key) {
    return parseInt(key.replace('chapter', ''), 10);
}

function getChapterTitle(num) {
    return CHAPTER_TITLES[num] || ('第' + num + '章');
}

function getChapterIcon(num) {
    return CHAPTER_ICONS[num] || '📖';
}

/**
 * 从元数据缓存判断章节是否已审核（可 AI 对话）
 */
function isChapterApproved(chapterNum) {
    var cache = state.metadataCache;
    if (!cache || !cache.chapters) return false;
    var ch = cache.chapters[String(chapterNum)];
    return ch && ch.review_status === 'approved';
}

/**
 * 获取章节显示信息（优先使用元数据，回退到本地数据）
 */
function getChapterDisplayInfo(chapterNum) {
    // 优先使用元数据
    var cache = state.metadataCache;
    if (cache && cache.chapters) {
        var ch = cache.chapters[String(chapterNum)];
        if (ch && ch.title) {
            return {
                title: '第' + chapterNum + '章 · ' + ch.title,
                subtitle: (ch.core_idea || '').substring(0, 40),
                icon: getChapterIcon(chapterNum),
                approved: ch.review_status === 'approved'
            };
        }
    }
    // 回退到本地数据
    return {
        title: '第' + chapterNum + '章 · ' + getChapterTitle(chapterNum),
        subtitle: '',
        icon: getChapterIcon(chapterNum),
        approved: false
    };
}


/* ============================================================
   七、UI 渲染函数
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

function appendChapterCard(chapterKeyOrNum) {
    var info;
    // 支持传入章节号（数字）或章节 key（字符串）
    if (typeof chapterKeyOrNum === 'number') {
        info = getChapterDisplayInfo(chapterKeyOrNum);
    } else {
        info = CHAPTER_INFO[chapterKeyOrNum];
    }
    if (!info) return;
    var card = document.createElement('div');
    card.className = 'chapter-intro-card';
    card.innerHTML =
        '<div class="chapter-icon">' + info.icon + '</div>' +
        '<div class="chapter-title">' + info.title + '</div>' +
        '<div class="chapter-subtitle">' + (info.subtitle || '') + '</div>';
    dialogueEl.appendChild(card);
    scrollToBottom();
}

/**
 * 未审核章的降级卡片（链接到五步读解法页面）
 */
function appendUnapprovedChapterCard(chapterNum) {
    var info = getChapterDisplayInfo(chapterNum);
    var card = document.createElement('div');
    card.className = 'chapter-intro-card unapproved-card';
    card.innerHTML =
        '<div class="chapter-icon">📝</div>' +
        '<div class="chapter-title">第' + chapterNum + '章 · ' + getChapterTitle(chapterNum) + '</div>' +
        '<div class="chapter-subtitle">本章正在由审核团队精心准备中</div>' +
        '<a href="chapters/ch' + (chapterNum < 10 ? '0' : '') + chapterNum + '.html" ' +
        'class="unapproved-link" target="_blank" rel="noopener">📖 查看五步读解法页面 →</a>';
    dialogueEl.appendChild(card);
    scrollToBottom();
}

/**
 * 更新进度条（连续学习模式）
 */
function updateChapterProgress() {
    if (!chapterProgressEl) return;
    if (state.mode !== 'continuous') {
        chapterProgressEl.style.display = 'none';
        return;
    }
    // 仅在开始学习后显示进度条，避免欢迎阶段显示误导性的默认章节号
    if (state.stage === 'welcome') {
        chapterProgressEl.style.display = 'none';
        return;
    }
    chapterProgressEl.style.display = 'block';
    var total = 81;
    var done = state.allChaptersCompleted.length;
    var pct = Math.round((done / total) * 100);
    if (progressFillEl) progressFillEl.style.width = pct + '%';
    if (progressTextEl) {
        progressTextEl.textContent = '已完成 ' + done + ' / ' + total + ' 章 · 当前：第 ' + state.chapterNum + ' 章';
    }
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
    var chapterNum = state.chapterNum;
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
   九、对话流程控制
   ============================================================ */

var _pendingProgress = null; // 存储从 localStorage 恢复的进度（供恢复按钮使用）

function showWelcome() {
    state.stage = 'welcome';
    state.conversationHistory = [];
    state.parentTips = '';

    // 先加载元数据缓存
    loadMetadataCache(function () {
        // 再检查是否有保存的学习进度
        loadProgress(function (err, progress) {
            if (progress && progress.mode && progress.currentChapter) {
                // 有待恢复的进度 → 显示恢复提示
                var doneCount = (progress.completedChapters || []).length;
                var chNum = progress.currentChapter;
                var chTitle = getChapterTitle(chNum);
                state.mode = progress.mode;
                updateModeSwitchUI();
                welcomeMsgEl.innerHTML =
                    '<p>👋 欢迎回来！</p>' +
                    '<p>你上次学到了<strong>第 ' + chNum + ' 章「' + chTitle + '」</strong>，' +
                    '已经完成了 <strong>' + doneCount + '</strong> 章。</p>' +
                    '<p>要继续吗？</p>';
                ageSelectorEl.style.display = 'none';
                chapterInputAreaEl.style.display = 'none';
                resumePromptEl.style.display = 'block';
                setInputEnabled(false);
                setActionButtonsEnabled(false);
                dialogueEl.innerHTML = '';
                _pendingProgress = progress;
            } else {
                // 新用户 → 显示模式 + 年龄选择
                _pendingProgress = null;
                resumePromptEl.style.display = 'none';
                showModeAndAgeSelection();
            }
        });
    });
}

function showModeAndAgeSelection() {
    welcomeMsgEl.innerHTML =
        '<p>你好呀！我是慧惠 🌿</p>' +
        '<p>今天想和你一起读一段《道德经》，<br>用最轻松的方式——你说，我听；我问，你和孩子一起想。</p>' +
        '<p>先告诉我：你的孩子多大了？</p>';
    ageSelectorEl.style.display = 'flex';
    chapterInputAreaEl.style.display = 'none';
    resumePromptEl.style.display = 'none';
    setInputEnabled(false);
    setActionButtonsEnabled(false);
    dialogueEl.innerHTML = '';
    updateModeSwitchUI();
    updateChapterProgress();
}

function selectAge(age) {
    state.age = age;
    state.roundIndex = 0;
    state.totalRounds = 0;
    state.chaptersDone = [];
    state.conversationHistory = [];
    state.parentTips = '';
    state.stage = 'intro';

    // 根据模式分流
    if (state.mode === 'continuous') {
        // 连续学习：隐藏欢迎区，从进度中恢复当前章节，或从第 1 章开始
        welcomeEl.style.display = 'none';
        loadProgress(function (err, progress) {
            if (progress && progress.completedChapters) {
                state.allChaptersCompleted = progress.completedChapters;
                state.chapterNum = progress.currentChapter || 1;
            } else {
                state.chapterNum = 1;
                state.allChaptersCompleted = [];
            }
            state.chapter = chapterToKey(state.chapterNum);
            state.lastAccessDate = new Date().toISOString().split('T')[0];
            saveProgress();
            setActionButtonsEnabled(true);
            updateChapterProgress();
            startChapter();
        });
    } else {
        // 自由探索：保留欢迎区容器，隐藏年龄选择，显示章节号输入
        state.chapterNum = 8;
        state.chapter = 'chapter8';
        state.mode = 'free';
        ageSelectorEl.style.display = 'none';
        updateModeSwitchUI();
        updateChapterProgress();
        setActionButtonsEnabled(true);
        chapterInputAreaEl.style.display = 'block';
        chapterNumInputEl.focus();
    }
}

function startChapter() {
    state.roundIndex = 0;
    state.conversationHistory = [];
    state.parentTips = '';
    state.stage = 'intro';
    state.chapter = chapterToKey(state.chapterNum);

    // 检查章节是否已审核
    if (!isChapterApproved(state.chapterNum)) {
        handleUnapprovedChapter(state.chapterNum);
        return;
    }

    appendChapterCard(state.chapterNum);
    updateChapterProgress();

    // 预加载当前章节的 parent_tips
    fetchParentTips(state.chapter, function (tips) {
        if (tips) state.parentTips = tips;
    });

    // 第一轮：发送空的对话历史，API 返回开场白
    setLoadingState(true);
    callFamilyChatAPI(function (err, data) {
        setLoadingState(false);
        if (err) {
            var errStr = String(err.message || err);
            // 403 表示该章节元数据尚未审核通过
            if (errStr.indexOf('403') !== -1 || errStr.indexOf('尚未通过审核') !== -1) {
                handleUnapprovedChapter(state.chapterNum);
                return;
            }
            appendSystemMessage('⚠️ ' + errStr);
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
            appendSystemMessage('⚠️ ' + String(err.message || err));
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

    // 记录已完成
    if (state.allChaptersCompleted.indexOf(state.chapterNum) === -1) {
        state.allChaptersCompleted.push(state.chapterNum);
    }
    saveProgress();
    updateChapterProgress();

    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

    // 连续学习模式：自动跳下一章
    if (state.mode === 'continuous') {
        appendSystemMessage('—— 这一章聊完啦，准备进入下一章 ——');
        setInputEnabled(false);
        userInputEl.placeholder = '即将自动进入下一章……';
        setTimeout(function () {
            goToNextChapter();
        }, 2000);
        return;
    }

    // 自由探索模式：显示章节选择器
    appendSystemMessage('—— 这一章聊完啦 ——');
    setInputEnabled(false);
    userInputEl.placeholder = '选一个新的章节，或者今天就到这里';
    showAllChaptersSelector();
}

function goToNextChapter() {
    var next = state.chapterNum + 1;
    if (next > 81) {
        allChaptersDone();
        return;
    }
    // 仅当章节审核通过（用户真正学习过）时才标记完成
    // endChapter() 已将审核通过的章加入 allChaptersCompleted，此处做防御性查重
    if (isChapterApproved(state.chapterNum) && state.allChaptersCompleted.indexOf(state.chapterNum) === -1) {
        state.allChaptersCompleted.push(state.chapterNum);
    }
    state.chapterNum = next;
    state.chapter = chapterToKey(next);
    saveProgress();
    updateChapterProgress();
    startChapter();
}

function allChaptersDone() {
    state.stage = 'ended';
    appendSystemMessage('🎉 恭喜！');
    appendSystemMessage('你已经完成了《道德经》全部 81 章的亲子共读！');
    appendSystemMessage('从「道可道，非常道」到「信言不美，美言不信」，这是一段珍贵的旅程。');

    // 展示最终告别语
    var farewells = FAREWELL_MESSAGES[state.age];
    var msg = farewells[Math.floor(Math.random() * farewells.length)];
    appendHuihuiMessage(msg);

    resetProgress();
    setInputEnabled(false);
    setActionButtonsEnabled(false);
    userInputEl.placeholder = '感谢你和孩子的参与 🌿';
    if (welcomeEl.style.display !== 'none') {
        welcomeEl.style.display = 'none';
    }
    scrollToBottom();
}

function showAllChaptersSelector() {
    // 构建全部 81 章选择器（按 13 个主题板块分组）
    var html = '';
    for (var g = 0; g < CHAPTER_GROUPS.length; g++) {
        var group = CHAPTER_GROUPS[g];
        html += '<div class="theme-group">';
        html += '<div class="theme-group-title">' + group.name + '</div>';
        html += '<div class="chapter-grid">';
        for (var c = 0; c < group.chapters.length; c++) {
            var num = group.chapters[c];
            var done = state.allChaptersCompleted.indexOf(num) !== -1;
            var approved = isChapterApproved(num);
            var info = getChapterDisplayInfo(num);
            var cls = 'chapter-mini-card';
            if (done) cls += ' done';
            if (!approved) cls += ' locked';
            html += '<div class="' + cls + '" data-chapter="' + num + '" title="' + info.title + '">';
            html += '<span class="mini-num">' + num + '</span>';
            if (done) html += '<span class="mini-check">✓</span>';
            if (!approved) html += '<span class="mini-lock">🔒</span>';
            html += '</div>';
        }
        html += '</div></div>';
    }
    chapterCardsEl.innerHTML = html;
    chapterSelectorEl.style.display = 'block';
    chapterSelectorEl.scrollIntoView({ behavior: 'smooth' });

    // 绑定点击事件
    var cards = chapterCardsEl.querySelectorAll('.chapter-mini-card');
    for (var j = 0; j < cards.length; j++) {
        cards[j].addEventListener('click', function () {
            var n = parseInt(this.getAttribute('data-chapter'), 10);
            selectChapterByNum(n);
        });
    }
}

function selectChapterByNum(chapterNum) {
    state.chapterNum = chapterNum;
    state.chapter = chapterToKey(chapterNum);
    state.roundIndex = 0;
    state.conversationHistory = [];
    state.chaptersDone = [];
    state.parentTips = '';
    chapterSelectorEl.style.display = 'none';
    updateChapterProgress();
    startChapter();
}

function selectChapter(chapterKey) {
    // 向后兼容：旧的 chapterKey 方式
    var num = chapterToNum(chapterKey);
    selectChapterByNum(num);
}

function handleUnapprovedChapter(chapterNum) {
    state.stage = 'chapter_end';
    var info = getChapterDisplayInfo(chapterNum);
    appendSystemMessage('📝 本章亲子元数据正在由审核团队精心准备中');
    appendUnapprovedChapterCard(chapterNum);
    appendSystemMessage('你也可以点击下方按钮选择其他已审核的章节');
    setInputEnabled(false);
    setActionButtonsEnabled(true);
    userInputEl.placeholder = '请选择其他章节继续学习';

    // 连续学习模式下跳过此章进入下一章
    if (state.mode === 'continuous') {
        appendSystemMessage('连续学习模式：自动跳至下一章');
        setTimeout(function () {
            goToNextChapter();
        }, 2500);
    }
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
        fetchParentTips(state.chapter, function (tips) {
            if (tips) appendParentTips(tips);
        });
    }

    saveProgress();

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

    saveProgress();

    setInputEnabled(false);
    setActionButtonsEnabled(false);
    userInputEl.placeholder = '感谢你和孩子的参与 🌿';

    scrollToBottom();
}

/**
 * 从元数据获取家长提示（用于 API 可能未返回时回退）
 */
function fetchParentTips(chapterKey, callback) {
    var chapterNum = typeof chapterKey === 'number' ? chapterKey : parseInt(chapterKey.replace('chapter', ''), 10);
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

/**
 * 加载元数据缓存（用于判断审核状态和获取章节标题）
 */
function loadMetadataCache(callback) {
    if (state.metadataCache) { callback(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/data/family_metadata.json', true);
    xhr.onload = function () {
        if (xhr.status === 200) {
            try {
                state.metadataCache = JSON.parse(xhr.responseText);
            } catch (e) { /* ignore */ }
        }
        callback();
    };
    xhr.onerror = function () { callback(); };
    xhr.timeout = 5000;
    xhr.send();
}

/**
 * 切换学习模式
 */
function switchMode(mode) {
    if (state.stage !== 'welcome' && state.stage !== 'ended') return; // 仅在初始状态可切换
    state.mode = mode;
    updateModeSwitchUI();
    updateChapterProgress();

    // 仅在有实际学习进度时才持久化（年龄已选 或 有已完成章），避免幻影记录
    if (state.age || state.allChaptersCompleted.length > 0) {
        saveProgress();
    }

    // 刷新模式相关 UI
    if (state.stage === 'welcome') {
        if (mode === 'continuous') {
            chapterInputAreaEl.style.display = 'none';
        } else {
            chapterInputAreaEl.style.display = ageSelectorEl.style.display === 'none' ? 'block' : 'none';
        }
    }
}

function updateModeSwitchUI() {
    if (!modeSwitchEl) return;
    var segs = modeSwitchEl.querySelectorAll('.mode-segment');
    for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (s.getAttribute('data-mode') === state.mode) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    }
}

/**
 * 恢复上一次的会话
 */
function resumeSession(progress) {
    state.mode = progress.mode;
    state.age = progress.age;
    state.chapterNum = progress.currentChapter;
    state.allChaptersCompleted = progress.completedChapters || [];
    state.lastAccessDate = progress.lastAccessDate || '';
    state.isResumed = true;

    // 连续学习模式：若当前章已完成，自动跳到第一个未完成章
    if (state.mode === 'continuous') {
        while (state.allChaptersCompleted.indexOf(state.chapterNum) !== -1 && state.chapterNum < 81) {
            state.chapterNum++;
        }
        if (state.allChaptersCompleted.indexOf(state.chapterNum) !== -1 && state.chapterNum >= 81) {
            // 全部完成
            allChaptersDone();
            return;
        }
    }

    state.chapter = chapterToKey(state.chapterNum);
    state.roundIndex = 0;
    state.totalRounds = progress.totalRoundsToday || 0;
    state.chaptersDone = [];
    state.conversationHistory = [];
    state.parentTips = '';
    state.stage = 'intro';

    welcomeEl.style.display = 'none';
    resumePromptEl.style.display = 'none';
    ageSelectorEl.style.display = 'none';
    chapterInputAreaEl.style.display = 'none';
    updateModeSwitchUI();
    updateChapterProgress();
    setActionButtonsEnabled(true);
    startChapter();
}


/* ============================================================
   十、事件处理
   ============================================================ */

sendBtnEl.addEventListener('click', function () {
    if (state.stage !== 'dialogue') return;
    if (sendBtnEl.disabled) return;
    if (state.isLoading) return;

    var text = userInputEl.value.trim();
    if (!text) return;

    appendUserMessage(text);
    state.conversationHistory.push({ role: 'user', content: text });
    userInputEl.value = '';
    setInputEnabled(false);

    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

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
    if (state.mode === 'continuous') {
        // 连续模式：显示 81 章选择器
        showAllChaptersSelector();
    } else {
        // 自由模式：显示 81 章选择器
        showAllChaptersSelector();
    }
});

endSessionBtnEl.addEventListener('click', function () {
    if (endSessionBtnEl.disabled) return;
    endSession();
});

// ===== P2 新增事件 =====

// 模式切换按钮
if (modeSwitchEl) {
    modeSwitchEl.addEventListener('click', function (e) {
        var seg = e.target.closest('.mode-segment');
        if (!seg) return;
        var m = seg.getAttribute('data-mode');
        if (m && m !== state.mode) switchMode(m);
    });
}

// 恢复提示按钮
if (resumeContinueBtn) {
    resumeContinueBtn.addEventListener('click', function () {
        if (_pendingProgress) resumeSession(_pendingProgress);
    });
}
if (resumeResetBtn) {
    resumeResetBtn.addEventListener('click', function () {
        resetProgress();
        resumePromptEl.style.display = 'none';
        _pendingProgress = null;
        showModeAndAgeSelection();
    });
}

// 章节号输入
if (chapterInputBtn) {
    chapterInputBtn.addEventListener('click', function () {
        var val = parseInt(chapterNumInputEl.value, 10);
        if (val >= 1 && val <= 81) {
            if (!state.age) state.age = '7-9';
            setActionButtonsEnabled(true);
            selectChapterByNum(val);
            chapterInputAreaEl.style.display = 'none';
            welcomeEl.style.display = 'none';
        } else {
            alert('请输入 1-81 之间的章节号');
        }
    });
}
if (chapterNumInputEl) {
    chapterNumInputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            chapterInputBtn.click();
        }
    });
}

// 「浏览全部 81 章」按钮（自由探索模式）
if (browseAllBtn) {
    browseAllBtn.addEventListener('click', function () {
        // 确保有默认年龄（后续选章时使用）
        if (!state.age) {
            state.age = '7-9';
            state.mode = 'free';
            updateModeSwitchUI();
        }
        chapterInputAreaEl.style.display = 'none';
        welcomeEl.style.display = 'none';
        setActionButtonsEnabled(true);
        showAllChaptersSelector();
    });
}


/* ============================================================
   十一、初始化
   ============================================================ */

(function init() {
    updateModeSwitchUI();
    updateChapterProgress();
    showWelcome();
})();
