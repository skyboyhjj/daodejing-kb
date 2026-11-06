/* =====================================================================
   幂等注入脚本：将「原文古版展示」模块接入全部章节
   ---------------------------------------------------------------------
   用法：
     node scripts/inject-original-vintage.js             # 注入（写入）
     node scripts/inject-original-vintage.js --check     # 干跑，只报告
     node scripts/inject-original-vintage.js --revert    # 撤销（移除注入行）
   保证：BOM / 换行符（LF|CRLF）原样保留；重复执行不产生重复行。
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const CHAPTERS_DIR = path.join(__dirname, '..', 'chapters');

const CSS_ANCHOR = '<link rel="stylesheet" href="../css/daodejing-styles.css">';
const CSS_LINE = '<link rel="stylesheet" href="../css/original-vintage.css">';
const JS_ANCHOR = '<script src="../js/level-filter.js"></script>';
const S2T_LINE = '<script src="../js/s2t-data.js"></script>';
const JS_LINE = '<script src="../js/original-vintage.js"></script>';

function readPreserveBom(file) {
    const buf = fs.readFileSync(file);
    const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    const head = hasBom ? buf.slice(3) : buf;
    return { text: head.toString('utf8'), hasBom };
}

function writePreserveBom(file, text, hasBom) {
    const body = Buffer.from(text, 'utf8');
    fs.writeFileSync(file, hasBom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]) : body);
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inject(text, eol) {
    let changed = false;

    if (text.indexOf(CSS_LINE) === -1) {
        if (text.indexOf(CSS_ANCHOR) === -1) {
            throw new Error('缺少 CSS 锚点: ' + CSS_ANCHOR);
        }
        text = text.replace(CSS_ANCHOR, CSS_ANCHOR + eol + '    ' + CSS_LINE);
        changed = true;
    }

    if (text.indexOf(JS_LINE) === -1) {
        if (text.indexOf(JS_ANCHOR) === -1) {
            throw new Error('缺少 JS 锚点: ' + JS_ANCHOR);
        }
        text = text.replace(JS_ANCHOR, JS_ANCHOR + eol + '    ' + S2T_LINE + eol + '    ' + JS_LINE);
        changed = true;
    } else if (text.indexOf(S2T_LINE) === -1) {
        text = text.replace(JS_LINE, S2T_LINE + eol + '    ' + JS_LINE);
        changed = true;
    }

    return { text, changed };
}

function revert(text) {
    let changed = false;

    if (text.indexOf(CSS_LINE) !== -1) {
        text = text.replace(new RegExp('[ \\t]*' + escapeRe(CSS_LINE) + '\\r?\\n'), '');
        changed = true;
    }
    if (text.indexOf(S2T_LINE) !== -1) {
        text = text.replace(new RegExp('[ \\t]*' + escapeRe(S2T_LINE) + '\\r?\\n'), '');
        changed = true;
    }
    if (text.indexOf(JS_LINE) !== -1) {
        text = text.replace(new RegExp('[ \\t]*' + escapeRe(JS_LINE) + '\\r?\\n'), '');
        changed = true;
    }

    return { text, changed };
}

function listChapterFiles() {
    return fs.readdirSync(CHAPTERS_DIR)
        .filter((n) => /^ch\d+\.html$/.test(n))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
}

const mode = process.argv.includes('--revert') ? 'revert'
    : process.argv.includes('--check') ? 'check'
    : 'inject';

const files = listChapterFiles();
let changedCount = 0;
const changedFiles = [];

for (const name of files) {
    const file = path.join(CHAPTERS_DIR, name);
    const { text, hasBom } = readPreserveBom(file);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';

    let result;
    try {
        result = mode === 'revert' ? revert(text) : inject(text, eol);
    } catch (err) {
        console.error('[跳过] ' + name + ' — ' + err.message);
        continue;
    }

    if (result.changed) {
        changedCount++;
        changedFiles.push(name);
        if (mode !== 'check') {
            writePreserveBom(file, result.text, hasBom);
        }
    }
}

console.log('模式: ' + mode);
console.log('章节总数: ' + files.length + '，变更: ' + changedCount);
if (changedFiles.length) {
    console.log('变更文件: ' + changedFiles.join(', '));
}
if (mode === 'check' && changedCount === 0) {
    console.log('（全部已注入，无待变更）');
}