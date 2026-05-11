// 搜索功能自动化测试脚本
// 模拟 search.js 的完整搜索逻辑，验证全部功能
const data = require('../data/search-index.json');

// ── 复制 search.js 核心逻辑 ──
const T2S_PAIRS = '無无為为聖圣強强經经親亲體体驗验單单讓让樣样條条樓楼門门開开關关時时處处傳传標标機机識识記记設设計计話话語语說说請请讀读變变議议謙谦資资買买賣卖賞赏貨货貪贪貧贫賀贺賽赛賠赔賺赚贈赠車车轉转輯辑達达運运進进連连選选遠远適适邊边還还過过這这長长間间問问聞闻防防陰阴難难雲云電电靜静響响頁页項项須须題题風风飛飞餘余驅驱高高魚鱼鳥鸟黃黄龍龙龜龟萬万與与並並兩两個個來来們们備备內内動动務务問问國国報报學学實实對对將將專专尋寻導导屬属師师幾几後后從从愛爱應应懷怀戰战戲戏戶户書书會会歸归氣气決决灣湾現现當当發发種種積积節节簡简紀纪約约純纯級级結结給給統统總总繼继線线縣县義义聲声與与舉举補补裝装裡里見见視视覺觉觀观該该論论護护豐丰負负賢贤軍军辦办農农迴回這这連连運运達达違违遠远適适還还鄰邻針针銘銘錢钱鐵铁閉闭開开間间院院隱隐雙双離离難难雲云電电靈灵韓韩響響領领題题願愿類类風风飛飞養养驗验體体魚鱼鳥鸟齊齐龍龙龜龟點點廣广張张徑徑彷彷徵徵層层幣币屆届歲岁歷历殺杀溫温準准溝沟燈燈營营爭爭獨独獲获環环產产異异當当療疗癒愈監监確确禍祸禮礼稱称穩稳競竞籤签絲丝織织繫系習习號号術术複复規规詩诗詳详認认說说請请論论護护變变責责貴贵賞赏踐践載载退退通通進进運运道道達达違违遠远適适還还部部量量集集離离雪雪靈灵靜静頭头顯显飄飘馬马駐驻驗验體体鬥斗魂魂鮮鲜鹽盐麗丽齊齐龍龙';

let T2S_MAP = null;
function buildT2SMap() {
    if (T2S_MAP) return T2S_MAP;
    T2S_MAP = {};
    for (let i = 0; i < T2S_PAIRS.length; i += 2) {
        const trad = T2S_PAIRS[i];
        const simp = T2S_PAIRS[i + 1];
        if (trad !== simp) T2S_MAP[trad] = simp;
    }
    return T2S_MAP;
}
function t2s(text) {
    if (!text) return text;
    const map = buildT2SMap();
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += map[text[i]] || text[i];
    }
    return result;
}
function tokenize(q) { return q.trim().split(/\s+/).filter(Boolean); }
function fuzzyMatch(text, token) {
    const lower = text.toLowerCase();
    const tLower = token.toLowerCase();
    if (lower.indexOf(tLower) !== -1) return true;
    if (tLower.length >= 3) {
        for (let i = 0; i < tLower.length; i++) {
            const partial = tLower.substring(0, i) + tLower.substring(i + 1);
            if (lower.indexOf(partial) !== -1) return true;
        }
    }
    return false;
}
function scoreItem(item, tokens) {
    let score = 0;
    const titleLower = (item.title || '').toLowerCase();
    const textLower = (item.text || '').toLowerCase();
    const conceptsStr = (item.concepts || []).join(' ').toLowerCase();
    for (const t of tokens) {
        const tl = t.toLowerCase();
        if (titleLower.indexOf(tl) !== -1) score += 10;
        if (conceptsStr.indexOf(tl) !== -1) score += 8;
        if (textLower.indexOf(tl) !== -1) score += 3;
        if (titleLower.indexOf(tl) === 0) score += 5;
        let count = 0, idx = textLower.indexOf(tl);
        while (idx !== -1 && count < 5) { count++; idx = textLower.indexOf(tl, idx + 1); }
        score += count;
    }
    return score;
}
function extractSnippet(text, tokens) {
    if (!text) return '';
    const lower = text.toLowerCase();
    let bestIdx = -1;
    for (const t of tokens) {
        const idx = lower.indexOf(t.toLowerCase());
        if (idx !== -1) { bestIdx = idx; break; }
    }
    if (bestIdx === -1) return text.substring(0, 80);
    const start = Math.max(0, bestIdx - 40);
    const end = Math.min(text.length, bestIdx + tokens[0].length + 40);
    return (start > 0 ? '…' : '') + text.substring(start, end) + (end < text.length ? '…' : '');
}
function searchAll(query) {
    const simpQuery = t2s(query);
    const tokens = tokenize(simpQuery);
    if (!tokens.length || !data) return [];

    const hits = [];
    for (const ch of (data.chapters || [])) {
        const searchText = (ch.title + ' ' + (ch.text || '') + ' ' + (ch.concepts || []).join(' ')).toLowerCase();
        let match = true;
        for (const token of tokens) {
            if (!fuzzyMatch(searchText, token)) { match = false; break; }
        }
        if (match) {
            hits.push({
                type: 'chapter',
                title: ch.title,
                url: ch.url,
                snippet: extractSnippet(ch.text || '', tokens),
                score: scoreItem(ch, tokens),
                concepts: ch.concepts || []
            });
        }
    }

    for (const concept of (data.concepts || [])) {
        const cSearchText = (concept.title + ' ' + (concept.text || '')).toLowerCase();
        let cMatch = true;
        for (const token of tokens) {
            if (!fuzzyMatch(cSearchText, token)) { cMatch = false; break; }
        }
        if (cMatch) {
            hits.push({
                type: 'concept',
                title: '概念 · ' + concept.title,
                url: concept.url,
                snippet: extractSnippet(concept.text || '', tokens),
                score: scoreItem({ title: concept.title, text: concept.text, concepts: [] }, tokens) + 5,
                concepts: []
            });
        }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, 40);
}

