/**
 * 搜索索引自动构建脚本
 * 从 81 个章节 HTML + 概念 HTML + docs/ 设计文档中提取全文搜索内容，
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
const DOCS_DIR = path.join(ROOT, 'docs');
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
    // 移除 emoji 前缀
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
 * 提取章节支持的认知层级
 */
function extractLevels(html) {
    const levels = [];
    const re = /data-level="(l[1-4])"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const lv = m[1];
        if (!levels.includes(lv)) levels.push(lv);
    }
    if (levels.length === 0) {
        levels.push('l1', 'l2', 'l3', 'l4');
    }
    levels.sort();
    return levels;
}

/**
 * 提取全文搜索文本
 */
function extractFullText(html) {
    let text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) text = bodyMatch[1];

    text = text.replace(/<[^>]+>/g, '');
    text = text
        .replace(/&[a-z]+;/gi, '')
        .replace(/&#\d+;/g, '')
        .replace(/&#x[0-9a-f]+;/gi, '');

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

// ── Markdown 文档提取工具 ──

/**
 * 提取 Markdown 文档标题（第一个 # 开头的行）
 */
function extractMdTitle(mdText) {
    const lines = mdText.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^#\s+(.*)/);
        if (m) {
            return m[1].replace(/[#*`\[\]]/g, '').trim();
        }
    }
    return '';
}

/**
 * 提取 Markdown 纯文本（去除标记符号，保留中文正文）
 */
function extractMdPlainText(mdText) {
    return mdText
        .replace(/^---[\s\S]*?---\n?/m, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/^>\s+/gm, '')
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        .replace(/^\|?[-:| ]+\|?$/gm, '')
        .replace(/\|/g, ' ')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[\s\n\r]+/g, ' ')
        .trim();
}

/**
 * 递归扫描目录，返回所有 .md 文件路径列表
 */
function scanDocsDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...scanDocsDir(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(fullPath);
        }
    }
    return results;
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
            url: 'chapters/' + file.replace(/\.html$/, ''),
            levels: extractLevels(html)
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
                    url: 'concepts/' + cf.replace(/\.html$/, ''),
                    levels: ['l1', 'l2', 'l3', 'l4']
                });
            }
        }
    }

    // ── 索引设计文档（docs/ 下所有 .md 文件）──
    const docs = [];
    if (fs.existsSync(DOCS_DIR)) {
        const mdFiles = scanDocsDir(DOCS_DIR);

        console.log(`[build-index] 扫描到 ${mdFiles.length} 个设计文档 (.md)`);

        for (const mdPath of mdFiles) {
            let mdText;
            try {
                mdText = fs.readFileSync(mdPath, 'utf-8');
            } catch (e) {
                console.warn(`  WARN: 无法读取 ${path.relative(ROOT, mdPath)}: ${e.message}`);
                continue;
            }

            const docTitle = extractMdTitle(mdText)
                || path.basename(mdPath, '.md');
            const docText = extractMdPlainText(mdText);

            if (docText.length < 30) {
                console.warn(`  SKIP: ${path.relative(ROOT, mdPath)} 内容过短 (${docText.length} 字符)`);
                continue;
            }

            const relPath = path.relative(ROOT, mdPath).replace(/\\/g, '/');
            const docUrl = relPath.replace(/\.md$/, '');

            docs.push({
                title: docTitle,
                text: docText,
                url: docUrl,
                type: 'doc',
                levels: ['l1', 'l2', 'l3', 'l4']
            });
        }
    }

    return { chapters, concepts, docs };
}

function writeOutput(data) {
    const dataDir = path.join(ROOT, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const jsContent = [
        '// 道德经知识库搜索索引 (脚本化版本，兼容 file:// 协议)',
        '// 此文件通过 <script> 标签加载，不受浏览器 CORS 限制',
        '// 自动生成，请勿手动编辑 — 运行 npm run build:index 重新生成',
        `window.__DaoSearchData = ${JSON.stringify(data)};`,
        ''
    ].join('\n');

    fs.writeFileSync(OUTPUT_JS, jsContent, 'utf-8');

    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(OUTPUT_JSON, jsonContent, 'utf-8');

    console.log(`[build-index] 输出: ${path.relative(ROOT, OUTPUT_JS)} (${(Buffer.byteLength(jsContent) / 1024).toFixed(1)} KB)`);
    console.log(`[build-index] 输出: ${path.relative(ROOT, OUTPUT_JSON)} (${(Buffer.byteLength(jsonContent) / 1024).toFixed(1)} KB)`);
}

/**
 * --check 模式：比较当前源文件的 hash 与已生成索引的 hash
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
    console.log(`[build-index] 完成: ${data.chapters.length} 章 + ${data.concepts.length} 概念 + ${data.docs.length} 文档索引已生成`);
}
