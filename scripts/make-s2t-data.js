/* =====================================================================
   生成简繁映射数据 js/s2t-data.js（只含《道德经》81章原文实际用到的差异字）
   ---------------------------------------------------------------------
   数据源：对 81 章 <div class="original-text"> 逐字分析后，按语境定字。
   二义字已按王弼本语境确定（详见下方 MAP 注释）：
     发→發(发作)  后→後(先后)  复→復(恢复)  台→臺(高台)
     余→餘(多余)  几→幾(几乎)  并→並(并列)  冲→沖(虚冲)
     弥→彌(更加)  朴→樸(未雕木) 强→強(强健)  与→與(和/给)
     舍→捨(舍弃)  饥→飢(饥饿)  洼→窪(低洼)  却→卻(退却)
     云(说义，保持) 里(长度，保持) 谷(山谷，保持) 采(文采，保持)
     御(驾驭，保持) 制(制度，保持) 于→於(介词，复古) 夸(盗夸，保持)
     芸(芸芸，保持) 迹(辙迹，保持) 凶(不吉，保持) 累(累土，保持)
     词组特例：不谷→不穀(第39/42章谦称"不善")
   用法：node scripts/make-s2t-data.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const CHAPTERS_DIR = path.join(__dirname, '..', 'chapters');
const OUT_FILE = path.join(__dirname, '..', 'js', 's2t-data.js');
const KNOWN_SAME_FILE = path.join(__dirname, 's2t-known-same.txt');

/* 简 → 繁 映射（仅差异字；含按语境定字的二义字） */
const MAP = {
    // —— 一画/基本 ——
    无: '無', 万: '萬', 为: '為', 与: '與', 长: '長', 后: '後',
    义: '義', 门: '門', 车: '車', 见: '見', 马: '馬', 鸟: '鳥',
    几: '幾', 于: '於', 两: '兩', 轻: '輕',
    圣: '聖', 恶: '惡', 涣: '渙',
    // —— 偏旁类推 ——
    观: '觀', 异: '異', 谓: '謂', 众: '眾', 难: '難', 较: '較',
    倾: '傾', 声: '聲', 随: '隨', 处: '處', 辞: '辭', 贤: '賢',
    争: '爭', 贵: '貴', 货: '貨', 盗: '盜', 乱: '亂', 虚: '虛',
    实: '實', 强: '強', 则: '則', 冲: '沖', 渊: '淵', 锐: '銳',
    纷: '紛', 尘: '塵', 谁: '誰', 刍: '芻', 间: '間', 犹: '猶',
    动: '動', 数: '數', 穷: '窮', 绵: '綿', 时: '時', 满: '滿',
    骄: '驕', 遗: '遺', 载: '載', 营: '營', 离: '離', 专: '專',
    气: '氣', 婴: '嬰', 儿: '兒', 涤: '滌', 览: '覽', 爱: '愛',
    国: '國', 开: '開', 阖: '闔', 达: '達', 辐: '輻', 毂: '轂',
    当: '當', 凿: '鑿', 户: '戶', 聋: '聾', 驰: '馳', 骋: '騁',
    猎: '獵', 发: '發', 宠: '寵', 惊: '驚', 视: '視', 听: '聽',
    闻: '聞', 诘: '詰', 绳: '繩', 复: '復', 归: '歸', 状: '狀',
    执: '執', 纪: '紀', 识: '識', 邻: '鄰', 俨: '儼', 将: '將',
    释: '釋', 朴: '樸', 旷: '曠', 浊: '濁', 静: '靜', 极: '極',
    笃: '篤', 并: '並', 亲: '親', 誉: '譽', 废: '廢', 伪: '偽',
    绝: '絕', 弃: '棄', 贼: '賊', 属: '屬', 学: '學', 忧: '憂',
    台: '臺', 独: '獨', 余: '餘', 闷: '悶', 顽: '頑', 从: '從',
    阅: '閱', 洼: '窪', 岂: '豈', 诚: '誠', 飘: '飄', 风: '風',
    终: '終', 骤: '驟', 况: '況', 乐: '樂', 赘: '贅', 远: '遠',
    辎: '輜', 虽: '雖', 荣: '榮', 辙: '轍', 谪: '謫', 筹: '籌',
    闭: '閉', 关: '關', 结: '結', 约: '約', 袭: '襲', 师: '師',
    资: '資', 败: '敗', 嘘: '噓', 还: '還', 军: '軍', 壮: '壯',
    胜: '勝', 杀: '殺', 丧: '喪', 礼: '禮', 战: '戰', 宾: '賓',
    寿: '壽', 养: '養', 饵: '餌', 过: '過', 张: '張', 兴: '興',
    刚: '剛', 鱼: '魚', 脱: '脫', 镇: '鎮', 应: '應', 华: '華',
    宁: '寧', 灵: '靈', 灭: '滅', 贱: '賤', 称: '稱', 舆: '輿',
    进: '進', 颣: '纇', 广: '廣', 质: '質', 隐: '隱', 贷: '貸',
    负: '負', 阴: '陰', 阳: '陽', 损: '損', 坚: '堅', 费: '費',
    辩: '辯', 讷: '訥', 热: '熱', 却: '卻', 粪: '糞', 祸: '禍',
    窥: '窺', 弥: '彌', 浑: '渾', 盖: '蓋', 摄: '攝', 陆: '陸',
    势: '勢', 兑: '兌', 济: '濟', 径: '徑', 芜: '蕪', 仓: '倉',
    带: '帶', 剑: '劍', 厌: '厭', 饮: '飲', 财: '財', 孙: '孫',
    辍: '輟', 乡: '鄉', 丰: '豐', 虫: '蟲', 兽: '獸', 据: '據',
    号: '號', 讳: '諱', 贫: '貧', 刿: '劌', 啬: '嗇', 积: '積',
    鲜: '鮮', 莅: '蒞', 伤: '傷', 奥: '奧', 宝: '寶', 驷: '駟',
    报: '報', 图: '圖', 细: '細', 诺: '諾', 谋: '謀', 层: '層',
    辅: '輔', 顺: '順', 俭: '儉', 舍: '捨', 卫: '衛', 敌: '敵',
    怀: '懷', 来: '來', 网: '網', 惧: '懼', 饥: '飢', 税: '稅',
    举: '舉', 补: '補', 责: '責', 彻: '徹', 陈: '陳', 鸡: '雞',
};

