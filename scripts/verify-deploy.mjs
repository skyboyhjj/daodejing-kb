/**
 * hui-skill.org 部署后验证脚本
 * 用法: node scripts/verify-deploy.mjs [--domain hui-skill.org]
 *
 * 验证项目：
 *   - 所有核心页面 HTTP 200
 *   - 旧 .html 链接存活
 *   - API 端点响应正常
 *   - 搜索数据无 .html 后缀
 *   - 404 页面机制正常
 */

const BASE = process.argv.includes('--domain')
    ? 'https://' + process.argv[process.argv.indexOf('--domain') + 1]
    : 'https://hui-skill.org';

let passed = 0;
let failed = 0;

async function check(name, url, expectedStatus = 200) {
    try {
        const res = await fetch(url, { redirect: 'manual' });
        if (res.status === expectedStatus) {
            console.log(`  ✓ ${name}  → HTTP ${res.status}`);
            passed++;
            return true;
        } else {
            console.log(`  ✗ ${name}  → HTTP ${res.status} (expected ${expectedStatus})`);
            failed++;
            return false;
        }
    } catch (e) {
        console.log(`  ✗ ${name}  → ${e.message}`);
        failed++;
        return false;
    }
}

async function checkContent(name, url, testFn) {
    try {
        const res = await fetch(url);
        const text = await res.text();
        if (testFn(text)) {
            console.log(`  ✓ ${name}  → OK`);
            passed++;
        } else {
            console.log(`  ✗ ${name}  → content check failed`);
            failed++;
        }
    } catch (e) {
        console.log(`  ✗ ${name}  → ${e.message}`);
        failed++;
    }
}

async function main() {
    console.log(`\n验证目标: ${BASE}\n`);

    // ── 1. 核心页面 (200) ──
    console.log('【1. 核心页面 HTTP 状态】');
    await check('首页 /', `${BASE}/`);
    await check('章节总览 /chapters', `${BASE}/chapters`);
    await check('第1章 /chapters/ch01', `${BASE}/chapters/ch01`);
    await check('第25章 /chapters/ch25', `${BASE}/chapters/ch25`);
    await check('第50章 /chapters/ch50', `${BASE}/chapters/ch50`);
    await check('第81章 /chapters/ch81', `${BASE}/chapters/ch81`);
    await check('概念索引 /concepts', `${BASE}/concepts`);
    await check('概念"德" /concepts/de', `${BASE}/concepts/de`);
    await check('概念"道" /concepts/dao', `${BASE}/concepts/dao`);
    await check('阅读路径 /paths', `${BASE}/paths`);
    await check('亲子时光 /family', `${BASE}/family`);
    await check('L1 页面 /l1', `${BASE}/l1`);
    await check('比较页面 /compare', `${BASE}/compare`);
    await check('授权页面 /empower', `${BASE}/empower`);
    await check('知识图谱 /kg', `${BASE}/kg`);
    await check('404 页面 /404', `${BASE}/404`);

    // ── 2. 旧 .html 链接存活 ──
    console.log('\n【2. 旧 .html 链接存活】');
    await check('ch01.html', `${BASE}/chapters/ch01.html`);
    await check('de.html', `${BASE}/concepts/de.html`);

    // ── 3. 404 机制 ──
    console.log('\n【3. 404 错误处理】');
    await check('不存在页面', `${BASE}/nonexistent-${Date.now()}`, 404);

    // ── 4. API 端点 ──
    console.log('\n【4. API 端点】');
    try {
        const apiRes = await fetch(`${BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }] }),
        });
        const apiStatus = apiRes.status;
        const apiOk = apiStatus === 200 || apiStatus === 503;
        console.log(`  ${apiOk ? '✓' : '✗'} POST /api/chat  → HTTP ${apiStatus}`);
        apiOk ? passed++ : failed++;
    } catch (e) {
        console.log(`  ✗ POST /api/chat  → ${e.message}`);
        failed++;
    }

    // ── 5. 搜索数据干净（无 .html 后缀）──
    console.log('\n【5. 搜索数据 URL 格式】');
    await checkContent(
        '搜索数据无 .html 后缀',
        `${BASE}/data/search-data.js`,
        (text) => !text.match(/"url":"[^"]*\.html"/)
    );

    // ── 6. 章节导航链接格式 ──
    console.log('\n【6. 章节页导航链接格式】');
    await checkContent(
        'ch01 内链不含 .html',
        `${BASE}/chapters/ch01`,
        (text) => !text.match(/href="[^"]*ch\d{2}\.html"/) && !text.match(/href="[^"]*index\.html"/)
    );

    // ── 结果 ──
    console.log(`\n========== 验证结果 ==========`);
    console.log(`通过: ${passed}  |  失败: ${failed}`);
    if (failed > 0) {
        console.log('存在失败项，请检查。');
        process.exit(1);
    } else {
        console.log('全部通过，部署正常。');
    }
}

main();
