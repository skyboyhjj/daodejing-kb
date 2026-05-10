/**
 * 批量微调章节页面脚本
 * 为 81 个章节页面添加：
 * 1. 慧惠章节问候（在 </h1> 之后）
 * 2. AI 角色标注（在 <!-- 五步导航 --> 之前）
 */
const fs = require('fs');
const path = require('path');

const chaptersDir = path.join(__dirname, '..', 'chapters');

const huihuiGreeting = `\n    <!-- 慧惠章节问候 -->\n    <div style="background:#f0f5f3;border-left:4px solid #2e5f5f;padding:14px 18px;border-radius:6px;margin:16px 0;font-size:0.95em;color:#555;line-height:1.7;">\n        &#127807; <strong>慧惠说：</strong>这一章我们一起来读。你可以先看看"白话版"，轻松感受一下老子想说什么。如果有兴趣，再用"精读版"深挖。\n    </div>`;

const aiRoleNote = `\n    <!-- AI角色标注 -->\n    <div style="background:#fffef5;border:1px dashed #d4c9a8;padding:12px 16px;border-radius:6px;margin:16px 0;font-size:0.85em;color:#888;line-height:1.7;">\n        &#9888;&#65039; 本章解读由<strong style="color:#2e5f5f;">慧惠AI初审</strong> + <strong style="color:#2e5f5f;">人类导师深度修订</strong>。AI提供结构化分析和多版本对照，人类注入对原文的体证与情感理解。\n    </div>`;

const files = fs.readdirSync(chaptersDir).filter(f => /^ch\d+\.html$/.test(f));
console.log(`Found ${files.length} chapter files.`);

let updatedCount = 0;
let skippedCount = 0;

for (const file of files) {
    const filePath = path.join(chaptersDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if already modified (look for the AI role annotation)
    if (content.includes('AI角色标注')) {
        console.log(`  ${file}: already updated, skipping.`);
        skippedCount++;
        continue;
    }

    // Step 1: Insert huihui greeting after </h1>
    // Match: </h1> followed by optional whitespace and <!-- 五步导航 -->
    const h1Pattern = /(<\/h1>)(\s*)(<!-- 五步导航 -->)/;
    if (h1Pattern.test(content)) {
        content = content.replace(h1Pattern, `$1${huihuiGreeting}$2${aiRoleNote}$2$3`);
    } else {
        console.log(`  ${file}: WARNING - could not find standard pattern (</h1> ... <!-- 五步导航 -->)`);
        skippedCount++;
        continue;
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ${file}: updated.`);
    updatedCount++;
}

console.log(`\nDone. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
