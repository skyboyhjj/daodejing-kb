/**
 * 恢复 data/family_metadata.json（完整版元数据）
 * =============================================
 * 完整版元数据包含敏感审计字段（reviewed_by/reviewed_at/review_history），
 * 不进版本库（.gitignore L47）。本地缺此文件时，GET /api/metadata 返回 500。
 *
 * 本脚本从 git 历史提交 4a2ea7d 恢复该文件（该提交是删除此文件的前一次提交，
 * 仍保留完整 81 章内容）。
 *
 * 通过 child_process 直接拿原始字节写入，跨平台无编码/BOM 问题。
 *
 * 用法:
 *   node scripts/restore-family-metadata.js            # 不存在时恢复；已存在则跳过
 *   node scripts/restore-family-metadata.js --force     # 强制覆盖
 *
 * 恢复后校验一致性（应得到 hash=1bcf082b）:
 *   npm run check:metadata
 *
 * 依赖: Node >= 16（标准库 + 系统 git 命令，无 npm 依赖）
 */

'use strict';

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var SOURCE_COMMIT = '4a2ea7d9ffbd5e820091bdbb4b7c37b3b5fa863c';
var SOURCE_PATH = 'data/family_metadata.json';
var ROOT = path.join(__dirname, '..');
var TARGET_PATH = path.join(ROOT, SOURCE_PATH);
var FORCE = process.argv.indexOf('--force') !== -1;

function main() {
    if (fs.existsSync(TARGET_PATH) && !FORCE) {
        console.log('[restore-family-metadata] 目标文件已存在，跳过（如需覆盖请加 --force）: ' + SOURCE_PATH);
        printHint();
        return;
    }

    try {
        var buf = child_process.execFileSync('git', [
            'show', SOURCE_COMMIT + ':' + SOURCE_PATH
        ], { maxBuffer: 64 * 1024 * 1024 });

        fs.writeFileSync(TARGET_PATH, buf);
        console.log('[restore-family-metadata] 已恢复 ' + SOURCE_PATH + '（' + buf.length + ' bytes，来源 ' + SOURCE_COMMIT.slice(0, 7) + '）');
        printHint();
    } catch (e) {
        var detail = e.stderr ? e.stderr.toString() : e.message;
        console.error('[restore-family-metadata] 恢复失败:', detail.trim());
        console.error('  请确认已安装 git，且提交 ' + SOURCE_COMMIT.slice(0, 7) + ' 存在于本地仓库历史中。');
        process.exit(1);
    }
}

function printHint() {
    console.log('  校验一致性: npm run check:metadata');
    console.log('  ⚠ 该文件被 .gitignore 忽略，不要提交。');
}

main();