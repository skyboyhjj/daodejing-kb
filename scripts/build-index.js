/**
 * 搜索索引自动构建脚本
 * 从 81 个章节 HTML 文件中提取标题、原文、概念标签和全文内容，
 * 生成 data/search-data.js（浏览器可用）+ data/search-index.json（机器可读）
 *
 * 用法：
 *   node scripts/build-index.js          # 重新构建索引
 *   node scripts/build-index.js --check  # 仅检查索引是否过期（CI 用）
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── 路径配置 ──
const ROOT = path.join(__dirname, '..');
const CHAPTERS_DIR = path.join(ROOT, 'chapters');
const CONCEPTS_DIR = path.join(ROOT, 'concepts');
const OUTPUT_JS = path.join(ROOT, 'data', 'search-data.js');
const OUTPUT_JSON = path.join(ROOT, 'data', 'search-index.json');

// ── 有效概念标签清单（16 个） ──
const VALID_CONCEPTS = [
    'dao', 'de', 'wuwei', 'ziran', 'fan', 'xuan',
    'rouruo', 'pu', 'yi', 'jing', 'xia', 'zhizu',
    'buzheng', 'qiantui', 'yinger', 'shouzhong'
];

// ── HTML 提取工具函数 ──

/**
 * 提取章节编号
 */
function extractChapterNum(filename) {
    const m = filename.match(/^ch(\d+)\.html$/);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * 提取 <h1> 中的标题文本
 * 格式："第X章 · 标题名"（排除副标题 span）
 */
function extractTitle(html) {
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!m) return '';
    // 先移除 <span class="subtitle">...</span> 整体（含文本内容）
    let title = m[1].replace(/<span[^>]*class="subtitle"[^>]*>[\s\S]*?<\/span>/gi, '');
    // 再移除其他 HTML 标签
    title = title
        .replace(/<[^>]+>/g, '')
        .replace(/[\s\n\r]+/g, ' ')
        .trim();
    // 移除 emoji 前缀（📜 ☯️ 等各种 emoji）
    title = title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{FE0F}\u{200D}]/gu, '').trim();
    return title;
}

/**
 * 提取原文内容（从 div.original-text）
 */
function extractOriginalText(html) {
    const m = html.match(/<div\s+class="original-text"[^>]*>([\s\S]*?)<\/div>/i);
    if (!m) return '';
    return m[1]
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[\s\n\r]+/g, '')
        .trim();
}

/**
 * 提取概念标签（从 span.concept-tag）
 */
function extractConcepts(html) {
    const concepts = [];
    const re = /<span\s+class="concept-tag\s+([a-z]+)"[^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const tag = m[1].toLowerCase();
        if (VALID_CONCEPTS.includes(tag) && !concepts.includes(tag)) {
            concepts.push(tag);
        }
    }
    return concepts;
}

/**
 * 提取全文搜索文本
 * 包括：原文 + 各步骤标题 + 各层级内容的纯文本
 */
