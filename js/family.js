/**
 * 亲子共读对话 — family.js
 * 慧惠引导的亲子《道德经》共读体验
 * P0 最小可用版本：3 章 × 3 年龄段 = 9 组对话模板
 * 
 * 设计约束：
 * - 慧惠是陪伴者，非老师/测试官
 * - 全程无"你应该"句式，只有开放式提问
 * - 一个话题 → 一个提问 → 等待回应
 * - 每次发言不超过 5 句话
 * - 对话超过 10 轮自动结束
 * - 家长可随时结束或切换话题
 */

/* ============================================================
   一、对话模板
   注意：中文引号统一使用「」角括号，避免与 JS 字符串定界符冲突
   ============================================================ */

var DIALOGUE_TEMPLATES = {

    "chapter8": {
        "title": "第8章 · 上善若水",
        "subtitle": "最高的善，像水一样",
        "icon": "💧",
        "age_4_6": {
            "intro": "今天想和你一起读《道德经》里关于「水」的一段话。<br>准备好了吗？我们开始吧。",
            "rounds": [
                {
                    "huihui": "老子说：最高的善，就像水一样。你觉得水有什么厉害的地方？",
                    "hint": "（引导孩子自由回答——水能喝、能洗澡、能变成雨、能在河里游泳……不用纠正，听听 ta 怎么说）"
                },
                {
                    "huihui": "对啊！水能变成冰、变成汽、变成雨。它不跟任何东西抢——可它去哪儿都能找到路。你能学一句水流的声音吗？",
                    "hint": "（和孩子一起模仿：哗啦啦、滴滴答、咕噜咕噜……开心就好）"
                },
                {
                    "huihui": "今天洗澡的时候，你和水做一次朋友。告诉它你今天开心的事。下次我们再聊。",
                    "hint": ""
                }
            ]
        },
        "age_7_9": {
            "intro": "今天想和你一起读《道德经》里关于「水」的一段话——老子说「上善若水」。<br>我们一起来聊聊水的智慧。",
            "rounds": [
                {
                    "huihui": "老子说「上善若水」——最高的善，像水一样。水每天都在帮我们：喝的水、洗澡的水、下雨的水。但水从来不邀功。你觉得班上有没有这样的小朋友——做了好事但不说的？",
                    "hint": "（让孩子自己说。如果一时想不起来，家长可以先讲一个身边的例子）"
                },
                {
                    "huihui": "老子还说，水总往低处流。别人不喜欢去的地方，水去。这不是懦弱——是柔软的力量。柔能克刚。你身边有没有看起来很「软」，但其实很厉害的人？",
                    "hint": "（引导孩子思考：比如看起来温柔但内心很坚强的同学，或者平时话不多但总能帮助别人的朋友）"
                },
                {
                    "huihui": "今天你和爸爸妈妈聊一聊：我们家的「水」是谁？下次告诉我。",
                    "hint": ""
                }
            ]
        },
        "age_10_12": {
            "intro": "今天我们一起读《道德经》第8章。<br>这一章用「水」来比喻最高的善，非常经典。<br>准备好了吗？",
            "rounds": [
                {
                    "huihui": "「上善若水，水善利万物而不争，处众人之所恶，故几于道。」这段话里，老子用了三个关键词：善、利、不争。你觉得「不争」是什么意思？不争就是输吗？",
                    "hint": "（让孩子自由表达。关键在于：「不争」不等于「不努力」或「放弃」——水不争，但水能穿石）"
                },
                {
                    "huihui": "老子用水来比喻「道」——看不见、摸不着，却无处不在。你能想到生活中有没有类似「水」的东西？看起来不起眼，但没了它完全不行？",
                    "hint": "（引导孩子联想：空气、时间、信任、爱……这些东西看不见，但比看得见的东西更重要）"
                },
                {
                    "huihui": "这一章的深意，你可以和爸爸妈妈慢慢聊。也许需要一个月，也许需要一年。不着急。",
                    "hint": ""
                }
            ]
        }
    },

    "chapter1": {
        "title": "第1章 · 道可道，非常道",
        "subtitle": "真正的道，说不出来",
        "icon": "🌌",
        "age_4_6": {
            "intro": "今天我们一起读《道德经》的第一句话：「道可道，非常道」。<br>这句话就是说——真正重要的事情，常常是说不出来的。<br>我们来做一个好玩的实验。",
            "rounds": [
                {
                    "huihui": "你最喜欢的味道是什么？甜？酸？还是妈妈做的菜的香味？",
                    "hint": "（让孩子说出最喜欢的味道。不管说什么，都认真听）"
                },
                {
                    "huihui": "嗯，你能说出「甜」这个字，但你说不出「甜是什么感觉」，对不对？有些东西，心里清清楚楚，嘴巴说不出。",
                    "hint": "（可以和孩子一起做个小实验：尝一口糖，然后试着用语言描述那个感觉——会很有趣）"
                },
                {
                    "huihui": "今天，你去找一个「只能感觉、说不出」的东西。明天告诉我，你找到了什么？",
                    "hint": ""
                }
            ]
        },
        "age_7_9": {
            "intro": "今天我们一起读《道德经》的第一句话：「道可道，非常道」。<br>能说出来的道，就不是真正的道——听起来有点绕？<br>没关系，我们来做一个有趣的思考实验。",
            "rounds": [
                {
                    "huihui": "想象一下：你要告诉一个外星人什么是「红色」，你会怎么说？",
                    "hint": "（和孩子一起头脑风暴：「像太阳」——外星人没见过太阳。「像火」——外星人不知道火。看孩子能想到多少种说法，然后发现：没有一个说法能完整说出「红色」的感觉）"
                },
                {
                    "huihui": "你看，有些东西你自己心里清清楚楚，但用语言怎么都说不明白。你有过这种感觉吗？比如，你最好的朋友为什么是你最好的朋友——你能说清楚吗？",
                    "hint": "（让孩子自己说说看。你会发现，孩子可能会说出很多理由，但最核心的那个「感觉」，还是说不出来）"
                },
                {
                    "huihui": "今天回去想一想：有什么事情，你不需要说出来，爸爸妈妈就知道的？",
                    "hint": ""
                }
            ]
        },
        "age_10_12": {
            "intro": "今天我们一起读《道德经》的开篇：「道可道，非常道」。<br>老子一开篇就说——真正的道，无法用语言完全描述。<br>这是一个非常深刻的哲学命题。我们一起来探索。",
            "rounds": [
                {
                    "huihui": "「道可道，非常道」——老子一开篇就说：真正的道，无法用语言完全描述。你觉得为什么？语言有什么局限？",
                    "hint": "（引导孩子思考：有些体验只能亲自经历才懂——「甜」不是「甜」这个词本身，而是舌尖上的那个感觉）"
                },
                {
                    "huihui": "拥抱是什么感觉？温暖、安心、被爱……这些词说完了，拥抱的「感觉」还是没说出来。老子说「道」就是这样——比语言更大、更深。你同意吗？",
                    "hint": "（可以和孩子一起列举：还有哪些事情是「说出来」和「真正经历」完全不一样的？比如：看日出、第一次骑自行车……）"
                },
                {
                    "huihui": "有一个有趣的问题：如果「道」说不出来，那老子为什么还写了五千字？他到底在做什么？和爸爸妈妈聊聊这个问题。",
                    "hint": ""
                }
            ]
        }
    },

    "chapter2": {
        "title": "第2章 · 天下皆知美之为美",
        "subtitle": "美和丑，谁也离不开谁",
        "icon": "☯️",
        "age_4_6": {
            "intro": "今天我们来读《道德经》第二章。<br>这一章讲的是一个有趣的发现：如果没有「矮」，「高」还是高吗？<br>一起来想想。",
            "rounds": [
                {
                    "huihui": "老子说：如果大家都知道了什么是「美」，那「丑」也就出现了。你想想看——如果没有「矮」这个词，「高」还是高吗？",
                    "hint": "（让孩子自己想一想。可以一起站在镜子前：「你比爸爸矮，但比弟弟妹妹高——那你是高还是矮？」）"
                },
                {
                    "huihui": "高和矮、长和短、大和小——这些词像一对好朋友，谁也离不开谁。你能再找一对这样的「好朋友」吗？",
                    "hint": "（提示：快和慢、轻和重、冷和热、白天和黑夜……和孩子比赛，看谁找得多）"
                },
                {
                    "huihui": "今天你去找一个「看起来不一样、但其实缺一不可」的东西。下次告诉我你找到了什么。",
                    "hint": ""
                }
            ]
        },
        "age_7_9": {
            "intro": "今天我们来读《道德经》第二章。<br>老子说——美和丑、高和矮、长和短，这些对立的词，其实谁也离不开谁。<br>听起来有点绕？我们一起来解开这个谜。",
            "rounds": [
                {
                    "huihui": "老子说：天下都知道美是美，丑就出现了。你知道高是高的同时，也就知道了什么是矮。你觉得——如果一个世界里所有人都一样高，「高」这个词还有意义吗？",
                    "hint": "（让孩子自己推理：如果没有「矮」做对比，「高」这个概念就不存在了。这是一个很重要的哲学发现）"
                },
                {
                    "huihui": "我们再想一个更深的：如果你从没哭过，你还会觉得笑很特别吗？开心和难过，其实是一对「必须在一起」的感觉。你有过这种感觉吗——因为难过过，才更珍惜开心？",
                    "hint": "（让孩子分享自己的经历。也许是一次考试没考好之后的进步，也许是和朋友吵架又和好之后的更亲密）"
                },
                {
                    "huihui": "今天想一想：你的班里，有没有哪个同学看起来和你很不一样？他的「不一样」，有没有让你的班级变得更有趣？",
                    "hint": ""
                }
            ]
        },
        "age_10_12": {
            "intro": "今天我们来读《道德经》第二章：「天下皆知美之为美，斯恶已。」<br>这句话提出了一个非常重要的思想——对立的东西，其实是互相定义的。<br>这可能是《道德经》里最深刻的思想之一。我们一起来探讨。",
            "rounds": [
                {
                    "huihui": "「天下皆知美之为美，斯恶已。」老子说：美和丑、善和恶、有和无——这些对立的东西，其实是互相定义的。你同意吗？能不能举一个你生活中的例子？",
                    "hint": "（让孩子举自己的例子。比如：「考第一名」之所以有意义，是因为有人考了第二名；「快」之所以有意义，是因为有「慢」作参照）"
                },
                {
                    "huihui": "老子还说「有无相生，难易相成」——「有」和「无」互相生出对方，「难」和「易」互相成就。你觉得：学习一个很难的东西，和学会之后的「容易」，是什么关系？",
                    "hint": "（引导思考：正是因为「难」，学会之后的「容易」才有成就感。没有「难」，「容易」就毫无意义。这是辩证法的核心思想）"
                },
                {
                    "huihui": "最后一个问题：如果全班同学都和你一模一样——穿一样的衣服、说一样的话、喜欢一样的东西——会怎样？你是不是有点庆幸：还好我们不一样？",
                    "hint": ""
                }
            ]
        }
    }
};


