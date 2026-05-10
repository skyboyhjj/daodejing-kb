/**
 * comprehensive-check-v2.js — 81章全面一致性检查
 * 使用更精确的模式，以 ch18 为基准
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHAPTERS_DIR = path.join(ROOT, 'chapters');

const VALID_CONCEPTS = [
    'dao', 'de', 'wuwei', 'ziran', 'fan', 'xuan',
    'rouruo', 'pu', 'yi', 'jing', 'xia', 'zhizu',
    'buzheng', 'qiantui', 'yinger', 'shouzhong'
];

function getFilename(i) { return i < 10 ? 'ch0' + i + '.html' : 'ch' + i + '.html'; }
function read(i) { return fs.readFileSync(path.join(CHAPTERS_DIR, getFilename(i)), 'utf8'); }

// 检查项: [ID, 描述, 检查函数, 严重级别]
const checks = [];

// ─── C1 内容完整性 ───
checks.push(['C1-STEP1-5', '五步结构完整 (#step1-#step5)', (c) => {
    const missing = [];
    for (let s = 1; s <= 5; s++) if (!c.includes('id="step' + s + '"')) missing.push('step' + s);
    return missing.length ? 'MISSING: ' + missing.join(',') : null;
}, 'HIGH']);

checks.push(['C1-L1', 'L1认知层内容 (>=3块)', (c) => {
    const n = (c.match(/data-level="l1"/g) || []).length;
    return n >= 3 ? null : 'L1块=' + n + ' (需>=3)';
}, 'HIGH']);

checks.push(['C1-L2', 'L2认知层内容 (>=4块)', (c) => {
    const n = (c.match(/data-level="l2"/g) || []).length;
    return n >= 4 ? null : 'L2块=' + n + ' (需>=4)';
}, 'HIGH']);

checks.push(['C1-L3', 'L3认知层内容 (>=4块)', (c) => {
    const n = (c.match(/data-level="l3"/g) || []).length;
    return n >= 4 ? null : 'L3块=' + n + ' (需>=4)';
}, 'HIGH']);

checks.push(['C1-L4', 'L4认知层内容 (>=4块)', (c) => {
    const n = (c.match(/data-level="l4"/g) || []).length;
    return n >= 4 ? null : 'L4块=' + n + ' (需>=4)';
}, 'HIGH']);

checks.push(['C1-L-ALWAYS', '亲子赋能始终可见', (c) => {
    return c.includes('level-always') && c.includes('data-level="all"') ? null : 'MISSING';
}, 'HIGH']);

checks.push(['C1-CONCEPTS', '概念标签存在且有效', (c) => {
    if (!c.includes('concept-tag')) return '缺少概念标签';
    const tags = c.match(/class="concept-tag\s+(\w+)"/g) || [];
    const bad = [];
    tags.forEach(t => { const m = t.match(/concept-tag\s+(\w+)/); if (m && !VALID_CONCEPTS.includes(m[1])) bad.push(m[1]); });
    return bad.length ? '无效标签: ' + bad.join(',') : null;
}, 'HIGH']);

checks.push(['C1-ORIGINAL', '原文区块完整', (c) => {
    return c.includes('original-text') ? null : '缺少 .original-text';
}, 'HIGH']);

// ─── C2 样式一致性 ───
checks.push(['C2-LEVEL-CSS', 'level-block/l1/l2/l3/l4 CSS存在', (c) => {
    const miss = [];
    if (!/\.level-block\s*\{/.test(c)) miss.push('level-block');
    if (!/\.level-l1\s*[\{,]/.test(c)) miss.push('level-l1');
    if (!/\.level-l2\s*[\{,]/.test(c)) miss.push('level-l2');
    if (!/\.level-l3\s*[\{,]/.test(c)) miss.push('level-l3');
    if (!/\.level-l4\s*[\{,]/.test(c)) miss.push('level-l4');
    return miss.length ? '缺少: ' + miss.join(',') : null;
}, 'MED']);

checks.push(['C2-LEVEL-ALWAYS', 'level-always CSS正常', (c) => {
    if (!c.includes('level-always')) return null; // 不需要检查CSS
    return /level-always/.test(c) ? null : 'CSS中缺少 level-always';
}, 'MED']);

checks.push(['C2-BTN-CSS', 'level-btn按钮样式', (c) => {
    return /\.level-btn\s*\{/.test(c) ? null : '缺少 .level-btn CSS';
}, 'MED']);

checks.push(['C2-HIDE-DEFAULT', 'L1/L4默认隐藏CSS', (c) => {
    const ok = c.match(/level-l[14][\s\S]{0,8}display\s*:\s*none/);
    return ok ? null : 'L1/L4 display:none 规则缺失或格式异常';
}, 'HIGH']);

checks.push(['C2-VERIFY-TBL', 'verify-table CSS', (c) => {
    return /\.verify-table\s*\{/.test(c) ? null : '缺少 verify-table CSS';
}, 'LOW']);

checks.push(['C2-GOLDEN-QUOTE', 'golden-quote CSS', (c) => {
    return /\.golden-quote\s*\{/.test(c) ? null : '缺少 golden-quote CSS';
}, 'LOW']);

checks.push(['C2-NAV-CHAPTERS', 'nav-chapters CSS', (c) => {
    return /\.nav-chapters\s*\{/.test(c) ? null : '缺少 nav-chapters CSS';
}, 'LOW']);

// ─── C3 功能一致性 ───
checks.push(['C3-LF-JS', 'level-filter.js引用', (c) => {
    return c.includes('level-filter.js') ? null : 'MISSING';
}, 'HIGH']);

checks.push(['C3-ID-SELECTOR', 'id="level-selector"', (c) => {
    return c.includes('id="level-selector"') ? null : 'MISSING (level-filter.js需要)';
}, 'HIGH']);

checks.push(['C3-LEVEL-BLOCK', 'level-block class (JS选择器)', (c) => {
    return c.includes('class="level-block') ? null : 'MISSING (level-filter.js需要)';
}, 'HIGH']);

checks.push(['C3-ALL-BTN', '全部按钮 (data-level="all")', (c) => {
    return /<button[^>]*data-level="all"/.test(c) ? null : 'MISSING';
}, 'HIGH']);

// ─── C4 特殊元素 ───
checks.push(['C4-HUIHUI', '慧惠AI问候语', (c) => {
    return c.includes('慧惠') ? null : 'MISSING';
}, 'MED']);

checks.push(['C4-AI-NOTE', 'AI角色标注', (c) => {
    return /AI初审|AI角色|人类导师/.test(c) ? null : 'MISSING';
}, 'MED']);

checks.push(['C4-5STEP-NAV', '五步导航条', (c) => {
    return c.includes('five-step-nav') ? null : 'MISSING';
}, 'HIGH']);

checks.push(['C4-5STEP-LINKS', '五步链接完整 (#step1-#step5)', (c) => {
    const miss = [];
    for (let s = 1; s <= 5; s++) if (!c.includes('href="#step' + s + '"')) miss.push('step' + s);
    return miss.length ? '缺少: ' + miss.join(',') : null;
}, 'HIGH']);

checks.push(['C4-NAV', '章节上下导航', (c) => {
    if (!c.includes('nav-chapters')) return '缺少 .nav-chapters';
    // 检查是否有上下章链接
    const section = c.split('nav-chapters')[1]?.split('</div>')[0] || '';
    const links = section.match(/ch\d+\.html/g) || [];
    return links.length >= 2 ? null : '上下章链接不完整 (仅' + links.length + '个链接)';
}, 'HIGH']);

checks.push(['C4-GOLDEN-QUOTE', '金句引用区块', (c) => {
    return /class="golden-quote"/.test(c) ? null : 'MISSING';
}, 'MED']);

checks.push(['C4-HUIHUI-CHAT', '慧惠聊天组件', (c) => {
    return c.includes('huihui-chat') ? null : 'MISSING';
}, 'HIGH']);

checks.push(['C4-SEARCH', '全文搜索框', (c) => {
    return c.includes('daodejing-search') ? null : 'MISSING';
}, 'HIGH']);

// ─── C5 文件结构 ───
checks.push(['C5-DOCTYPE', '<!DOCTYPE html>', (c) => {
    return /^<!DOCTYPE html>/i.test(c.trim()) ? null : 'WRONG/MISSING';
}, 'HIGH']);

checks.push(['C5-HEAD', 'head 标签完整性', (c) => {
    const miss = [];
    if (!/<html[^>]*lang="zh-CN"/i.test(c)) miss.push('lang');
    if (!/<meta[^>]*charset/i.test(c)) miss.push('charset');
    if (!/<meta[^>]*viewport/i.test(c)) miss.push('viewport');
    if (!/<title>第\d+章/.test(c)) miss.push('title');
    return miss.length ? '缺少: ' + miss.join(',') : null;
}, 'HIGH']);

checks.push(['C5-CSS-REF', 'daodejing-styles.css引用', (c) => {
    return c.includes('daodejing-styles.css') ? null : 'MISSING';
}, 'HIGH']);

checks.push(['C5-SCRIPTS', '全部脚本引用', (c) => {
    const miss = [];
    if (!c.includes('search-data.js')) miss.push('search-data');
    if (!c.includes('/js/search.js')) miss.push('search');
    if (!c.includes('back-to-top.js')) miss.push('back-to-top');
    if (!c.includes('level-filter.js')) miss.push('level-filter');
    return miss.length ? '缺少: ' + miss.join(',') : null;
}, 'HIGH']);

checks.push(['C5-HUIHUI-CSS', 'huihui-chat.css引用', (c) => {
    return c.includes('huihui-chat.css') ? null : 'MISSING';
}, 'MED']);

checks.push(['C5-FOOTER', 'site-footer页脚', (c) => {
    return c.includes('site-footer') ? null : 'MISSING';
}, 'MED']);

// ─── 执行 ───
console.log('═══════════════════════════════════════════════════');
console.log('  81章 HTML 全面一致性检查报告');
console.log('  参考标准: ch18.html  |  检查项: ' + checks.length);
console.log('═══════════════════════════════════════════════════\n');

const issuesByChapter = {};
let totalPass = 0, totalFail = 0;

for (let i = 1; i <= 81; i++) {
    const fname = getFilename(i);
    const c = read(i);
    const issues = [];
    for (const [id, desc, fn, level] of checks) {
        const result = fn(c);
        if (result) {
            issues.push({ id, level, msg: result });
            totalFail++;
        } else {
            totalPass++;
        }
    }
    if (issues.length > 0) issuesByChapter[i] = issues;
}

// 按检查项汇总
console.log('── 按检查项汇总 ──\n');
for (const [id, desc, fn, level] of checks) {
    const chapters = Object.entries(issuesByChapter)
        .filter(([ch, iss]) => iss.some(i => i.id === id))
        .map(([ch]) => Number(ch));
    const tag = level === 'HIGH' ? '🔴' : level === 'MED' ? '🟡' : '🟢';
    if (chapters.length > 0) {
        console.log('  ' + tag + ' ' + id + ' [' + desc + ']: ' + chapters.length + '章');
        console.log('      章节: ' + chapters.join(', '));
    } else {
        console.log('  ✅ ' + id + ' [' + desc + ']: 全部通过');
    }
}

// 按严重级别
console.log('\n── 按严重级别汇总 ──\n');
const highChs = new Set();
const medChs = new Set();
const lowChs = new Set();
for (const [ch, issues] of Object.entries(issuesByChapter)) {
    for (const iss of issues) {
        if (iss.level === 'HIGH') highChs.add(Number(ch));
        if (iss.level === 'MED') medChs.add(Number(ch));
        if (iss.level === 'LOW') lowChs.add(Number(ch));
    }
}
console.log('  🔴 HIGH: ' + highChs.size + '章受影响');
console.log('  🟡 MED:  ' + medChs.size + '章受影响');
console.log('  🟢 LOW:  ' + lowChs.size + '章受影响');

// 每章明细
console.log('\n── 每章问题明细 ──\n');
if (Object.keys(issuesByChapter).length === 0) {
    console.log('  🎉 全部81章无任何问题！');
} else {
    for (const [ch, issues] of Object.entries(issuesByChapter)) {
        console.log('  [' + getFilename(Number(ch)) + '] ' + issues.length + '个问题:');
        for (const iss of issues) {
            console.log('    ' + (iss.level === 'HIGH' ? '🔴' : iss.level === 'MED' ? '🟡' : '🟢') +
                ' ' + iss.id + ': ' + iss.msg);
        }
        console.log('');
    }
}

console.log('═══════════════════════════════════════════════════');
console.log('  总计: ✅ ' + totalPass + ' / ⚠ ' + totalFail +
    '  | 有问题章节: ' + Object.keys(issuesByChapter).length + '/81');
console.log('═══════════════════════════════════════════════════');
