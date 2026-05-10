/**
 * 章节质量验证脚本
 * 对 81 个章节 HTML 文件执行结构化质量检查
 *
 * 用法：
 *   node scripts/validate.js          # 运行所有检查
 *   node scripts/validate.js --fix    # 自动修复可修复项（预留）
 *   node scripts/validate.js ch01     # 仅验证指定章节
 */
const fs = require('fs');
const path = require('path');

// ── 路径配置 ──
const ROOT = path.join(__dirname, '..');
const CHAPTERS_DIR = path.join(ROOT, 'chapters');

// ── 有效概念标签清单 ──
const VALID_CONCEPTS = [
    'dao', 'de', 'wuwei', 'ziran', 'fan', 'xuan',
    'rouruo', 'pu', 'yi', 'jing', 'xia', 'zhizu',
    'buzheng', 'qiantui', 'yinger', 'shouzhong'
];

// ── 检查规则定义 ──
const RULES = [
    // S1: 基础 HTML 结构
    {
        id: 'S1-DOCTYPE',
        desc: '必须以 <!DOCTYPE html> 开头',
        check: (html) => /^<!DOCTYPE html>/i.test(html.trim())
    },
    {
        id: 'S1-LANG',
        desc: 'html 标签需含 lang="zh-CN"',
        check: (html) => /<html[^>]*lang="zh-CN"/i.test(html)
    },
    {
        id: 'S1-CHARSET',
        desc: '需含 meta charset UTF-8',
        check: (html) => /<meta[^>]*charset=["']?UTF-8/i.test(html)
    },
    {
        id: 'S1-VIEWPORT',
        desc: '需含 viewport meta 标签',
        check: (html) => /<meta[^>]*name=["']viewport/i.test(html)
    },

    // S2: 标题结构
    {
        id: 'S2-H1',
        desc: '必须有且仅有一个 <h1> 标签',
        check: (html) => {
            const matches = html.match(/<h1[\s>]/gi);
            return matches && matches.length === 1;
        }
    },
    {
        id: 'S2-TITLE-FORMAT',
        desc: '<title> 需含章节编号和"道德经亲子体验营"',
        check: (html, meta) => {
            const m = html.match(/<title>([^<]*)<\/title>/i);
            if (!m) return false;
            return m[1].includes('道德经亲子体验营') && /第?\d+章/.test(m[1]);
        }
    },
    {
        id: 'S2-CHAPTER-NUM',
        desc: '<h1> 中的章节编号需与文件名一致',
        check: (html, meta) => {
            const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (!h1) return false;
            const numInH1 = h1[1].match(/第(\d+)章/);
            return numInH1 && parseInt(numInH1[1], 10) === meta.num;
        }
    },

    // S3: 五步导航
    {
        id: 'S3-NAV',
        desc: '必须含五步导航区块',
        check: (html) => /<!-- 五步导航 -->/.test(html)
    },
    {
        id: 'S3-NAV-LINKS',
        desc: '五步导航需含 5 个步骤链接',
        check: (html) => {
            const navMatch = html.match(/class="five-step-nav"[^>]*>([\s\S]*?)<\/div>/i);
            if (!navMatch) return false;
            const links = navMatch[1].match(/<a\s/g);
            return links && links.length === 5;
        }
    },

    // S4: 原文区块
    {
        id: 'S4-ORIGINAL',
        desc: '必须含 div.original-text 原文区块',
        check: (html) => /class="original-text"/.test(html)
    },
    {
        id: 'S4-NOT-EMPTY',
        desc: '原文区块不能为空',
        check: (html) => {
            const m = html.match(/<div\s+class="original-text"[^>]*>([\s\S]*?)<\/div>/i);
            if (!m) return false;
            const text = m[1].replace(/<[^>]+>/g, '').trim();
            return text.length > 10;
        }
    },

    // S5: 认知层级
    {
        id: 'S5-LEVEL-SELECTOR',
        desc: '必须含认知层级选择器',
        check: (html) => /class="level-selector"/.test(html)
    },
    {
        id: 'S5-L1',
        desc: '必须含 L1（白话）层级内容',
        check: (html) => /data-level="l1"/.test(html)
    },
    {
        id: 'S5-L2',
        desc: '必须含 L2（精读）层级内容',
        check: (html) => /data-level="l2"/.test(html)
    },
    {
        id: 'S5-L3',
        desc: '必须含 L3（应用）层级内容',
        check: (html) => /data-level="l3"/.test(html)
    },
    {
        id: 'S5-L4',
        desc: '必须含 L4（学术）层级内容',
        check: (html) => /data-level="l4"/.test(html)
    },

    // S6: 概念标签
    {
        id: 'S6-HAS-CONCEPTS',
        desc: '至少包含 1 个概念标签',
        check: (html) => /class="concept-tag\s+[a-z]+"/.test(html)
    },
    {
        id: 'S6-VALID-CONCEPTS',
        desc: '所有概念标签必须在有效清单内',
        check: (html) => {
            const re = /class="concept-tag\s+([a-z]+)"/g;
            let m;
            while ((m = re.exec(html)) !== null) {
                if (!VALID_CONCEPTS.includes(m[1])) return false;
            }
            return true;
        }
    },

    // S7: 慧惠元素
    {
        id: 'S7-GREETING',
        desc: '需含慧惠章节问候',
        check: (html) => /<!-- 慧惠章节问候 -->/.test(html)
    },
    {
        id: 'S7-AI-NOTE',
        desc: '需含 AI 角色标注',
        check: (html) => /<!-- AI角色标注 -->/.test(html)
    },

    // S8: 章节导航
    {
        id: 'S8-CSS',
        desc: '需链接到统一样式文件',
        check: (html) => /href="\.\.\/css\/daodejing-styles\.css"/.test(html)
    },
    {
        id: 'S8-CLOSING',
        desc: 'HTML 标签需正确闭合',
        check: (html) => /<\/html>\s*$/.test(html.trim())
    }
];

// ── 主流程 ──

function validateFile(filePath, num) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const meta = { num, filePath };
    const results = [];

    for (const rule of RULES) {
        const passed = rule.check(html, meta);
        results.push({
            id: rule.id,
            desc: rule.desc,
            passed
        });
    }

    return results;
}

function run() {
    const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const isFix = process.argv.includes('--fix');

    // 获取要验证的文件列表
    let files;
    if (args.length > 0) {
        // 指定章节，如 "ch01" 或 "1"
        files = args.map(arg => {
            const num = parseInt(arg.replace(/^ch0*/, ''), 10);
            return `ch${String(num).padStart(2, '0')}.html`;
        });
    } else {
        files = fs.readdirSync(CHAPTERS_DIR)
            .filter(f => /^ch\d+\.html$/.test(f))
            .sort((a, b) => {
                const na = parseInt(a.match(/\d+/)[0], 10);
                const nb = parseInt(b.match(/\d+/)[0], 10);
                return na - nb;
            });
    }

    console.log(`[validate] 检查 ${files.length} 个章节文件，${RULES.length} 条规则\n`);

    let totalPass = 0;
    let totalFail = 0;
    const failedChapters = [];

    for (const file of files) {
        const filePath = path.join(CHAPTERS_DIR, file);

        if (!fs.existsSync(filePath)) {
            console.error(`  ERROR: ${file} 不存在`);
            totalFail++;
            continue;
        }

        const num = parseInt(file.match(/\d+/)[0], 10);
        const results = validateFile(filePath, num);

        const failures = results.filter(r => !r.passed);
        const passes = results.filter(r => r.passed);

        totalPass += passes.length;
        totalFail += failures.length;

        if (failures.length > 0) {
            console.log(`  FAIL  ${file} (${failures.length}/${results.length} 项不通过)`);
            for (const f of failures) {
                console.log(`        ✗ [${f.id}] ${f.desc}`);
            }
            failedChapters.push({ file, failures });
        }
    }

    // 汇总报告
    const totalChecks = totalPass + totalFail;
    console.log('\n' + '─'.repeat(50));
    console.log(`[validate] 结果: ${totalPass}/${totalChecks} 通过`);

    if (totalFail > 0) {
        console.log(`[validate] ${failedChapters.length} 个文件有问题，共 ${totalFail} 项不通过`);

        if (isFix) {
            console.log('\n[validate] --fix 模式：自动修复功能将在后续版本实现');
        }

        process.exit(1);
    } else {
        console.log(`[validate] 所有 ${files.length} 个章节文件通过全部 ${RULES.length} 条规则检查`);
    }
}

run();
