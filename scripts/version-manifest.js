/**
 * 版本清单生成脚本
 * 为每个章节文件生成内容 hash，追踪变更历史
 * 输出 data/chapter-manifest.json
 *
 * 用法：
 *   node scripts/version-manifest.js          # 生成/更新清单
 *   node scripts/version-manifest.js --diff   # 显示自上次以来的变更
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── 路径配置 ──
const ROOT = path.join(__dirname, '..');
const CHAPTERS_DIR = path.join(ROOT, 'chapters');
const MANIFEST_PATH = path.join(ROOT, 'data', 'chapter-manifest.json');

/**
 * 计算文件内容 SHA-256 hash（前 12 位）
 */
function fileHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/**
 * 获取文件最后修改时间
 */
function fileMtime(filePath) {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * 检测章节是否包含四层级内容
 */
function detectLevels(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
        hasL1: /data-level="l1"/.test(content),
        hasL2: /data-level="l2"/.test(content),
        hasL3: /data-level="l3"/.test(content),
        hasL4: /data-level="l4"/.test(content),
        hasLevelSelector: /class="level-selector"/.test(content)
    };
}

/**
 * 主流程：扫描所有章节，生成清单
 */
function buildManifest() {
    const files = fs.readdirSync(CHAPTERS_DIR)
        .filter(f => /^ch\d+\.html$/.test(f))
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)[0], 10);
            const nb = parseInt(b.match(/\d+/)[0], 10);
            return na - nb;
        });

    const entries = {};

    for (const file of files) {
        const filePath = path.join(CHAPTERS_DIR, file);
        const num = parseInt(file.match(/\d+/)[0], 10);
        const hash = fileHash(filePath);
        const modified = fileMtime(filePath);
        const levels = detectLevels(filePath);

        const completeness = [
            levels.hasLevelSelector,
            levels.hasL1,
            levels.hasL2,
            levels.hasL3,
            levels.hasL4
        ].filter(Boolean).length;

        entries[file] = {
            num,
            hash,
            modified,
            completeness: `${completeness}/5`,
            fullUpgrade: completeness === 5
        };
    }

    return {
        generated: new Date().toISOString(),
        totalChapters: files.length,
        fullyUpgraded: Object.values(entries).filter(e => e.fullUpgrade).length,
        chapters: entries
    };
}

/**
 * --diff 模式：比较与现有清单的差异
 */
function showDiff(newManifest) {
    if (!fs.existsSync(MANIFEST_PATH)) {
        console.log('[version-manifest] 无历史清单，全部视为新增');
        return;
    }

    const old = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    const oldChapters = old.chapters || {};
    const newChapters = newManifest.chapters;

    let changed = 0;
    let added = 0;

    for (const [file, entry] of Object.entries(newChapters)) {
        if (!oldChapters[file]) {
            console.log(`  + ${file} (新增)`);
            added++;
        } else if (oldChapters[file].hash !== entry.hash) {
            console.log(`  ~ ${file} (已变更: ${oldChapters[file].hash} → ${entry.hash})`);
            changed++;
        }
    }

    if (changed === 0 && added === 0) {
        console.log('[version-manifest] 无变更');
    } else {
        console.log(`\n[version-manifest] 汇总: ${added} 新增, ${changed} 变更`);
    }
}

// ── 入口 ──
const isDiff = process.argv.includes('--diff');
const manifest = buildManifest();

if (isDiff) {
    showDiff(manifest);
} else {
    // 确保 data 目录存在
    const dataDir = path.dirname(MANIFEST_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`[version-manifest] 清单已生成: ${path.relative(ROOT, MANIFEST_PATH)}`);
    console.log(`[version-manifest] 章节总数: ${manifest.totalChapters}`);
    console.log(`[version-manifest] 完整升级: ${manifest.fullyUpgraded}/${manifest.totalChapters}`);
}
