/**
 * hui-skill.org 部署回滚脚本
 * 用法: node scripts/rollback.mjs [--target <commit-hash>]
 *
 * 三种回滚方式:
 *   1. Git revert（推荐）: node scripts/rollback.mjs
 *   2. 指定提交回滚:      node scripts/rollback.mjs --target <hash>
 *   3. 仅提示手动操作:    node scripts/rollback.mjs --manual
 */

const { execSync } = require('child_process');

function exec(cmd, opts = {}) {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

const args = process.argv.slice(2);

if (args.includes('--manual')) {
    console.log(`
=== 手动回滚操作指南 ===

方法一：Git revert（同时回滚 Cloudflare + Vercel）
  1. git revert HEAD -m "revert: 回滚 clean URL 迁移"
  2. git push origin main
  3. 等待 2-5 分钟 Cloudflare Pages 和 Vercel 自动重建

方法二：Cloudflare Pages 控制台回滚（仅回滚 CF，紧急情况）
  1. 打开 https://dash.cloudflare.com/
  2. 选择 Pages → daodejing-kb 项目
  3. Deployments → 点击上一个成功的部署 → "Rollback to this deployment"

方法三：Vercel 控制台回滚（仅回滚 Vercel）
  1. 打开 https://vercel.com/skyboyhjjs-projects/daodejing-kb
  2. Deployments → 点击上一个成功的部署 → "Redeploy"
`);
} else {
    const target = args.includes('--target')
        ? args[args.indexOf('--target') + 1]
        : null;

    console.log('\n回滚开始...\n');

    // 显示当前状态
    const status = exec('git status --short');
    if (status) {
        console.log('WARNING: 工作区有未提交的变更，可能影响回滚。');
        console.log(status);
    }

    // 方法一: revert
    if (target) {
        console.log(`回滚到提交: ${target}`);
        const cmd = `git revert --no-commit ${target}..HEAD && git commit -m "revert: 回滚 clean URL 迁移到 ${target}"`;
        console.log(`执行: ${cmd}`);
        console.log('\n请手动确认后执行以上命令。');
    } else {
        // 找到上一个提交（本次 clean URL 提交的前一个）
        const prevHash = exec('git log --skip=1 --max-count=1 --format=%H');
        const currentMsg = exec('git log --max-count=1 --format=%s');

        console.log(`当前 HEAD: ${currentMsg}`);
        console.log(`上一个提交: ${prevHash}`);
        console.log(`\n回滚命令（请手动确认后执行）:`);
        console.log(`  git revert HEAD --no-edit`);
        console.log(`  git push origin main`);
        console.log(`\n或回滚到指定提交:`);
        console.log(`  git reset --hard ${prevHash}`);
        console.log(`  git push --force origin main  # 慎用 force push`);
    }

    console.log('\nGitHub → Cloudflare Pages → Vercel 自动部署将在 2-5 分钟内生效。');
}
