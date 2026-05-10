/**
 * 项目健康报告生成脚本
 * 聚合 validate、build-index、version-manifest 的输出，生成统一报告
 * 输出 data/quality-report.json
 *
 * 用法：
 *   node scripts/report.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── 路径配置 ──
const ROOT = path.join(__dirname, '..');
const CHAPTERS_DIR = path.join(ROOT, 'chapters');
const REPORT_PATH = path.join(ROOT, 'data', 'quality-report.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'chapter-manifest.json');

// ── 有效概念标签清单 ──
const VALID_CONCEPTS = [
    'dao', 'de', 'wuwei', 'ziran', 'fan', 'xuan',
    'rouruo', 'pu', 'yi', 'jing', 'xia', 'zhizu',
    'buzheng', 'qiantui', 'yinger', 'shouzhong'
];

/**
 * 收集各维度数据
 */
function collectMetrics() {
    const files = fs.readdirSync(CHAPTERS_DIR)
        .filter(f => /^ch\d+\.html$/.test(f))
        .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    let totalSize = 0;
    let withLevels = 0;
    let withGreeting = 0;
    let withConcepts = 0;
    const conceptUsage = {};

    for (const file of files) {
        const filePath = path.join(CHAPTERS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        totalSize += Buffer.byteLength(content);

        if (/data-level="l1"/.test(content)) withLevels++;
        if (/<!-- 慧惠章节问候 -->/.test(content)) withGreeting++;

        const re = /class="concept-tag\s+([a-z]+)"/g;
        let m;
        let hasConcept = false;
        while ((m = re.exec(content)) !== null) {
            hasConcept = true;
            const tag = m[1];
            conceptUsage[tag] = (conceptUsage[tag] || 0) + 1;
        }
        if (hasConcept) withConcepts++;
    }

    return {
        totalChapters: files.length,
        totalSizeKB: Math.round(totalSize / 1024),
        withFourLevels: withLevels,
        withHuihuiGreeting: withGreeting,
        withConceptTags: withConcepts,
        conceptUsage,
        unusedConcepts: VALID_CONCEPTS.filter(c => !conceptUsage[c])
    };
}

/**
 * 运行验证并捕获结果
 */
function runValidation() {
    try {
        const output = execSync('node scripts/validate.js', {
            cwd: ROOT,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        // 解析通过率
        const m = output.match(/(\d+)\/(\d+) 通过/);
        return {
            passed: true,
            passRate: m ? `${m[1]}/${m[2]}` : 'unknown',
            passPercent: m ? Math.round(parseInt(m[1]) / parseInt(m[2]) * 100) : 0
        };
    } catch (e) {
        const output = (e.stdout || '') + (e.stderr || '');
        const m = output.match(/(\d+)\/(\d+) 通过/);
        const failMatch = output.match(/(\d+) 个文件有问题/);
        return {
            passed: false,
            passRate: m ? `${m[1]}/${m[2]}` : 'unknown',
            passPercent: m ? Math.round(parseInt(m[1]) / parseInt(m[2]) * 100) : 0,
            failedFiles: failMatch ? parseInt(failMatch[1]) : 0
        };
    }
}

/**
 * 检查搜索索引状态
 */
function checkSearchIndex() {
    try {
        execSync('node scripts/build-index.js --check', {
            cwd: ROOT,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return { upToDate: true };
    } catch (e) {
        return { upToDate: false, message: '搜索索引需要重新生成' };
    }
}

/**
 * 读取版本清单摘要
 */
function getManifestSummary() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        return { exists: false };
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    return {
        exists: true,
        generated: manifest.generated,
        totalChapters: manifest.totalChapters,
        fullyUpgraded: manifest.fullyUpgraded
    };
}

// ── 主流程 ──
function generateReport() {
    console.log('[report] 生成项目健康报告...\n');

    const metrics = collectMetrics();
    const validation = runValidation();
    const searchIndex = checkSearchIndex();
    const manifest = getManifestSummary();

    const report = {
        generated: new Date().toISOString(),
        summary: {
            overallHealth: validation.passPercent >= 90 ? 'GOOD' :
                validation.passPercent >= 70 ? 'FAIR' : 'NEEDS_ATTENTION',
            validationPassRate: validation.passRate,
            searchIndexUpToDate: searchIndex.upToDate,
            fourLevelCoverage: `${metrics.withFourLevels}/${metrics.totalChapters}`
        },
        metrics,
        validation,
        searchIndex,
        manifest
    };

    // 确保 data 目录存在
    const dataDir = path.dirname(REPORT_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');

    // 输出摘要
    console.log('  项目健康状态:', report.summary.overallHealth);
    console.log('  验证通过率:', report.summary.validationPassRate);
    console.log('  搜索索引:', searchIndex.upToDate ? '最新' : '需更新');
    console.log('  四层级覆盖:', report.summary.fourLevelCoverage);
    console.log('  慧惠问候覆盖:', `${metrics.withHuihuiGreeting}/${metrics.totalChapters}`);
    console.log('  概念标签覆盖:', `${metrics.withConceptTags}/${metrics.totalChapters}`);
    console.log('  知识库总大小:', `${metrics.totalSizeKB} KB`);

    if (metrics.unusedConcepts.length > 0) {
        console.log('  未使用的概念标签:', metrics.unusedConcepts.join(', '));
    }

    console.log(`\n[report] 报告已保存: ${path.relative(ROOT, REPORT_PATH)}`);
}

generateReport();