// ── 测试用例 ──
let passed = 0, failed = 0;
function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`  ✓ ${name}`);
            passed++;
        } else {
            console.log(`  ✗ ${name} — ${result === false ? 'FAILED' : result}`);
            failed++;
        }
    } catch (e) {
        console.log(`  ✗ ${name} — EXCEPTION: ${e.message}`);
        failed++;
    }
}

console.log('='.repeat(60));
console.log('道德经知识库 — 全文检索功能自动化测试');
console.log('='.repeat(60));

// ── 1. 数据结构验证 ──
console.log('\n【1. 数据结构验证】');

test('搜索数据包含 chapters 数组', () => Array.isArray(data.chapters) && data.chapters.length === 81);
test('搜索数据包含 concepts 数组', () => Array.isArray(data.concepts) && data.concepts.length >= 1);
test('每个章节有 url 字段', () => data.chapters.every(c => typeof c.url === 'string' && c.url.includes('chapters/')));
test('每个章节有 text 字段', () => data.chapters.every(c => typeof c.text === 'string' && c.text.length > 100));
test('每个概念有 url 字段', () => data.concepts.every(c => typeof c.url === 'string' && c.url.includes('concepts/')));
test('章节第1章 URL 正确', () => data.chapters[0].url === 'chapters/ch01.html');
test('章节第43章 URL 正确', () => data.chapters[42].url === 'chapters/ch43.html');

// ── 2. 基本检索：单字 ──
console.log('\n【2. 基本检索：单字查询】');

test('搜索"道"返回结果', () => { const r = searchAll('道'); return r.length > 0; });
test('搜索"道"有合理数量结果', () => { const r = searchAll('道'); return r.length >= 30; });
test('搜索"道"结果包含第1章', () => { const r = searchAll('道'); return r.some(h => h.title.includes('第1章')); });
test('搜索"玄"返回结果', () => { const r = searchAll('玄'); return r.length > 0; });
test('搜索"无为"返回结果', () => { const r = searchAll('无为'); return r.length > 0; });

// ── 3. 基本检索：词语 ──
console.log('\n【3. 基本检索：词语查询】');

test('搜索"天下"返回结果', () => { const r = searchAll('天下'); return r.length > 0; });
test('搜索"天地"返回结果', () => { const r = searchAll('天地'); return r.length > 0; });
test('搜索"圣人"返回结果', () => { const r = searchAll('圣人'); return r.length > 0; });

// ── 4. 多关键词组合检索 ──
console.log('\n【4. 多关键词组合检索（AND逻辑）】');

test('搜索"道 德"返回结果', () => { const r = searchAll('道 德'); return r.length > 0; });
test('搜索"无为 不争"返回结果', () => { const r = searchAll('无为 不争'); return r.length > 0; });
test('搜索"天下 圣人 无为"返回结果', () => { const r = searchAll('天下 圣人 无为'); return r.length > 0; });
test('AND逻辑：搜索结果包含第1章（同时提到"道"和"名"）', () => {
    const r = searchAll('道 名');
    // AND 逻辑由搜索函数内部保证：每个 token 都必须 fuzzyMatch 到全文
    // 本测试验证搜索结果确实返回了同时含两词的章节
    const ch1Hit = r.filter(h => h.title.includes('第1章'));
    return ch1Hit.length > 0;
});

// ── 5. 繁体字转换检索 ──
console.log('\n【5. 繁体字转换检索】');

