/**
 * 批量替换 HTML 文件中的 .html 硬链接为 clean URL（去掉 .html 后缀）
 *
 * 规则：
 * 1. 跳过外部链接（http://、https://、//）
 * 2. 跳过锚点链接（href="#..."）
 * 3. 跳过 API 路径（href="/api/..."）
 * 4. href="index.html" → href="./"
 * 5. href="xxx/index.html" → href="xxx"（目录 index 隐含）
 * 6. href="xxx.html" → href="xxx"（去掉 .html）
 * 7. 保留查询参数和 hash 锚点
 */

const fs = require('fs');
const path = require('path');

// 需要排除的目录
const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', '.vercel', '.qoder',
    'venv', '__pycache__', 'dist', 'build',
    'GA评估资料'  // docs 下的测试资料
]);

let totalFiles = 0;
let totalReplacements = 0;
let modifiedFiles = [];

/**
 * 检查目录是否应该被排除
 */
function shouldExcludeDir(dirPath) {
    const parts = dirPath.split(path.sep);
    for (const part of parts) {
        if (EXCLUDE_DIRS.has(part)) return true;
    }
    return false;
}

/**
 * 处理单个 HTML 文件
 */
function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    let replacements = 0;

    // 正则需要匹配 href="..." 中的 .html 链接
    // 逐步匹配策略：先找所有 href="..."，再过滤和处理

    content = content.replace(
        /href="((?!https?:\/\/|\/\/|#|\/api\/)[^"?#]*)\.html(([?#][^"]*)?)"/g,
        function (match, pathBefore, suffix) {
            let newPath;

            // 规则 4: 精确匹配 "index" → "./"（根目录的 index）
            if (pathBefore === 'index') {
                newPath = './';
            }
            // 规则 4b: 从子目录链接到父目录的 index，如 "../index" → "../"
            else if (pathBefore.endsWith('/index')) {
                newPath = pathBefore.substring(0, pathBefore.length - 6);  // 去掉 "/index"
                // 如果结果为空（即 "index"），则使用 "./"
                if (newPath === '') newPath = './';
            }
            // 规则 6: 普通 .html → 去掉后缀
            else {
                newPath = pathBefore;
            }

            replacements++;
            return 'href="' + newPath + (suffix || '') + '"';
        }
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
        totalReplacements += replacements;
        modifiedFiles.push({ file: filePath, count: replacements });
        console.log(`  [OK] ${filePath} (${replacements} 处替换)`);
    }
}

/**
 * 递归遍历目录
 */
function walkDir(dir) {
    if (shouldExcludeDir(dir)) return;

    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            processFile(fullPath);
        }
    }
}

// ── 主程序 ──
const projectRoot = path.resolve(__dirname, '..');
console.log('项目根目录: ' + projectRoot);
console.log('开始扫描 HTML 文件...\n');

walkDir(projectRoot);

console.log('\n========== 替换完成 ==========');
console.log('修改文件数: ' + totalFiles);
console.log('替换链接数: ' + totalReplacements);
for (const m of modifiedFiles) {
    console.log('  ' + m.count + ' 处 - ' + path.relative(projectRoot, m.file));
}

if (totalFiles === 0) {
    console.log('\n没有找到需要替换的 .html 链接。');
}