function listChapterFiles() {
    return fs.readdirSync(CHAPTERS_DIR)
        .filter((n) => /^ch\d+\.html$/.test(n))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
}

/* 收集原文全部去重汉字 */
function collectCharset() {
    const set = new Set();
    for (const f of listChapterFiles()) {
        const html = fs.readFileSync(path.join(CHAPTERS_DIR, f), 'utf8');
        const m = html.match(/<div class="original-text">([\s\S]*?)<\/div>/);
        if (!m) continue;
        const text = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
        for (const ch of text) if (/[\u4e00-\u9fff]/.test(ch)) set.add(ch);
    }
    return set;
}

/* 只保留原文实际出现的差异字 */
function filterToPresent(charset) {
    const out = {};
    for (const ch of Object.keys(MAP)) {
        if (charset.has(ch)) out[ch] = MAP[ch];
    }
    return out;
}

/* 读已知同形字快照（简繁相同的字，已人工确认无需转繁） */
function loadKnownSame() {
    if (!fs.existsSync(KNOWN_SAME_FILE)) return new Set();
    const txt = fs.readFileSync(KNOWN_SAME_FILE, 'utf8');
    return new Set([...txt].filter((c) => /[\u4e00-\u9fff]/.test(c)));
}

/* 把「原文中不在 MAP 里的字」写入同形字快照（--accept-same 时调用） */
function saveKnownSame(charset) {
    const same = [...charset].filter((c) => !(c in MAP)).sort();
    fs.writeFileSync(KNOWN_SAME_FILE, same.join(''), 'utf8');
    return same.length;
}

/* 打印简繁转换检查报告 */
function report(charset, present) {
    const knownSame = loadKnownSame();
    const mapKeys = new Set(Object.keys(MAP));
    const unknown = [...charset].filter((c) => !mapKeys.has(c) && !knownSame.has(c)).sort();

    console.log('原文去重汉字总数: ' + charset.size);
    console.log('简→繁 可转（MAP 覆盖）: ' + Object.keys(present).length + ' 字');
    console.log('已审核同形字（known-same 快照）: ' + knownSame.size + ' 字');

    if (unknown.length) {
        console.log('\n[!] 发现 ' + unknown.length + ' 个「新增未审核」字（既不在 MAP 也不在同形快照）：');
        console.log('    ' + unknown.join(''));
        console.log('    处理：简体需转繁体 → 补充进 MAP 后重跑 `npm run s2t`；');
        console.log('          简繁同形 → 确认后执行 `npm run s2t:accept`。');
    } else {
        console.log('\n[OK] 全部原文汉字均已审核，无新增未映射字。');
    }
    return unknown;
}

const charset = collectCharset();
const present = filterToPresent(charset);
const mode = process.argv[2];

if (mode === '--check') {
    report(charset, present);
} else if (mode === '--accept-same') {
    const n = saveKnownSame(charset);
    console.log('已写入同形字快照: ' + n + ' 字 -> ' + path.relative(process.cwd(), KNOWN_SAME_FILE));
    console.log();
    report(charset, present);
} else {
    const body =
        '/* 繁简转换数据 — 自动生成，勿手改（源：scripts/make-s2t-data.js）\n' +
        '   仅含《道德经》81章原文实际用字（简→繁），二义字已按王弼本语境定字。 */\n' +
        '(function () {\n' +
        "    'use strict';\n" +
        '    var MAP = ' + JSON.stringify(present, null, 4).replace(/\n    /g, '\n        ').replace(/\n\}/, '\n    }') + ';\n' +
        '    window.__DAO_S2T__ = MAP;\n' +
        '    window.__dao_s2t__ = function (text) {\n' +
        '        var s = String(text).replace(/不谷/g, "不穀");\n' +
        '        return s.replace(/[\\u4e00-\\u9fff]/g, function (ch) {\n' +
        '            return MAP[ch] || ch;\n' +
        '        });\n' +
        '    };\n' +
        '})();\n';

    fs.writeFileSync(OUT_FILE, body, 'utf8');
    console.log('已生成: ' + path.relative(process.cwd(), OUT_FILE) + '（简→繁 ' + Object.keys(present).length + ' 对）');
    console.log();
    report(charset, present);

    const ch01 = fs.readFileSync(path.join(CHAPTERS_DIR, 'ch01.html'), 'utf8');
    const m01 = ch01.match(/<div class="original-text">([\s\S]*?)<\/div>/);
    const text01 = m01[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const s2t = (s) => s.replace(/不谷/g, '不穀').replace(/[\u4e00-\u9fff]/g, (c) => MAP[c] || c);
    console.log('\n=== 第一章转换预览 ===');
    console.log(s2t(text01));
}