/* ============================================================
   二、告别语模板（按年龄段）
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

/* 自动结束语 */
var AUTO_END_MESSAGE = {
    "4-6": "我们今天聊了这么多有趣的东西！该休息一下啦。下次我们再一起读《道德经》，好不好？去给爸爸妈妈一个大大的拥抱吧！",
    "7-9": "今天聊了这么多，你的小脑袋一定很累了。该休息一下了。《道德经》里还有好多故事等着我们，不急，慢慢来。下次见！",
    "10-12": "我们已经聊了十轮了，今天的思想之旅很丰盛。老子说「少则得，多则惑」——少一点，反而收获更多。今天就到这里，保持你的好奇心，下次我们继续探索。再见！"
};


/* ============================================================
   三、状态管理
   ============================================================ */

var state = {
    stage: 'welcome',      // 'welcome' | 'intro' | 'dialogue' | 'chapter_end' | 'ended'
    age: null,              // '4-6' | '7-9' | '10-12'
    chapter: 'chapter8',    // 当前章节 key
    roundIndex: 0,          // 当前章节内的轮次
    totalRounds: 0,         // 总轮数（跨章节累计）
    maxRounds: 10,          // 最大轮数
    chaptersDone: []        // 已完成章节列表
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

function appendHuihuiMessage(text, hint) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-huihui';
    bubble.innerHTML = '<p>' + text + '</p>';
    if (hint) {
        bubble.innerHTML += '<span class="chat-hint">' + hint + '</span>';
    }
    dialogueEl.appendChild(bubble);
    scrollToBottom();
}

