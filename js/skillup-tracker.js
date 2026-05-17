/**
 * SkillUP 认知成长追踪器
 * 版本：v2.0
 * 职责：学习数据追踪、水德四阶段成长模型、动态反馈触发
 *
 * 数据存储：localStorage（key: skillup_data）
 * 设计约束：零评分、零排名、零比较（遵从慧惠产品宪法第七条、第十四条）
 *
 * 设计依据：docs/SkillUP 层设计方案 · 第一期：认知成长追踪与动态反馈.md
 */
(function () {
    'use strict';

    // ===== 常量 =====
    var STORAGE_KEY = 'skillup_data';
    var CONSENT_KEY = 'skillup_consent';
    var TRACKING_KEY = 'skillup_tracking';

    // ===== 水德四阶段成长模型（§2） =====
    var STAGES = {
        '水滴': { name: '水滴', min: 0, max: 10, icon: '💧', desc: '初探道德经，每一章都是新发现。' },
        '溪流': { name: '溪流', min: 11, max: 30, icon: '💦', desc: '积累与串联，老子的话语开始慢慢汇入你的生活。' },
        '江河': { name: '江河', min: 31, max: 60, icon: '🌊', desc: '实践与思辨，你开始从不同角度理解和应用老子的智慧。' },
        '江海': { name: '江海', min: 61, max: Infinity, icon: '🪷', desc: '贯通与分享，你在《道德经》的世界里自由徜徉。' }
    };

    var STAGE_ORDER = ['水滴', '溪流', '江河', '江海'];

    // 核心术语关键词（用于从用户消息中提取 keyword）
    var CORE_KEYWORDS = [
        '道', '德', '无为', '自然', '柔弱', '不争', '上善若水', '知足', '虚静',
        '玄牝', '谷神', '守中', '无欲', '为道', '为学', '自知', '自胜',
        '知人者智', '自知者明', '大器晚成', '大象无形', '大音希声',
        '道法自然', '清静', '寡欲', '见素抱朴', '少私寡欲',
        '天人合一', '致虚极', '守静笃', '万物并作', '各复归其根',
        '有生于无', '负阴抱阳', '和光同尘', '长生久视', '治大国若烹小鲜',
        '千里之行始于足下', '天网恢恢疏而不失', '信言不美美言不信'
    ];

    // ===== 默认数据结构（§3.1） =====
    function createDefaultData() {
        return {
            uid: '',
            lastVisit: null,
            dailyVisits: [],              // 每日访问日期数组 ['2026-05-10', '2026-05-12']
            chaptersVisited: [],          // 已访问章节列表 ['ch01', 'ch08', 'ch02']
            totalChaptersRead: 0,         // 独立计数字段
            currentStage: '水滴',         // 中文阶段名
            levelHistory: [],             // [{ date: '2026-05-10', level: 'L1' }, ...]
            questions: [],                // [{ chapter: 'ch08', level: 'L2', keyword: '无为', timestamp: '...' }]
            trackingEnabled: false,
            // 阶段追踪（v2.0 新增）
            stageHistory: [],             // [{ from: '水滴', to: '溪流', timestamp: '...', trigger: '...' }]
            lastStageCheck: null,         // ISO 8601 上次阶段检查时间
            // 81章完成纪念（v2.0 新增）
            allChaptersCompleted: false,
            allChaptersCompletedAt: null  // ISO 8601 完成时间戳
        };
    }

    // ===== 数据加载与保存 =====
    function loadData() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var data = JSON.parse(raw);
                // 兼容旧版数据：确保必要字段存在
                if (!data.dailyVisits) data.dailyVisits = [];
                if (!Array.isArray(data.chaptersVisited)) data.chaptersVisited = [];
                if (typeof data.totalChaptersRead !== 'number') data.totalChaptersRead = data.chaptersVisited.length;
                if (!data.currentStage || STAGE_ORDER.indexOf(data.currentStage) === -1) data.currentStage = '水滴';
                if (!Array.isArray(data.levelHistory)) data.levelHistory = [];
                if (!Array.isArray(data.questions)) data.questions = [];
                if (!data.lastVisit) data.lastVisit = null;
                // v2.0 新增字段兼容
                if (!Array.isArray(data.stageHistory)) data.stageHistory = [];
                if (!data.lastStageCheck) data.lastStageCheck = null;
                if (typeof data.allChaptersCompleted !== 'boolean') data.allChaptersCompleted = false;
                if (!data.allChaptersCompletedAt) data.allChaptersCompletedAt = null;
                if (data.chapterVisits && !Array.isArray(data.chaptersVisited)) {
                    // 从旧版对象格式迁移到新版数组格式
                    data.chaptersVisited = Object.keys(data.chapterVisits).map(function (k) {
                        return 'ch' + (k.length === 1 ? '0' + k : k);
                    });
                    delete data.chapterVisits;
                }
                if (data.messages && data.messages.length > 0) {
                    // 从旧版 messages 迁移到 questions
                    for (var i = 0; i < data.messages.length; i++) {
                        var m = data.messages[i];
                        data.questions.push({
                            chapter: null,
                            level: m.level || 'L2',
                            keyword: extractKeyword(m.text || ''),
                            timestamp: m.at || new Date().toISOString()
                        });
                    }
                    delete data.messages;
                }
                return data;
            }
        } catch (e) {
            // 数据损坏，重置
        }
        return createDefaultData();
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage 满或不可用，静默失败
        }
    }

    // ===== 用户许可 =====
    function hasConsent() {
        return localStorage.getItem(CONSENT_KEY) === '1';
    }

    function giveConsent() {
        localStorage.setItem(CONSENT_KEY, '1');
    }

    function revokeConsent() {
        localStorage.removeItem(CONSENT_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TRACKING_KEY);
    }

    function isTrackingEnabled() {
        return hasConsent() && localStorage.getItem(TRACKING_KEY) !== '0';
    }

    function enableTracking() {
        localStorage.setItem(TRACKING_KEY, '1');
    }

    function disableTracking() {
        localStorage.setItem(TRACKING_KEY, '0');
    }

    // ===== 当前章节检测 =====
    function detectCurrentChapter() {
        var path = window.location.pathname;
        // /chapters/8 或 /chapters/ch08.html
        var chapMatch = path.match(/\/chapters\/(?:ch)?(\d+)/);
        if (chapMatch) {
            return parseInt(chapMatch[1], 10);
        }
        // query 参数
        try {
            var params = new URLSearchParams(window.location.search);
            var ch = params.get('chapter');
            if (ch) {
                return parseInt(ch, 10);
            }
        } catch (e) {}
        return null;
    }

    function chapterKey(num) {
        if (!num || num < 1 || num > 81) return null;
        return 'ch' + (num < 10 ? '0' + num : String(num));
    }

    // ===== 当前认知水平检测 =====
    function detectCurrentLevel() {
        return localStorage.getItem('huihui_taoism_level') || 'L2';
    }

    // ===== 关键词提取 =====
    function extractKeyword(text) {
        if (!text) return '';
        for (var i = 0; i < CORE_KEYWORDS.length; i++) {
            if (text.indexOf(CORE_KEYWORDS[i]) !== -1) {
                return CORE_KEYWORDS[i];
            }
        }
        return '';
    }

    // ===== 连续天数检测 =====
    function calcConsecutiveDays(dailyVisits) {
        if (!dailyVisits || dailyVisits.length === 0) return 0;

        // 排序日期字符串
        var sorted = dailyVisits.slice().sort();
        var today = getTodayStr();
        var yesterday = getDateStr(new Date(Date.now() - 86400000));

        // 最近一次访问必须是今天或昨天，否则连续性已断
        var lastVisit = sorted[sorted.length - 1];
        if (lastVisit !== today && lastVisit !== yesterday) return 0;

        // 从最近日期往前数连续天数
        var consecutive = 1;
        for (var i = sorted.length - 2; i >= 0; i--) {
            var prev = new Date(sorted[i + 1]);
            prev.setDate(prev.getDate() - 1);
            if (getDateStr(prev) === sorted[i]) {
                consecutive++;
            } else {
                break;
            }
        }
        return consecutive;
    }

    function getTodayStr() {
        return getDateStr(new Date());
    }

    function getDateStr(date) {
        var y = date.getFullYear();
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    // ===== 阶段判定（§2）— v2.0 升级：章节数 + 认知深度 + 提问次数 =====
    function calculateStage(learningData) {
        var chaptersRead = (learningData.chaptersVisited || []).length;
        var hasL2 = (learningData.levelHistory || []).some(function (h) { return h.level === 'L2'; });
        var hasL3 = (learningData.levelHistory || []).some(function (h) { return h.level === 'L3'; });
        var hasL4 = (learningData.levelHistory || []).some(function (h) { return h.level === 'L4'; });
        var questionCount = (learningData.questions || []).length;

        // 江海：覆盖 ≥60 章，且使用过 L4 模式，提问 ≥10 次
        if (chaptersRead >= 60 && hasL4 && questionCount >= 10) {
            return '江海';
        }
        // 江河：覆盖 ≥30 章，且使用过 L3 模式，提问 ≥5 次
        if (chaptersRead >= 30 && hasL3 && questionCount >= 5) {
            return '江河';
        }
        // 溪流：覆盖 ≥10 章，且使用过 L2 模式
        if (chaptersRead >= 10 && hasL2) {
            return '溪流';
        }
        // 水滴：默认阶段
        return '水滴';
    }

    /**
     * 阶段跃迁记录（内部使用）
     * 阶段只升不降，仅在跃迁时写入 stageHistory
     */
    function recordStageTransition(data, oldStage, newStage, trigger) {
        var oldIdx = STAGE_ORDER.indexOf(oldStage);
        var newIdx = STAGE_ORDER.indexOf(newStage);
        // 只升不降
        if (newIdx <= oldIdx) return;

        data.stageHistory.push({
            from: oldStage,
            to: newStage,
            timestamp: new Date().toISOString(),
            trigger: trigger
        });
    }

    /**
     * 81 章完成检测（内部使用）
     */
    function checkAllChaptersCompleted(data) {
        if (data.chaptersVisited.length === 81 && !data.allChaptersCompleted) {
            data.allChaptersCompleted = true;
            data.allChaptersCompletedAt = new Date().toISOString();
        }
    }

    // ===== 章节访问记录 =====
    function recordChapterVisit() {
        if (!isTrackingEnabled()) return null;

        var chapter = detectCurrentChapter();
        if (!chapter || chapter < 1 || chapter > 81) return null;

        var data = loadData();
        var key = chapterKey(chapter);
        var now = new Date().toISOString();
        var today = getTodayStr();

        // 更新 lastVisit
        data.lastVisit = now;

        // 记录每日访问
        if (data.dailyVisits.indexOf(today) === -1) {
            data.dailyVisits.push(today);
            // 限制保留最近 200 天
            if (data.dailyVisits.length > 200) {
                data.dailyVisits = data.dailyVisits.slice(-200);
            }
        }

        // 记录章节访问（数组去重）
        if (data.chaptersVisited.indexOf(key) === -1) {
            data.chaptersVisited.push(key);
        }

        // 更新 totalChaptersRead（独立字段）
        data.totalChaptersRead = data.chaptersVisited.length;

        // 更新阶段（v2.0: 使用 calculateStage，包含认知深度和提问次数）
        var oldStage = data.currentStage;
        data.currentStage = calculateStage(data);
        data.lastStageCheck = new Date().toISOString();

        // 阶段跃迁记录（只升不降）
        if (oldStage !== data.currentStage) {
            recordStageTransition(data, oldStage, data.currentStage,
                'chaptersRead=' + data.totalChaptersRead +
                ' hasL2=' + data.levelHistory.some(function(h){return h.level==='L2';}) +
                ' hasL3=' + data.levelHistory.some(function(h){return h.level==='L3';}) +
                ' hasL4=' + data.levelHistory.some(function(h){return h.level==='L4';}) +
                ' questions=' + data.questions.length
            );
        }

        // 81 章完成检测
        checkAllChaptersCompleted(data);

        saveData(data);

        // 构建返回结果
        var result = {
            totalChaptersRead: data.totalChaptersRead,
            currentStage: data.currentStage,
            consecutiveDays: calcConsecutiveDays(data.dailyVisits)
        };

        if (oldStage !== data.currentStage) {
            result.stageChanged = true;
            result.newStage = data.currentStage;
            result.oldStage = oldStage;
        }

        return result;
    }

    // ===== 按章节号直接记录访问（供外部模块如 family.js 调用） =====
    function recordChapterVisitByNum(chapterNum) {
        if (!isTrackingEnabled()) return null;
        if (!chapterNum || chapterNum < 1 || chapterNum > 81) return null;

        var data = loadData();
        var key = chapterKey(chapterNum);
        var now = new Date().toISOString();
        var today = getTodayStr();

        // 更新 lastVisit
        data.lastVisit = now;

        // 记录每日访问
        if (data.dailyVisits.indexOf(today) === -1) {
            data.dailyVisits.push(today);
            if (data.dailyVisits.length > 200) {
                data.dailyVisits = data.dailyVisits.slice(-200);
            }
        }

        // 记录章节访问（数组去重）
        if (data.chaptersVisited.indexOf(key) === -1) {
            data.chaptersVisited.push(key);
        }

        // 更新 totalChaptersRead
        data.totalChaptersRead = data.chaptersVisited.length;

        // 更新阶段（v2.0: 使用 calculateStage）
        var oldStage = data.currentStage;
        data.currentStage = calculateStage(data);
        data.lastStageCheck = new Date().toISOString();

        // 阶段跃迁记录（只升不降）
        if (oldStage !== data.currentStage) {
            recordStageTransition(data, oldStage, data.currentStage,
                'chaptersRead=' + data.totalChaptersRead +
                ' hasL2=' + data.levelHistory.some(function(h){return h.level==='L2';}) +
                ' hasL3=' + data.levelHistory.some(function(h){return h.level==='L3';}) +
                ' hasL4=' + data.levelHistory.some(function(h){return h.level==='L4';}) +
                ' questions=' + data.questions.length
            );
        }

        // 81 章完成检测
        checkAllChaptersCompleted(data);

        saveData(data);

        var result = {
            totalChaptersRead: data.totalChaptersRead,
            currentStage: data.currentStage,
            consecutiveDays: calcConsecutiveDays(data.dailyVisits)
        };

        if (oldStage !== data.currentStage) {
            result.stageChanged = true;
            result.newStage = data.currentStage;
            result.oldStage = oldStage;
        }

        return result;
    }

    // ===== 认知水平切换记录 =====
    function recordLevelSwitch(fromLevel, toLevel) {
        if (!isTrackingEnabled()) return;
        if (!fromLevel || !toLevel || fromLevel === toLevel) return;

        var data = loadData();
        data.levelHistory.push({
            date: new Date().toISOString().split('T')[0],
            level: toLevel
        });

        // 限制历史记录条数（最近 200 条）
        if (data.levelHistory.length > 200) {
            data.levelHistory = data.levelHistory.slice(-200);
        }

        saveData(data);
    }

    // ===== 聊天消息记录（§3.1 questions 数据模型） =====
    function recordMessage(text, level, chapterNum) {
        if (!isTrackingEnabled()) return;
        if (!text || text.trim().length === 0) return;

        var data = loadData();
        // 优先使用传入的 chapterNum，其次从 URL 检测
        var chapter = chapterNum || detectCurrentChapter();
        var keyword = extractKeyword(text);

        data.questions.push({
            chapter: chapter ? chapterKey(chapter) : null,
            level: level || detectCurrentLevel(),
            keyword: keyword,
            timestamp: new Date().toISOString()
        });

        // 限制历史记录条数（最近 500 条）
        if (data.questions.length > 500) {
            data.questions = data.questions.slice(-500);
        }

        saveData(data);
    }

    // ===== 获取成长摘要（供 UI 和聊天查询使用） =====
    function getGrowthSummary() {
        var data = loadData();
        var summary = {
            currentStage: data.currentStage,
            totalChaptersRead: data.totalChaptersRead,
            consecutiveDays: calcConsecutiveDays(data.dailyVisits),
            messageCount: data.questions.length,
            switchCount: data.levelHistory.length,
            trackingEnabled: isTrackingEnabled()
        };

        // 当前阶段信息
        var stage = STAGES[data.currentStage] || STAGES['水滴'];
        summary.stageIcon = stage.icon;
        summary.stageName = stage.name;
        summary.stageDesc = stage.desc;

        // 最近阅读的章节
        if (data.chaptersVisited.length > 0) {
            var recent = data.chaptersVisited.slice(-5);
            summary.recentChapters = recent.map(function (k) {
                return parseInt(k.replace('ch', ''), 10);
            });
        } else {
            summary.recentChapters = [];
        }

        // 认知水平偏好
        var levelCounts = { L1: 0, L2: 0, L3: 0, L4: 0 };
        data.levelHistory.forEach(function (h) {
            if (levelCounts.hasOwnProperty(h.level)) levelCounts[h.level]++;
        });
        var preferredLevel = 'L2';
        var maxCount = 0;
        Object.keys(levelCounts).forEach(function (l) {
            if (levelCounts[l] > maxCount) {
                maxCount = levelCounts[l];
                preferredLevel = l;
            }
        });
        summary.preferredLevel = preferredLevel;

        // 最新认知水平
        if (data.levelHistory.length > 0) {
            summary.latestLevel = data.levelHistory[data.levelHistory.length - 1].level;
        } else {
            summary.latestLevel = detectCurrentLevel();
        }

        // 提取用户使用过的核心概念
        var keywords = {};
        data.questions.forEach(function (q) {
            if (q.keyword) {
                keywords[q.keyword] = (keywords[q.keyword] || 0) + 1;
            }
        });
        var keywordList = Object.keys(keywords).sort(function (a, b) {
            return keywords[b] - keywords[a];
        });
        summary.keywords = keywordList.slice(0, 5);
        summary.keywordCount = keywordList.length;

        // 第一个核心概念
        summary.firstKeyword = keywordList.length > 0 ? keywordList[0] : null;

        // 概念关联检测（同一消息含多个关键词）
        var associations = [];
        data.questions.forEach(function (q) {
            if (q.keyword && associations.indexOf(q.keyword) === -1) {
                associations.push(q.keyword);
            }
        });
        summary.hasAssociation = associations.length >= 2;

        // v2.0 新增：阶段跃迁历史
        summary.stageHistory = data.stageHistory || [];

        // v2.0 新增：81章完成状态
        summary.allChaptersCompleted = data.allChaptersCompleted || false;
        summary.allChaptersCompletedAt = data.allChaptersCompletedAt || null;

        // v2.0 新增：上次阶段检查时间
        summary.lastStageCheck = data.lastStageCheck || null;

        // v2.0 Phase 2: 认知深度使用次数统计
        var levelUse = { L1: 0, L2: 0, L3: 0, L4: 0 };
        data.levelHistory.forEach(function (h) {
            if (levelUse.hasOwnProperty(h.level)) levelUse[h.level]++;
        });
        summary.levelUse = levelUse;

        // v2.0 Phase 2: 认知深度向上切换次数（L1→L2 / L2→L3 / L3→L4）
        var upTransitions = { 'L1→L2': 0, 'L2→L3': 0, 'L3→L4': 0 };
        for (var i = 1; i < data.levelHistory.length; i++) {
            var prev = data.levelHistory[i - 1].level;
            var curr = data.levelHistory[i].level;
            var key = prev + '→' + curr;
            if (upTransitions.hasOwnProperty(key)) upTransitions[key]++;
        }
        summary.upTransitions = upTransitions;

        // v2.0 Phase 2: 最爱章节（访问次数最多的章节）
        var chapterCounts = {};
        data.chaptersVisited.forEach(function (ch) {
            chapterCounts[ch] = (chapterCounts[ch] || 0) + 1;
        });
        var favEntries = Object.keys(chapterCounts).sort(function (a, b) {
            return chapterCounts[b] - chapterCounts[a];
        });
        summary.favChapter = favEntries.length > 0 ? favEntries[0] : null;
        summary.favChapterCount = favEntries.length > 0 ? chapterCounts[favEntries[0]] : 0;

        // v2.0 Phase 2: 第一条和最后一条提问
        if (data.questions.length > 0) {
            var firstQ = data.questions[0];
            var lastQ = data.questions[data.questions.length - 1];
            summary.firstQuestion = firstQ.keyword || (firstQ.text ? firstQ.text.substring(0, 20) : null);
            summary.firstQuestionChapter = firstQ.chapter || null;
            summary.lastQuestion = lastQ.keyword || (lastQ.text ? lastQ.text.substring(0, 20) : null);
            summary.lastQuestionChapter = lastQ.chapter || null;
        } else {
            summary.firstQuestion = null;
            summary.lastQuestion = null;
        }

        return summary;
    }

    // ===== 触发规则检测（§4.1 四条触发规则） =====

    /**
     * 规则1：首次阅读第8章后
     * 条件：chaptersVisited.length >= 3 且 currentStage === '水滴'
     */
    function checkTriggerCh8Milestone() {
        var data = loadData();
        if (data.currentStage !== '水滴') return null;
        if (data.totalChaptersRead < 3) return null;

        // 检查是否已触发过（避免重复）
        if (data._triggeredCh8) return null;

        data._triggeredCh8 = true;
        saveData(data);

        return {
            type: 'ch8_milestone',
            message: '你已经读了三章了。有没有感觉到，老子的智慧像水一样，开始慢慢流进了你的生活？'
        };
    }

    /**
     * 规则2：切换到L3提问后
     * 条件：levelHistory 中最新记录为 L3 且 currentStage === '溪流'
     */
    function checkTriggerL3Switch() {
        var data = loadData();
        if (data.currentStage !== '溪流') return null;
        if (data.levelHistory.length === 0) return null;

        var latest = data.levelHistory[data.levelHistory.length - 1];
        if (latest.level !== 'L3') return null;

        // 检查是否已触发过
        if (data._triggeredL3) return null;

        data._triggeredL3 = true;
        saveData(data);

        return {
            type: 'l3_switch',
            message: '你开始从"怎么做"的角度思考了。这是从"知道"到"做到"的重要一步。要不要试试第33章？那里有很多关于实践的建议。'
        };
    }

    /**
     * 规则3：连续三天访问网站
     * 条件：连续天数 >= 3
     */
    function checkTriggerConsecutiveDays() {
        var data = loadData();
        var consecutiveDays = calcConsecutiveDays(data.dailyVisits);

        if (consecutiveDays < 3) return null;

        // 检查今天是否已触发过
        var today = getTodayStr();
        if (data._triggeredConsecutive === today) return null;

        data._triggeredConsecutive = today;
        saveData(data);

        return {
            type: 'consecutive_days',
            message: '你已经是连续第' + consecutiveDays + '天来找我了。这份坚持本身就是一种修行。今天我们读哪一章？',
            days: consecutiveDays
        };
    }

    /**
     * 规则4：用户主动查询进度
     * 条件：用户发送"我学得怎么样了？"等查询
     */
    function checkProgressQuery(query) {
        var q = query.replace(/\s+/g, '').toLowerCase();
        var isProgressQuery =
            q.indexOf('我学得怎么样') !== -1 ||
            q.indexOf('我的成长') !== -1 ||
            q.indexOf('学习进度') !== -1 ||
            q.indexOf('学习情况') !== -1 ||
            q.indexOf('成长情况') !== -1 ||
            q.indexOf('学到哪') !== -1 ||
            q.indexOf('读了哪些') !== -1 ||
            q.indexOf('修行到哪') !== -1;

        if (!isProgressQuery) return null;

        var data = loadData();
        var stage = STAGES[data.currentStage] || STAGES['水滴'];

        if (data.totalChaptersRead === 0) {
            return {
                type: 'progress_query',
                message: '你才刚刚来到这片智慧之水边，还没开始读呢。想从哪一章开始？慧惠可以陪你一起探索。'
            };
        }

        var lines = [];
        lines.push(stage.icon + ' 你一共探索了 ' + data.totalChaptersRead + ' 章，');
        lines.push('现在正处于"' + stage.name + '"阶段。');

        var consecutive = calcConsecutiveDays(data.dailyVisits);
        if (consecutive >= 2) {
            lines.push('你已经连续 ' + consecutive + ' 天在读《道德经》了。');
        }

        // 提取常问的概念
        var keywords = {};
        data.questions.forEach(function (q) {
            if (q.keyword) {
                keywords[q.keyword] = (keywords[q.keyword] || 0) + 1;
            }
        });
        var topKeywords = Object.keys(keywords).sort(function (a, b) {
            return keywords[b] - keywords[a];
        }).slice(0, 3);

        if (topKeywords.length > 0) {
            lines.push('你最近在思考的概念：' + topKeywords.join('、') + '。');
        }

        lines.push('');
        if (data.totalChaptersRead <= 10) {
            lines.push('每个阶段都是独特的风景，不急。');
        } else if (data.totalChaptersRead <= 30) {
            lines.push('你的成长我看在眼里，像溪流汇入江河，自然而有力。');
        } else if (data.totalChaptersRead <= 60) {
            lines.push('老子说"上善若水"——你已经有了水的很多品性。继续走吧。');
        } else {
            lines.push('千里之行，始于足下。你已经走了很远。慧惠为你感到高兴。');
        }

        return {
            type: 'progress_query',
            message: lines.join('\n')
        };
    }

    // ===== 获取里程碑反馈消息（v3.0 更新：自然"顺带说一句"口吻） =====
    function getMilestoneMessage(event) {
        if (!event || !event.stageChanged) return null;

        var name = event.newStage;
        switch (name) {
            case '溪流':
                return '你好呀！今天想从哪一章开始？——顺带说一句，你已经读了10章了。从水滴汇成溪流，你开始用精读模式思考了。这正是成长的开始。';
            case '江河':
                return '你好呀！今天想从哪一章开始？——顺带说一句，你已经读了30章了。从溪流汇成江河，你知道这意味着什么吗？老子说"江海所以能为百谷王者，以其善下之"。你读得越多，越谦卑。这就是成长。';
            case '江海':
                return '你好呀！今天想从哪一章开始？——顺带说一句，你已经读了60章了。从江河汇入江海，百川归海，万物得道。你在《道德经》的世界里已经自由徜徉。';
            default:
                return null;
        }
    }

    // ===== 81章完成纪念欢迎语（§3.2） =====
    function getCompletionWelcomeMessage() {
        return '你好呀！我是慧惠。\n\n' +
            '你读完了《道德经》全部八十一章。\n\n' +
            '老子说："信言不美，美言不信。"\n' +
            '你读完了最后一章，但这不是结束。\n\n' +
            '老子的智慧像水——它已经流进了你的生活，\n' +
            '会在你不知道的时候，悄悄冒出来。\n\n' +
            '今天，你想从哪一章重新开始？';
    }

    // ===== 待展示动态反馈检测（v3.0 Phase 3） =====
    // 优先级：81章完成 > 阶段跃迁 > 常规规则
    function getPendingFeedback() {
        var data = loadData();

        // 优先：81章完成纪念
        if (data.allChaptersCompleted && !data._feedback81Shown) {
            data._feedback81Shown = true;
            // 同步标记阶段跃迁已展示，避免延后重复（§3.3 优先级规则）
            data._feedbackLastTransitionShown = new Date().toISOString();
            saveData(data);
            return { type: 'completion81', message: getCompletionWelcomeMessage() };
        }

        // 次优先：未展示的阶段跃迁
        if (data.stageHistory && data.stageHistory.length > 0) {
            var lastTransition = data.stageHistory[data.stageHistory.length - 1];
            var lastShown = data._feedbackLastTransitionShown || null;
            if (!lastShown || new Date(lastTransition.timestamp) > new Date(lastShown)) {
                data._feedbackLastTransitionShown = new Date().toISOString();
                saveData(data);
                var stageName = lastTransition.to;
                var msg = null;
                switch (stageName) {
                    case '江海':
                        msg = '你好呀！今天想从哪一章开始？——顺带说一句，你已经读了60章了。从江河汇入江海，百川归海，万物得道。你在《道德经》的世界里已经自由徜徉。';
                        break;
                    case '江河':
                        msg = '你好呀！今天想从哪一章开始？——顺带说一句，你已经读了30章了。从溪流汇成江河，你知道这意味着什么吗？老子说"江海所以能为百谷王者，以其善下之"。你读得越多，越谦卑。这就是成长。';
                        break;
                    case '溪流':
                        msg = '你好呀！今天想从哪一章开始？——顺带说一句，你已经读了10章了。从水滴汇成溪流，你开始用精读模式思考了。这正是成长的开始。';
                        break;
                }
                if (msg) {
                    return { type: 'stageTransition', message: msg, stage: stageName };
                }
            }
        }

        return null;
    }

    // ===== 章节页面引导语（§4.2） =====
    function getChapterGuidance() {
        var data = loadData();
        var stage = STAGES[data.currentStage] || STAGES['水滴'];
        var chapter = detectCurrentChapter();

        if (!chapter) return null;

        var guidance = {
            '水滴': '刚读完这一章？每一滴水珠都折射着智慧的光。休息一下，或者再读一章。',
            '溪流': '你已经在《道德经》中汇成了溪流。读完这一章，不妨想想它和前面章节的联系。',
            '江河': '江河奔涌，思辨之力渐生。这一章给你的生活带来了什么新的视角？',
            '江海': '海纳百川。读完这一章，你可以试着对比不同版本的解读，或者和慧惠讨论其中的哲学悖论。'
        };

        return {
            stage: stage.name,
            icon: stage.icon,
            message: guidance[data.currentStage] || guidance['水滴'],
            totalChaptersRead: data.totalChaptersRead
        };
    }

    // ===== 初始化 =====
    function init() {
        var data = loadData();

        // 设置 uid（与 huihui-chat 共享）
        if (!data.uid) {
            var huihuiUid = localStorage.getItem('huihui_uid');
            data.uid = huihuiUid || ('guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
        }

        // 记录本次访问日期（用于许可判断和连续天数追踪）
        var today = getTodayStr();
        if (data.dailyVisits.indexOf(today) === -1) {
            data.dailyVisits.push(today);
        }

        // 更新 lastVisit
        data.lastVisit = new Date().toISOString();

        saveData(data);

        // v2.0: 不再自动记录章节访问（文档3：章节页面浏览 ≠ 学习行为）
        // 章节记录由 family.js 和 huihui-chat.js 在用户主动行为时调用

        return {
            data: data,
            trackResult: null
        };
    }

    // ===== 公开 API =====
    window.SkillUP = {
        // 生命周期
        init: init,

        // 许可管理
        hasConsent: hasConsent,
        giveConsent: giveConsent,
        revokeConsent: revokeConsent,

        // 追踪控制
        isTrackingEnabled: isTrackingEnabled,
        enableTracking: enableTracking,
        disableTracking: disableTracking,

        // 数据记录
        recordChapterVisit: recordChapterVisit,
        recordChapterVisitByNum: recordChapterVisitByNum,
        recordLevelSwitch: recordLevelSwitch,
        recordMessage: recordMessage,

        // 查询
        getGrowthSummary: getGrowthSummary,
        getMilestoneMessage: getMilestoneMessage,
        getChapterGuidance: getChapterGuidance,
        getPendingFeedback: getPendingFeedback,
        getCompletionWelcomeMessage: getCompletionWelcomeMessage,
        detectCurrentLevel: detectCurrentLevel,
        detectCurrentChapter: detectCurrentChapter,
        calculateStage: calculateStage,
        isAllChaptersCompleted: function () {
            var data = loadData();
            return data.allChaptersCompleted === true;
        },

        // 触发规则检测
        checkTriggerCh8Milestone: checkTriggerCh8Milestone,
        checkTriggerL3Switch: checkTriggerL3Switch,
        checkTriggerConsecutiveDays: checkTriggerConsecutiveDays,
        checkProgressQuery: checkProgressQuery,

        // 常量
        STAGES: STAGES,
        STAGE_ORDER: STAGE_ORDER,
        calcConsecutiveDays: calcConsecutiveDays,
        extractKeyword: extractKeyword
    };

    console.log('[SkillUP] 水德追踪器已就绪');
})();
