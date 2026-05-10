/**
 * 自动化流水线编排器
 * 按顺序执行：validate → build-index → version-manifest → report
 * 任何步骤失败则终止并报告
 *
 * 用法：
 *   node scripts/batch-runner.js          # 完整流水线
 *   node scripts/batch-runner.js --quick  # 仅 validate + build-index
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── 流水线步骤定义 ──
const FULL_PIPELINE = [
    { name: 'validate', cmd: 'node scripts/validate.js', desc: '结构质量验证' },
    { name: 'build-index', cmd: 'node scripts/build-index.js', desc: '搜索索引构建' },
    { name: 'version-manifest', cmd: 'node scripts/version-manifest.js', desc: '版本清单更新' },
    { name: 'report', cmd: 'node scripts/report.js', desc: '健康报告生成' }
];

const QUICK_PIPELINE = [
    { name: 'validate', cmd: 'node scripts/validate.js', desc: '结构质量验证' },
    { name: 'build-index', cmd: 'node scripts/build-index.js', desc: '搜索索引构建' }
];

// ── 主流程 ──
function run() {
    const isQuick = process.argv.includes('--quick');
    const pipeline = isQuick ? QUICK_PIPELINE : FULL_PIPELINE;
    const mode = isQuick ? '快速' : '完整';

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  道德经知识库 · 自动化流水线 (${mode}模式)`);
    console.log(`${'═'.repeat(50)}\n`);

    const startTime = Date.now();
    const results = [];

    for (let i = 0; i < pipeline.length; i++) {
        const step = pipeline[i];
        const stepNum = `[${i + 1}/${pipeline.length}]`;

        console.log(`${stepNum} ${step.desc} (${step.name})...`);

        const stepStart = Date.now();
        try {
            const output = execSync(step.cmd, {
                cwd: ROOT,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const elapsed = Date.now() - stepStart;
            console.log(`${stepNum} PASS (${elapsed}ms)`);

            // 输出关键信息行
            const lines = output.split('\n').filter(l => l.trim());
            for (const line of lines.slice(-2)) {
                console.log(`      ${line.trim()}`);
            }
            console.log('');

            results.push({ step: step.name, status: 'pass', elapsed });
        } catch (e) {
            const elapsed = Date.now() - stepStart;
            const output = (e.stdout || '') + '\n' + (e.stderr || '');

            console.log(`${stepNum} FAIL (${elapsed}ms)`);

            // 输出错误信息
            const lines = output.split('\n').filter(l => l.trim());
            for (const line of lines.slice(-5)) {
                console.log(`      ${line.trim()}`);
            }

            results.push({ step: step.name, status: 'fail', elapsed });

            // 失败则终止
            const totalElapsed = Date.now() - startTime;
            console.log(`\n${'─'.repeat(50)}`);
            console.log(`  PIPELINE FAILED at step: ${step.name}`);
            console.log(`  总耗时: ${totalElapsed}ms`);
            console.log(`${'─'.repeat(50)}\n`);
            process.exit(1);
        }
    }

    // 全部通过
    const totalElapsed = Date.now() - startTime;
    console.log(`${'─'.repeat(50)}`);
    console.log(`  PIPELINE COMPLETE (${totalElapsed}ms)`);
    console.log(`  ${results.length}/${results.length} 步骤通过`);
    console.log(`${'─'.repeat(50)}\n`);
}

run();
