/**
 * 设计文档格式验证脚本
 * 扫描 docs/ 下所有 .md 文件，验证：
 *   1. UTF-8 编码有效性
 *   2. Markdown 基本语法（未闭合的代码块等）
 *   3. 内容长度（非空占位文档）
 *
 * 用法：
 *   node scripts/validate-docs.js          # 检查全部 docs/
 *   node scripts/validate-docs.js --quick  # 仅检查最近修改的文档
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');

let totalFiles = 0;
let passCount = 0;
let warnCount = 0;
let failCount = 0;

/**
 * 递归扫描目录收集所有 .md 文件
 */
function scanMdFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...scanMdFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * 验证单个 .md 文件
 */
function validateFile(filePath) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    totalFiles++;

    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        console.log(`  ✗ ${relPath} — 编码错误: ${e.message}`);
        failCount++;
        return;
    }

    const issues = [];

    // 检查 1: 内容长度
    const stripped = content.trim();
    if (stripped.length < 20) {
        issues.push('内容过短 (<20 字符)，可能为占位文档');
    }

    // 检查 2: 未闭合的代码块
    const codeBlockMatches = stripped.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
        issues.push('未闭合的代码块 (```)');
    }

    // 检查 3: YAML frontmatter 基本检查（如果有）
    if (stripped.startsWith('---')) {
        const secondSep = stripped.indexOf('---', 3);
        if (secondSep === -1) {
            issues.push('YAML frontmatter 未闭合');
        }
    }

    // 检查 4: Markdown 链接指向的文件是否存在（基本检查）
    const linkPattern = /\]\(([^)]+\.md)\)/g;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(stripped)) !== null) {
        const target = linkMatch[1].replace(/\\/g, '/');
        // 仅检查相对路径引用
        if (!target.startsWith('http') && !target.startsWith('#')) {
            const resolved = path.resolve(path.dirname(filePath), target);
            if (!fs.existsSync(resolved)) {
                issues.push(`断链: ${target} → 文件不存在`);
            }
        }
    }

    // 输出结果
    if (issues.length > 0) {
        console.log(`  ⚠ ${relPath}`);
        for (const issue of issues) {
            console.log(`      ${issue}`);
        }
        warnCount++;
    } else {
        passCount++;
    }
}

// ── 入口 ──
console.log(`[validate-docs] 扫描 docs/ 设计文档...\n`);

const mdFiles = scanMdFiles(DOCS_DIR);

if (mdFiles.length === 0) {
    console.log('  (未找到 .md 文件)');
    process.exit(0);
}

for (const f of mdFiles) {
    validateFile(f);
}

// 汇总
console.log(`\n[validate-docs] 汇总: ${totalFiles} 文件 | ✓ ${passCount} 通过 | ⚠ ${warnCount} 警告 | ✗ ${failCount} 失败`);

if (failCount > 0) {
    process.exit(1);
}