function extractFullText(html) {
    // 移除 <style> 和 <script> 块
    let text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // 仅保留 body 中的内容（如有）
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) text = bodyMatch[1];

    // 移除所有 HTML 标签
    text = text.replace(/<[^>]+>/g, '');

    // 移除 HTML 实体
    text = text
        .replace(/&[a-z]+;/gi, '')
        .replace(/&#\d+;/g, '')
        .replace(/&#x[0-9a-f]+;/gi, '');

    // 压缩空白
    text = text.replace(/[\s\n\r]+/g, '').trim();

    return text;
}

/**
 * 提取概念页面标题（从 <title> 标签）
 */
function extractConceptTitle(html) {
    const m = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (!m) return '';
    return m[1]
        .replace(/<[^>]+>/g, '')
        .replace(/[\s\n\r]+/g, ' ')
        .replace(/\s*-\s*概念详解\s*-\s*道德经亲子体验营\s*/i, '')
        .trim();
}

// ── 主流程 ──

function buildIndex() {
    // 扫描章节文件
    const files = fs.readdirSync(CHAPTERS_DIR)
        .filter(f => /^ch\d+\.html$/.test(f))
        .sort((a, b) => extractChapterNum(a) - extractChapterNum(b));

    if (files.length === 0) {
        console.error('ERROR: 未找到任何章节文件');
        process.exit(1);
    }

    console.log(`[build-index] 扫描到 ${files.length} 个章节文件`);

    const chapters = [];

    for (const file of files) {
        const num = extractChapterNum(file);
        const filePath = path.join(CHAPTERS_DIR, file);
        const html = fs.readFileSync(filePath, 'utf-8');

        const title = extractTitle(html);
        const concepts = extractConcepts(html);
        const originalText = extractOriginalText(html);
        const fullText = extractFullText(html);

        // 搜索文本 = 原文 + 概念关键词 + 全文（去重拼接）
        const searchText = [
            originalText,
            title.replace(/第\d+章\s*·\s*/, ''),
            concepts.join(' '),
            '五步读解 文本细读 语境建构 争议辨析 逻辑验证 意义转化',
            'L1白话版 L2精读版 L3应用版 L4学术版',
            fullText
        ].join(' ');

        chapters.push({
            num,
            title: `第${num}章 · ${title.replace(/^第\d+章\s*·?\s*/, '')}`,
            concepts,
            text: searchText,
            url: 'chapters/' + file.replace(/\.html$/, '')
        });

        if (!title) {
            console.warn(`  WARN: ch${String(num).padStart(2, '0')}.html 未提取到标题`);
        }
    }

    // ── 索引概念页面 ──
    const concepts = [];
    if (fs.existsSync(CONCEPTS_DIR)) {
        const conceptFiles = fs.readdirSync(CONCEPTS_DIR)
            .filter(f => f.endsWith('.html') && f !== 'index.html')
            .sort();

        console.log(`[build-index] 扫描到 ${conceptFiles.length} 个概念页面`);

        for (const cf of conceptFiles) {
            const conceptPath = path.join(CONCEPTS_DIR, cf);
            const conceptHtml = fs.readFileSync(conceptPath, 'utf-8');
            const conceptTitle = extractConceptTitle(conceptHtml);
            const conceptText = extractFullText(conceptHtml);

            if (conceptTitle) {
                concepts.push({
                    title: conceptTitle,
                    text: conceptText,
                    url: 'concepts/' + cf.replace(/\.html$/, '')
                });
            }
        }
    }

    return { chapters, concepts };
}

function writeOutput(data) {
    // 确保 data 目录存在
    const dataDir = path.join(ROOT, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 写入 JS 版本（浏览器 <script> 标签加载）
    const jsContent = [
        '// 道德经知识库搜索索引 (脚本化版本，兼容 file:// 协议)',
        '// 此文件通过 <script> 标签加载，不受浏览器 CORS 限制',
        '// 自动生成，请勿手动编辑 — 运行 npm run build:index 重新生成',
        `window.__DaoSearchData = ${JSON.stringify(data)};`,
        ''
    ].join('\n');

    fs.writeFileSync(OUTPUT_JS, jsContent, 'utf-8');

    // 写入 JSON 版本（工具链/API 使用）
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(OUTPUT_JSON, jsonContent, 'utf-8');

    console.log(`[build-index] 输出: ${path.relative(ROOT, OUTPUT_JS)} (${(Buffer.byteLength(jsContent) / 1024).toFixed(1)} KB)`);
    console.log(`[build-index] 输出: ${path.relative(ROOT, OUTPUT_JSON)} (${(Buffer.byteLength(jsonContent) / 1024).toFixed(1)} KB)`);
}

/**
 * --check 模式：比较当前章节源文件的 hash 与已生成索引的 hash
 * 若不一致则返回非零退出码（CI 用）
 */
function checkMode(data) {
    const newHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex')
        .slice(0, 16);

    if (!fs.existsSync(OUTPUT_JS)) {
        console.error(`[build-index] FAIL: ${path.relative(ROOT, OUTPUT_JS)} 不存在，请运行 npm run build:index`);
        process.exit(1);
    }

    const existing = fs.readFileSync(OUTPUT_JS, 'utf-8');
    const existingDataMatch = existing.match(/window\.__DaoSearchData\s*=\s*(.+);?\s*$/m);
    if (!existingDataMatch) {
        console.error('[build-index] FAIL: 现有 search-data.js 格式异常');
        process.exit(1);
    }

    let existingHash;
    try {
        const existingData = JSON.parse(existingDataMatch[1].replace(/;$/, ''));
        existingHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(existingData))
            .digest('hex')
            .slice(0, 16);
    } catch (e) {
        console.error('[build-index] FAIL: 现有 search-data.js JSON 解析失败');
        process.exit(1);
    }

    if (newHash !== existingHash) {
        console.error('[build-index] FAIL: 搜索索引已过期，请运行 npm run build:index');
        console.error(`  源文件 hash: ${newHash}`);
        console.error(`  索引 hash:   ${existingHash}`);
        process.exit(1);
    }

    console.log(`[build-index] OK: 搜索索引已是最新 (hash: ${newHash})`);
}

// ── 入口 ──
const isCheck = process.argv.includes('--check');
const data = buildIndex();

if (isCheck) {
    checkMode(data);
} else {
    writeOutput(data);
    console.log(`[build-index] 完成: ${data.chapters.length} 章索引已生成`);
}