function appendUserMessage(text) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-user';
    bubble.innerHTML = '<p>' + text + '</p>';
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
    var tpl = DIALOGUE_TEMPLATES[chapterKey];
    var card = document.createElement('div');
    card.className = 'chapter-intro-card';
    card.innerHTML =
        '<div class="chapter-icon">' + tpl.icon + '</div>' +
        '<div class="chapter-title">' + tpl.title + '</div>' +
        '<div class="chapter-subtitle">' + tpl.subtitle + '</div>';
    dialogueEl.appendChild(card);
    scrollToBottom();
}

function scrollToBottom() {
    requestAnimationFrame(function () {
        dialogueEl.scrollTop = dialogueEl.scrollHeight;
    });
}

function setInputEnabled(enabled) {
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


/* ============================================================
   六、对话流程控制
   ============================================================ */

function showWelcome() {
    state.stage = 'welcome';
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
    state.stage = 'intro';

    // 立即隐藏整个欢迎区（头像 + 问候语 + 年龄按钮）
    welcomeEl.style.display = 'none';

    setActionButtonsEnabled(true);
    startChapter();
}

function startChapter() {
    var tpl = DIALOGUE_TEMPLATES[state.chapter];
    var ageKey = 'age_' + state.age.replace('-', '_');
    var ageData = tpl[ageKey];

    state.roundIndex = 0;
    state.stage = 'intro';

    appendChapterCard(state.chapter);
    appendHuihuiMessage(ageData.intro, '');

    setTimeout(function () {
        sendNextRound();
    }, 1200);
}

function sendNextRound() {
    var tpl = DIALOGUE_TEMPLATES[state.chapter];
    var ageKey = 'age_' + state.age.replace('-', '_');
    var ageData = tpl[ageKey];

    if (state.roundIndex >= ageData.rounds.length) {
        endChapter();
        return;
    }

    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

    var round = ageData.rounds[state.roundIndex];
    state.roundIndex++;
    state.totalRounds++;
    state.stage = 'dialogue';

    appendHuihuiMessage(round.huihui, round.hint);
    setInputEnabled(true);
    userInputEl.focus();
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
    var chapters = ['chapter8', 'chapter1', 'chapter2'];
    var html = '';
    for (var i = 0; i < chapters.length; i++) {
        var key = chapters[i];
        var tpl = DIALOGUE_TEMPLATES[key];
        var done = state.chaptersDone.indexOf(key) !== -1;
        html +=
            '<div class="chapter-card" data-chapter="' + key + '">' +
            '<div class="card-chapter-num">' + (done ? '✓ 已读 · ' : '') + tpl.icon + '</div>' +
            '<div class="card-chapter-title">' + tpl.title + '</div>' +
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
    appendHuihuiMessage(msg, '');

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
    appendHuihuiMessage(msg, '');

    setInputEnabled(false);
    setActionButtonsEnabled(false);
    userInputEl.placeholder = '感谢你和孩子的参与 🌿';

    scrollToBottom();
}


/* ============================================================
   七、事件处理
   ============================================================ */

sendBtnEl.addEventListener('click', function () {
    if (state.stage !== 'dialogue') return;
    if (sendBtnEl.disabled) return;

    var text = userInputEl.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInputEl.value = '';
    setInputEnabled(false);

    if (state.totalRounds >= state.maxRounds) {
        autoEndSession();
        return;
    }

    setTimeout(function () {
        sendNextRound();
    }, 600 + Math.random() * 400);
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
   八、初始化
   ============================================================ */

(function init() {
    showWelcome();
})();