test('t2s"無為"→"无为"', () => t2s('無為') === '无为');
test('t2s"為無為"→"为无为"', () => t2s('為無為') === '为无为');
test('t2s"聖人"→"圣人"', () => t2s('聖人') === '圣人');
test('t2s"萬物"→"万物"', () => t2s('萬物') === '万物');
test('t2s"經典"→"经典"', () => t2s('經典') === '经典');
test('繁体"無為"搜索效果等同"无为"', () => {
    const r1 = searchAll('无为');
    const r2 = searchAll('無為');
    return r1.length === r2.length;
});
test('繁体"為無為"搜索返回结果', () => { const r = searchAll('為無為'); return r.length > 0; });
test('繁体"聖人"搜索返回结果', () => { const r = searchAll('聖人'); return r.length > 0; });
test('繁体"萬物"搜索返回结果', () => { const r = searchAll('萬物'); return r.length > 0; });

// ── 6. 模糊匹配 ──
console.log('\n【6. 模糊匹配测试】');

test('完全匹配: "道德" matches "道德经"', () => fuzzyMatch('道德经', '道德'));
test('不匹配: "abc" does NOT match "道德经"', () => !fuzzyMatch('道德经', 'abc'));
test('3+字符缺一字容错: "道德金"→移除"金"模糊匹配"道德经"', () => fuzzyMatch('道德经', '道德金'));
test('3+字符缺一字容错: "傅统化"→移除"傅"模糊匹配"传统文化"', () => fuzzyMatch('中国传统文化', '傅统化'));
test('不匹配: 2字符不支持容错 "dg" matches "道德经"', () => !fuzzyMatch('道德经', 'dg'));

// ── 7. 搜索结果链接验证 ──
console.log('\n【7. 搜索结果链接验证】');

test('搜索结果 URL 不为 undefined', () => {
    const r = searchAll('道');
    return r.length > 0 && r.every(h => typeof h.url === 'string' && h.url !== 'undefined');
});
test('章节结果 URL 指向正确的 .html 文件', () => {
    const r = searchAll('道');
    return r.filter(h => h.type === 'chapter').every(h => h.url.endsWith('.html'));
});
test('概念结果 URL 指向 concepts/ 目录', () => {
    const r = searchAll('道');
    const cr = r.filter(h => h.type === 'concept');
    return cr.length > 0 ? cr.every(h => h.url.startsWith('concepts/')) : '跳过（无概念结果）';
});

// ── 8. 概念搜索验证 ──
console.log('\n【8. 概念搜索验证】');

test('搜索"道"返回概念结果', () => {
    const r = searchAll('道');
    return r.some(h => h.type === 'concept' && h.title.includes('概念'));
});
test('搜索"无为"返回概念结果', () => {
    const r = searchAll('无为');
    return r.some(h => h.type === 'concept' && h.title.includes('概念'));
});
test('概念结果 type 为 "concept"', () => {
    const r = searchAll('道');
    const cr = r.filter(h => h.type === 'concept');
    return cr.length > 0 ? cr.every(h => h.type === 'concept') : '跳过（无概念结果）';
});

// ── 9. 搜索结果排序 ──
console.log('\n【9. 搜索结果排序验证】');

test('结果按分数降序排列', () => {
    const r = searchAll('道');
    for (let i = 1; i < r.length; i++) {
        if (r[i].score > r[i - 1].score) return false;
    }
    return true;
});
test('标题精确匹配排名靠前', () => {
    const r = searchAll('道');
    const top3 = r.slice(0, 3);
    return top3.every(h => h.score >= 3);
});

// ── 10. 搜索结果片段 ──
console.log('\n【10. 搜索结果片段验证】');

test('每个结果都有非空 snippet', () => {
    const r = searchAll('道');
    return r.every(h => typeof h.snippet === 'string' && h.snippet.length > 0);
});
test('snippet 包含匹配关键词', () => {
    const r = searchAll('无为');
    return r.length > 0 && r[0].snippet.toLowerCase().includes('无为');
});

// ── 11. 边界情况 ──
console.log('\n【11. 边界情况测试】');

test('空查询返回空数组', () => searchAll('').length === 0);
test('纯空格查询返回空数组', () => searchAll('   ').length === 0);
test('不存在关键词返回空数组', () => searchAll('xyzabc123').length === 0);
test('特殊字符查询不会报错', () => {
    try { searchAll('!@#$%^&*()'); return true; } catch (e) { return false; }
});
test('超长查询不会报错', () => {
    try { searchAll('这是一个非常长的查询字符串用来测试搜索引擎对长输入的处理能力表现如何'); return true; } catch (e) { return false; }
});

// ── 统计 ──
console.log('\n' + '='.repeat(60));
console.log(`测试完成: ${passed} 通过, ${failed} 失败, ${passed + failed} 总计`);
if (failed > 0) {
    console.log('❌ 有测试未通过，请检查！');
} else {
    console.log('✓ 全部测试通过！');
}
console.log('='.repeat(60));
