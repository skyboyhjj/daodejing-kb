/* ============================================================
   孔门地图 (Kongmen Map) - 核心交互引擎
   设计依据：《孔门地图 V2.0 · 设计方案》+《Qoder执行提示词》
   方位依据：《四科十哲方位五行推演》
   ============================================================ */

(function () {
    'use strict';

    // ==========================================================
    // 一、数据层：十哲 + 方位 + 精确坐标
    // ==========================================================
    const SAGES = [
        {
            id: 'yan_hui', name: '颜回', alias: '子渊', quality: '默',
            category: 'virtue', categoryName: '德行', axis: 'wisdom', axisName: '识位轴',
            color: 'dexing', direction: 'east', position: 'east-center',
            biography: '颜回，字子渊。孔子最得意的弟子，以"不违如愚"著称。居陋巷，箪食瓢饮，人不堪其忧，回也不改其乐。早卒，孔子哭之恸，曰"天丧予"。',
            insight: '沉默不是无话可说，是听懂了不必多说。',
            chapters: ['为政·9', '雍也·7', '先进·7', '颜渊·1'],
            practices: [
                '今日觉察：话到嘴边时，停三秒',
                '试着用行动而非言语回应一件事',
                '在一个人的时候，感受"不孤单的安静"'
            ],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'min_ziqian', name: '闵子骞', alias: '子骞', quality: '化',
            category: 'virtue', categoryName: '德行', axis: 'wisdom', axisName: '识位轴',
            color: 'dexing', direction: 'east', position: 'east-south',
            biography: '闵损，字子骞。以孝行闻名，"鞭打芦花"典故的主人公。后母虐之，损衣芦花，父怒欲出后母，损跪曰"母在一子单，母去三子寒"，父感而止。',
            insight: '化怨为恕，不是软弱，是最深的勇敢。',
            chapters: ['先进·13'],
            practices: ['面对不公时，先问"我能化什么"', '今天对一个人说一句"没关系"', '记录一次自己和自己的和解'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'ran_boniu', name: '冉伯牛', alias: '伯牛', quality: '厚',
            category: 'virtue', categoryName: '德行', axis: 'wisdom', axisName: '识位轴',
            color: 'dexing', direction: 'east', position: 'east-north',
            biography: '冉耕，字伯牛。以德行著称，惜身患恶疾。孔子探望时执其手曰"命矣夫，斯人也而有斯疾也"，痛惜之情溢于言表。',
            insight: '厚德者不争，不是无力，是不屑。',
            chapters: ['雍也·8'],
            practices: ['今天做一件不求回报的好事', '被人误解时，先沉默而不是先辩解', '在冲突中主动退一步'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'zhonggong', name: '仲弓', alias: '仲弓', quality: '简',
            category: 'virtue', categoryName: '德行', axis: 'wisdom', axisName: '识位轴',
            color: 'dexing', direction: 'east', position: 'east-far-north',
            biography: '冉雍，字仲弓。出身微贱而德行卓著，孔子赞之"犁牛之子骍且角"。曾任季氏宰，为政以简，以德化民。',
            insight: '简单是最难的修行，也是最高的境界。',
            chapters: ['雍也·1', '子路·2'],
            practices: ['清理一个不需要的物品或习惯', '简化今天的一件事', '对复杂的情况说"先从这里开始"'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'zai_wo', name: '宰我', alias: '子我', quality: '问',
            category: 'speech', categoryName: '言语', axis: 'spatial', axisName: '宇位轴',
            color: 'yanyu', direction: 'south', position: 'south-west',
            biography: '宰予，字子我。以善辩著称，敢于质疑——曾问"三年之丧"是否太长，引发孔子"予之不仁也"之叹。昼寝被孔子责"朽木不可雕"，但位列十哲，可见其才。',
            insight: '敢于问的人，比自己以为的更勇敢。',
            chapters: ['八佾·21', '公冶长·10', '阳货·21'],
            practices: ['今天对一件"理所当然"的事提出一个疑问', '向一个有经验的人请教一个问题', '记录一个你长期不敢问自己的问题'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'zigong', name: '子贡', alias: '子贡', quality: '达',
            category: 'speech', categoryName: '言语', axis: 'spatial', axisName: '宇位轴',
            color: 'yanyu', direction: 'south', position: 'south-center',
            biography: '端木赐，字子贡。孔门首富，善货殖，亦善言辞。"瑚琏之器"乃孔子许之。"存鲁乱齐"展现了卓越的外交才能。孔子卒后，守墓六年。',
            insight: '通达不是圆滑，是心里有路，嘴上有人。',
            chapters: ['学而·10', '公冶长·4', '子张·23'],
            practices: ['今天和一个人对话时，先理解再表达', '处理一件事时，找出各方都能接受的方案', '反思一次最近的沟通：你"达"了吗'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'ran_you', name: '冉有', alias: '子有', quality: '艺',
            category: 'politics', categoryName: '政事', axis: 'temporal', axisName: '时位轴',
            color: 'zhengshi', direction: 'west', position: 'west-south',
            biography: '冉求，字子有。擅长理财和行政管理，多才多艺。为季氏宰时聚敛财富，孔子怒曰"非吾徒也，小子鸣鼓而攻之可也"。然最终位列十哲。',
            insight: '才能是刀。刀刃向外是建树，刀刃向内是修行。',
            chapters: ['先进·16', '子路·9'],
            practices: ['审视今天的一件事：做得漂亮，但做得对吗', '发挥一个才能，但记住它服务于谁', '在效率与善意冲突时，选择善意'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'zilu', name: '子路', alias: '子路', quality: '勇',
            category: 'politics', categoryName: '政事', axis: 'temporal', axisName: '时位轴',
            color: 'zhengshi', direction: 'west', position: 'west-center',
            biography: '仲由，字子路。孔门最勇者，闻过则喜。好勇斗狠，孔子常抑之。后仕于卫，临难结缨而死，至死不忘君子之礼。',
            insight: '真正的勇敢不是不怕，是怕了还往前走。',
            chapters: ['公冶长·26', '述而·10', '卫灵公·2'],
            practices: ['今天面对一件一直逃避的事', '承认一次"我害怕但我会做"', '为自己的勇敢行为写一句话的总结'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'ziyou', name: '子游', alias: '子游', quality: '文',
            category: 'literature', categoryName: '文学', axis: 'causality', axisName: '缘位轴',
            color: 'wenxue', direction: 'north', position: 'north-east',
            biography: '言偃，字子游。以文学著称，长于礼乐。为武城宰时，以弦歌治邑，孔子闻之莞尔。与子夏并为文学科代表。',
            insight: '弦歌不辍的不是乐器，是你对美好的坚持。',
            chapters: ['阳货·4', '子张·12'],
            practices: ['今天让美进入生活——一首诗、一曲乐、一幅画', '在工作中加入一点"美"的考量', '教别人一件你擅长的事'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'zixia', name: '子夏', alias: '子夏', quality: '博',
            category: 'literature', categoryName: '文学', axis: 'causality', axisName: '缘位轴',
            color: 'wenxue', direction: 'north', position: 'north-center',
            biography: '卜商，字子夏。以博学著称，精研《诗》《春秋》。"仕而优则学，学而优则仕"即出其言。晚年居西河授徒，为魏文侯师。',
            insight: '博学不是读了万卷书，是每卷都读进了生命。',
            chapters: ['学而·7', '八佾·8', '子张·5'],
            practices: ['今天读一段经典并写下自己的理解', '把学到的知识讲给一个人听', '在"博"和"约"之间找一个平衡'],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        },
        {
            id: 'kongzi', name: '孔子', alias: '仲尼', quality: '贯',
            category: 'center', categoryName: '中', axis: 'center', axisName: '定位轴',
            color: 'kongzi', direction: 'center', position: 'center',
            biography: '孔子，名丘，字仲尼。春秋末期鲁国人，儒家学派创始人。删述六经，垂宪万世。弟子三千，贤者七十二。其言"吾道一以贯之"，忠恕而已矣。',
            insight: '一生只说了一句话：吾道一以贯之。',
            chapters: ['学而·1', '为政·4', '述而·17'],
            practices: [
                '每日三省吾身：为人谋而不忠乎？',
                '己所不欲，勿施于人——今天践行一次',
                '学而不厌，诲人不倦——把今天的收获教给一个人'
            ],
            contentSource: { biography: 'AI初审+人类修订', insight: 'AI初审+人类修订', practices: 'AI初审+人类修订', reviewer: '慧惠团队' }
        }
    ];

    // 叶片精确坐标 (Qoder执行提示词 — 以画布中心为原点的百分比)
    const SAGE_COORDS = {
        yan_hui: { x: +0.35, y: 0.00 },
        min_ziqian: { x: +0.30, y: +0.06 },
        ran_boniu: { x: +0.30, y: -0.06 },
        zhonggong: { x: +0.32, y: -0.12 },
        zigong: { x: 0.00, y: +0.30 },
        zai_wo: { x: -0.08, y: +0.28 },
        zilu: { x: -0.35, y: 0.00 },
        ran_you: { x: -0.32, y: +0.06 },
        zixia: { x: 0.00, y: -0.30 },
        ziyou: { x: +0.08, y: -0.28 },
        kongzi: { x: 0.00, y: 0.00 },
    };

    // 四枝定义 (方位五行推演)
    const BRANCHES = [
        {
            id: 'east', category: 'virtue', name: '德行', color: 'dexing',
            axis: '识位轴', axisDesc: '忠于真知',
            angle: 0,
            description: '德行：孔子门下以品德修养见长的学科分支。颜回、闵子骞、冉伯牛、仲弓列于此科。',
            verse: '仁者安仁，如春在木。',
            whisper: '这一枝，孔子最看重。先把人做好了，再说别的。'
        },
        {
            id: 'south', category: 'speech', name: '言语', color: 'yanyu',
            axis: '宇位轴', axisDesc: '恕及环境',
            angle: Math.PI / 2,
            description: '言语：以辞令与外交见长的学科分支。宰我、子贡列于此科。',
            verse: '辞达而已，如火在明。',
            whisper: '说话是门功夫。子贡练了一辈子，他晚年说："我不想说了。"'
        },
        {
            id: 'west', category: 'politics', name: '政事', color: 'zhengshi',
            axis: '时位轴', axisDesc: '忠于当下',
            angle: Math.PI,
            description: '政事：以行政才能与决断见长的学科分支。冉有、子路列于此科。',
            verse: '义以为质，如金在断。',
            whisper: '做事的人在这儿。子路到死都戴着帽子——他觉得，君子死，冠不免。'
        },
        {
            id: 'north', category: 'literature', name: '文学', color: 'wenxue',
            axis: '缘位轴', axisDesc: '恕及因果',
            angle: -Math.PI / 2,
            description: '文学：以经典传承与博学见长的学科分支。子游、子夏列于此科。',
            verse: '知及于远，如水在渊。',
            whisper: '传下去的，才是真的。子夏教出了荀子，荀子教出了韩非。'
        }
    ];

    // 中央定义
    const CENTER_DESC = '中：孔子，名丘字仲尼。儒家学派创始人，删述六经，垂宪万世。居北辰而众星共之。';
    const CENTER_VERSE = '吾道一以贯之。';
    const CENTER_WHISPER = '他一生只说了一句话："吾道一以贯之。"';

    // 兼容旧 CATEGORIES 映射
    const CATEGORIES = {};
    BRANCHES.forEach(b => {
        CATEGORIES[b.category] = { name: b.name, axis: b.axis, axisDesc: b.axisDesc, color: b.color };
    });
    CATEGORIES['center'] = { name: '中', axis: '定位轴', axisDesc: '北辰居所', color: 'kongzi' };

    // ==========================================================
    // 二、状态管理
    // ==========================================================
    let state = {
        boundSageId: null,
        followHistory: [],
        focusedBranch: null,
        currentCardSageId: null,
        recommendationDismissed: false,
        recommendationsPresented: [],
        zoom: 1.0,
        panX: 0,
        panY: 0
    };

    function loadState() {
        try {
            const saved = localStorage.getItem('kongmen-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                state.boundSageId = parsed.boundSageId || null;
                state.followHistory = parsed.followHistory || [];
                state.recommendationsPresented = parsed.recommendationsPresented || [];
            }
        } catch (e) { /* 静默 */ }
    }

    function saveState() {
        try {
            localStorage.setItem('kongmen-state', JSON.stringify({
                boundSageId: state.boundSageId,
                followHistory: state.followHistory,
                recommendationsPresented: state.recommendationsPresented
            }));
        } catch (e) { /* 静默 */ }
    }

    function getBoundSage() {
        if (!state.boundSageId) return null;
        return SAGES.find(s => s.id === state.boundSageId) || null;
    }

    function getUserStateType() {
        const bound = getBoundSage();
        if (!bound && state.followHistory.length === 0) return 'visitor';
        if (bound) return 'practitioner';
        return 'returner';
    }

    // ==========================================================
    // 三、DOM 引用
    // ==========================================================
    const treeSVG = document.getElementById('tree-svg');
    const treeContainer = document.querySelector('.kongmen-tree-container');
    const greetingText = document.getElementById('greeting-text');
    const recommendationText = document.getElementById('recommendation-text');
    const cardOverlay = document.getElementById('card-overlay');
    const cardEl = document.getElementById('card-content');
    const dialogOverlay = document.getElementById('dialog-overlay');
    const dialogContent = document.getElementById('dialog-content');
    const toastEl = document.getElementById('kongmen-toast');

    // HTML overlay 元素 (动态创建)
    let tooltipEl = null;
    let whisperEl = null;

    function ensureOverlayElements() {
        if (!treeContainer) return;
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'km-branch-tooltip';
            treeContainer.appendChild(tooltipEl);
        }
        if (!whisperEl) {
            whisperEl = document.createElement('div');
            whisperEl.className = 'km-branch-whisper';
            treeContainer.appendChild(whisperEl);
        }
    }

    // ==========================================================
    // 四、树图渲染引擎 (SVG) — 方位五行布局
    // ==========================================================
    function getTreeDimensions() {
        if (!treeContainer) return { w: 800, h: 600, cx: 400, cy: 300, halfW: 400, halfH: 300 };
        const rect = treeContainer.getBoundingClientRect();
        const w = Math.max(rect.width, 320);
        const h = Math.max(rect.height, 400);
        return { w, h, cx: w / 2, cy: h / 2, halfW: w / 2, halfH: h / 2 };
    }

    function calcLeafPos(sageId, dim) {
        const coords = SAGE_COORDS[sageId];
        if (!coords) return { x: dim.cx, y: dim.cy };
        return {
            x: dim.cx + coords.x * dim.halfW,
            y: dim.cy + coords.y * dim.halfH
        };
    }

    function renderTree() {
        const dim = getTreeDimensions();
        const { w, h, cx, cy, halfW, halfH } = dim;

        treeSVG.setAttribute('viewBox', `0 0 ${w} ${h}`);
        treeSVG.innerHTML = '';

        const isMobile = w < 768;
        const rootR = isMobile ? 24 : 30;
        const leafR = isMobile ? 16 : 20;
        const branchExtent = Math.min(halfW, halfH) * 0.8; // 枝干延伸距离

        // 设置 CSS 变量供 transform-origin 引用
        treeSVG.style.setProperty('--km-svg-cx', cx + 'px');
        treeSVG.style.setProperty('--km-svg-cy', cy + 'px');

        // ---- Defs ----
        const defs = createSVGElement('defs');
        const filter = createSVGElement('filter', { id: 'leaf-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
        filter.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    `;
        defs.appendChild(filter);

        // 水墨晕染渐变 (四枝根部)
        ['east', 'south', 'west', 'north'].forEach(dir => {
            const grad = createSVGElement('radialGradient', {
                id: `branch-fade-${dir}`,
                cx: '50%', cy: '50%', r: '50%'
            });
            grad.innerHTML = `
        <stop offset="0%" stop-color="var(--km-paper)" stop-opacity="0" />
        <stop offset="85%" stop-color="var(--km-paper)" stop-opacity="0" />
        <stop offset="100%" stop-color="var(--km-paper)" stop-opacity="0.15" />
      `;
            defs.appendChild(grad);
        });
        treeSVG.appendChild(defs);

        // 获取 CSS 颜色值
        const style = getComputedStyle(document.documentElement);

        // ---- 内容组 (支持 zoom) ----
        const contentGroup = createSVGElement('g', { class: 'tree-content' });
        contentGroup.setAttribute('transform', `translate(${state.panX},${state.panY}) scale(${state.zoom})`);
        treeSVG.appendChild(contentGroup);

        // ---- 四枝 ----
        BRANCHES.forEach(branch => {
            const branchSages = SAGES.filter(s => s.category === branch.category);
            const branchColor = style.getPropertyValue(`--km-${branch.color}`).trim() || '#555';

            // 计算枝干终点 (超过最远叶片 12%)
            let maxLeafDist = 0;
            branchSages.forEach(s => {
                const pos = calcLeafPos(s.id, dim);
                const dist = Math.sqrt((pos.x - cx) ** 2 + (pos.y - cy) ** 2);
                if (dist > maxLeafDist) maxLeafDist = dist;
            });
            const endDist = Math.max(maxLeafDist * 1.12, branchExtent * 0.5);
            const endX = cx + Math.cos(branch.angle) * endDist;
            const endY = cy + Math.sin(branch.angle) * endDist;

            // 控制点 (轻微弧线)
            const perpAngle = branch.angle + Math.PI / 2;
            const arcOffset = Math.min(halfW, halfH) * 0.04;
            const cpX = cx + Math.cos(branch.angle) * endDist * 0.48 + Math.cos(perpAngle) * arcOffset;
            const cpY = cy + Math.sin(branch.angle) * endDist * 0.48 + Math.sin(perpAngle) * arcOffset;

            // 枝中点 (标签位置 — 中心与叶群之间的中点)
            const midDist = endDist * 0.50;
            const midX = cx + Math.cos(branch.angle) * midDist;
            const midY = cy + Math.sin(branch.angle) * midDist;

            // 标签偏移 (垂直于枝方向)
            const labelOffset = 18;
            const labelX = cx + Math.cos(branch.angle) * (endDist * 0.50) + Math.cos(perpAngle) * labelOffset;
            const labelY = cy + Math.sin(branch.angle) * (endDist * 0.50) + Math.sin(perpAngle) * labelOffset;

            // 枝干分组 (transform-origin 在 CSS 中通过变量设置)
            const branchGroup = createSVGElement('g', {
                class: 'sage-branch-group',
                'data-branch': branch.id
            });
            branchGroup.setAttribute('style', `transform-origin:${cx}px ${cy}px;`);

            // Bezier 曲线
            const path = createSVGElement('path', {
                d: `M ${cx} ${cy} Q ${cpX} ${cpY} ${endX} ${endY}`,
                class: `sage-branch-line ${branch.color}`,
                'data-branch': branch.id,
                stroke: branchColor,
                'stroke-width': isMobile ? '1.2' : '1.5',
                fill: 'none'
            });
            branchGroup.appendChild(path);

            // 透明点击热区
            const hotArea = createSVGElement('circle', {
                cx: midX, cy: midY, r: '34',
                class: 'sage-branch-hotarea',
                'data-branch': branch.id,
                fill: 'transparent',
                cursor: 'pointer'
            });
            hotArea.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBranchFocus(branch.id);
            });
            hotArea.addEventListener('mouseenter', () => showBranchTooltip(branch, midX, midY));
            hotArea.addEventListener('mouseleave', hideBranchTooltip);
            branchGroup.appendChild(hotArea);

            // 可视枝点标记
            const dot = createSVGElement('circle', {
                cx: midX, cy: midY, r: isMobile ? '5' : '7',
                class: `sage-branch-dot ${branch.color}`,
                fill: 'rgba(255,255,255,0.85)',
                stroke: branchColor,
                'stroke-width': '2',
                'pointer-events': 'none'
            });
            branchGroup.appendChild(dot);

            // 枝标签
            const label = createSVGElement('text', {
                x: labelX, y: labelY,
                class: 'sage-branch-label',
                'text-anchor': 'middle',
                'dominant-baseline': 'central',
                'font-size': isMobile ? '10px' : '12px'
            });
            label.textContent = branch.name;
            branchGroup.appendChild(label);

            // 叶片
            branchSages.forEach(sage => {
                const leafPos = calcLeafPos(sage.id, dim);
                const isBound = state.boundSageId === sage.id;

                const leafGroup = createSVGElement('g', {
                    class: `sage-leaf-group${isBound ? ' bound glow' : ' breathing'}`,
                    'data-sage-id': sage.id,
                    cursor: 'pointer'
                });

                leafGroup.innerHTML = `
          <circle cx="${leafPos.x}" cy="${leafPos.y}" r="${leafR}" class="sage-leaf-circle ${sage.color}" />
          <text x="${leafPos.x}" y="${leafPos.y - 3}" class="sage-leaf-name" font-size="${isMobile ? '10px' : '12px'}">${sage.name}</text>
          <text x="${leafPos.x}" y="${leafPos.y + leafR * 0.55}" class="sage-leaf-quality" font-size="${isMobile ? '8px' : '9px'}">${sage.quality}</text>
        `;

                leafGroup.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showSageCard(sage);
                });

                branchGroup.appendChild(leafGroup);
            });

            // 应用当前聚焦状态
            if (state.focusedBranch) {
                if (state.focusedBranch === branch.id) {
                    branchGroup.classList.add('focused');
                } else {
                    branchGroup.classList.add('dimmed');
                }
            }

            // 整条枝干的 hover → 显示枝铭 tooltip
            branchGroup.addEventListener('mouseenter', () => showBranchTooltip(branch, midX, midY));
            branchGroup.addEventListener('mouseleave', hideBranchTooltip);

            contentGroup.appendChild(branchGroup);
        });

        // ---- 根节点 (最后绘制，在最上层) ----
        const rootGroup = createSVGElement('g', { class: 'sage-root', cursor: 'pointer' });
        rootGroup.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${rootR}" />
      <text x="${cx}" y="${cy}" font-size="${isMobile ? '14px' : '16px'}">孔</text>
    `;
        rootGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            const kongzi = SAGES.find(s => s.id === 'kongzi');
            if (kongzi) showSageCard(kongzi);
        });
        contentGroup.appendChild(rootGroup);

        // 根节点 hover 热区 (慧惠中央低语 + 孔子介绍)
        const rootHot = createSVGElement('circle', {
            cx: cx, cy: cy, r: rootR + 10,
            fill: 'transparent', cursor: 'pointer'
        });
        rootHot.addEventListener('click', (e) => {
            e.stopPropagation();
            const kongzi = SAGES.find(s => s.id === 'kongzi');
            if (kongzi) showSageCard(kongzi);
        });
        rootHot.addEventListener('mouseenter', () => {
            showBranchTooltip({ description: CENTER_DESC, verse: CENTER_VERSE, whisper: CENTER_WHISPER }, cx, cy - rootR - 22);
        });
        rootHot.addEventListener('mouseleave', hideBranchTooltip);
        contentGroup.appendChild(rootHot);

        // ---- 全局事件 ----
        // 点击空白恢复
        treeSVG.addEventListener('click', (e) => {
            if (e.target === treeSVG) {
                resetBranchFocus();
                hideSageCard();
            }
        });

        // 双击复原缩放
        treeSVG.addEventListener('dblclick', (e) => {
            e.preventDefault();
            resetZoom();
        });

        // 滚轮缩放
        treeSVG.addEventListener('wheel', handleWheelZoom, { passive: false });
    }

    // ---- SVG 辅助 ----
    function createSVGElement(tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        if (attrs) {
            Object.entries(attrs).forEach(([k, v]) => {
                if (k === 'style') {
                    el.style.cssText = v;
                } else {
                    el.setAttribute(k, v);
                }
            });
        }
        return el;
    }

    // ---- 枝铭 tooltip + 慧惠低语 ----
    let tooltipTimer = null;
    let whisperTimer = null;

    function showBranchTooltip(branch, svgX, svgY) {
        ensureOverlayElements();
        if (!tooltipEl || !whisperEl) return;

        clearTimeout(tooltipTimer);
        clearTimeout(whisperTimer);

        // 将 SVG viewBox 坐标转为容器内像素坐标 (含 zoom 补偿)
        const containerRect = treeContainer.getBoundingClientRect();
        const svgRect = treeSVG.getBoundingClientRect();
        const vb = treeSVG.getAttribute('viewBox').split(' ').map(Number);
        const scaleX = svgRect.width / vb[2];
        const scaleY = svgRect.height / vb[3];

        // 先应用 contentGroup 的缩放和平移，得到视觉坐标
        const dim = getTreeDimensions();
        const visX = state.panX + dim.cx * (1 - state.zoom) + svgX * state.zoom;
        const visY = state.panY + dim.cy * (1 - state.zoom) + svgY * state.zoom;

        const screenX = svgRect.left + visX * scaleX - containerRect.left;
        const screenY = svgRect.top + visY * scaleY - containerRect.top;

        // 四科分类介绍 (tooltip)
        tooltipEl.textContent = branch.description || branch.verse || '';
        tooltipEl.style.left = screenX + 'px';
        tooltipEl.style.top = (screenY - 36) + 'px';
        tooltipEl.classList.add('visible');

        // 慧惠低语 (延迟出现)
        whisperTimer = setTimeout(() => {
            whisperEl.textContent = branch.whisper || '';
            whisperEl.style.left = screenX + 'px';
            whisperEl.style.top = (screenY + 22) + 'px';
            whisperEl.classList.add('visible');
        }, 200);
    }

    function hideBranchTooltip() {
        clearTimeout(tooltipTimer);
        clearTimeout(whisperTimer);
        if (tooltipEl) tooltipEl.classList.remove('visible');
        if (whisperEl) whisperEl.classList.remove('visible');
    }

    // ---- 枝聚焦 ----
    function toggleBranchFocus(branchId) {
        if (state.focusedBranch === branchId) {
            resetBranchFocus();
            return;
        }
        state.focusedBranch = branchId;

        document.querySelectorAll('.sage-branch-group').forEach(group => {
            const isTarget = group.dataset.branch === branchId;
            group.classList.toggle('focused', isTarget);
            group.classList.toggle('dimmed', !isTarget);
        });
    }

    function resetBranchFocus() {
        state.focusedBranch = null;
        document.querySelectorAll('.sage-branch-group').forEach(group => {
            group.classList.remove('focused', 'dimmed');
        });
    }

    // ---- 缩放 ----
    function handleWheelZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.06 : 0.06;
        state.zoom = Math.max(0.45, Math.min(2.2, state.zoom + delta));
        applyZoom();
    }

    function resetZoom() {
        state.zoom = 1.0;
        state.panX = 0;
        state.panY = 0;
        applyZoom();
    }

    function applyZoom() {
        const contentGroup = treeSVG.querySelector('.tree-content');
        if (!contentGroup) return;

        const dim = getTreeDimensions();
        const adjustX = dim.cx * (1 - state.zoom);
        const adjustY = dim.cy * (1 - state.zoom);
        contentGroup.setAttribute('transform',
            `translate(${state.panX + adjustX},${state.panY + adjustY}) scale(${state.zoom})`);

        if (state.zoom !== 1.0) {
            treeContainer.classList.add('zooming');
        } else {
            treeContainer.classList.remove('zooming');
        }
    }

    // ==========================================================
    // 五、浮层卡片
    // ==========================================================
    function showSageCard(sage) {
        state.currentCardSageId = sage.id;
        const isBound = state.boundSageId === sage.id;

        cardEl.innerHTML = `
      <div class="kongmen-card-handle"></div>
      ${isBound ? '<span class="bound-indicator">正在同行</span>' : ''}
      <div class="kongmen-card-header">
        <span class="kongmen-card-name">${sage.name}</span>
        <span class="kongmen-card-quality">· ${sage.quality}</span>
      </div>
      <div class="kongmen-card-info">
        <span class="kongmen-card-tag">${sage.categoryName}</span>
        <span class="kongmen-card-tag axis">${sage.axisName} · ${CATEGORIES[sage.category].axisDesc}</span>
      </div>
      <div class="kongmen-card-bio">${sage.biography}</div>
      <div class="kongmen-card-insight">${sage.insight}</div>
      <div class="kongmen-card-actions">
        ${isBound
                ? `<button class="kongmen-btn kongmen-btn-secondary" onclick="window.KongmenMap.showSageDetail('${sage.id}')">再听听他的故事</button>`
                : `<button class="kongmen-btn kongmen-btn-primary" onclick="window.KongmenMap.initiateFollow('${sage.id}')">我想跟随他</button>
             <button class="kongmen-btn kongmen-btn-secondary" onclick="window.KongmenMap.showSageDetail('${sage.id}')">再听听他的故事</button>`
            }
      </div>
    `;

        cardOverlay.style.display = 'flex';
        requestAnimationFrame(() => {
            cardEl.classList.add('visible');
        });
    }

    function hideSageCard() {
        cardEl.classList.remove('visible');
        state.currentCardSageId = null;
        setTimeout(() => {
            if (!cardEl.classList.contains('visible')) {
                cardOverlay.style.display = 'none';
            }
        }, 350);
    }

    // ==========================================================
    // 六、跟随/道别流程 (慧惠对话式)
    // ==========================================================
    function initiateFollow(sageId) {
        const sage = SAGES.find(s => s.id === sageId);
        if (!sage) return;

        const currentBound = getBoundSage();

        if (!currentBound) {
            showDialog(
                `${sage.name}。${sage.biography.split('。')[0]}。想和他同行一段吗？`,
                [
                    { text: '再想想', class: 'cancel', action: () => hideDialog() },
                    { text: '我想跟随他', class: 'confirm', action: () => confirmFollow(sage) }
                ]
            );
        } else {
            if (sageId !== currentBound.id) {
                showDialog(
                    `${sage.name}。${sage.biography.split('。')[0]}。想和他同行一段吗？`,
                    [
                        { text: '再想想', class: 'cancel', action: () => hideDialog() },
                        { text: '我想跟随他', class: 'confirm', action: () => showFarewell(sage, currentBound) }
                    ]
                );
            }
        }
    }

    function showFarewell(newSage, oldBound) {
        const oldSage = SAGES.find(s => s.id === oldBound.id) || oldBound;
        showDialog(
            `<div class="kongmen-farewell-text">你和<span style="color:var(--km-primary);font-weight:600;">${oldSage.name}</span>一起走过了一段路。</div>
       <div class="kongmen-farewell-highlight">那段时间，他留下的——<br>那些${oldSage.quality || ''}、那些不会忘记的事——<br>已经在你身上了。</div>
       <div class="kongmen-farewell-text">想和他说再见吗？</div>`,
            [
                { text: '再想想', class: 'cancel', action: () => hideDialog() },
                { text: '说再见，启程', class: 'confirm', action: () => confirmSwitch(newSage, oldBound) }
            ]
        );
    }

    function confirmFollow(sage) {
        state.boundSageId = sage.id;
        state.followHistory.push({
            sageId: sage.id,
            followedAt: new Date().toISOString(),
            partedAt: null
        });
        state.recommendationDismissed = true;
        saveState();
        hideDialog();
        hideSageCard();
        refreshAll();
        showToast(`从今天起，${sage.name}陪你走。`);
    }

    function confirmSwitch(newSage, oldBound) {
        const record = state.followHistory.find(r => r.sageId === oldBound.sageId && !r.partedAt);
        if (record) {
            record.partedAt = new Date().toISOString();
        }
        state.boundSageId = newSage.id;
        state.followHistory.push({
            sageId: newSage.id,
            followedAt: new Date().toISOString(),
            partedAt: null
        });
        state.recommendationDismissed = true;
        saveState();
        hideDialog();
        hideSageCard();
        refreshAll();
        showToast(`从今天起，${newSage.name}陪你走。你随时可以回来看${oldBound.name}——在成长档案里，那段路还在。`);
    }

    function showSageDetail(sageId) {
        const sage = SAGES.find(s => s.id === sageId);
        if (!sage) return;
        const practices = sage.practices.map((p, i) => `${i + 1}. ${p}`).join('<br>');
        showDialog(
            `<div style="text-align:left;line-height:1.9;">
        <div style="font-size:1.1em;color:var(--km-primary);margin-bottom:12px;">${sage.name} · ${sage.quality}</div>
        <div style="margin-bottom:12px;color:var(--km-text-light);">${sage.biography}</div>
        <div style="font-style:italic;margin-bottom:16px;color:var(--km-text);">"${sage.insight}"</div>
        <div style="font-size:0.9em;">
          <strong>修行建议：</strong><br>${practices}
        </div>
        <div style="margin-top:12px;font-size:0.8em;color:var(--km-text-muted);">
          数据来源：${sage.contentSource.biography} · 修订者：${sage.contentSource.reviewer || '慧惠团队'}
        </div>
      </div>`,
            [
                { text: '我知道了', class: 'confirm', action: () => hideDialog() }
            ]
        );
    }

    // ==========================================================
    // 七、对话弹窗
    // ==========================================================
    function showDialog(html, buttons) {
        dialogContent.innerHTML = `
      <div class="kongmen-dialog-avatar">🌿</div>
      <div class="kongmen-dialog-text">${html}</div>
      <div class="kongmen-dialog-actions">
        ${buttons.map(b => `<button class="kongmen-dialog-btn ${b.class}">${b.text}</button>`).join('')}
      </div>
    `;

        const btnEls = dialogContent.querySelectorAll('.kongmen-dialog-btn');
        buttons.forEach((b, i) => {
            if (btnEls[i]) btnEls[i].addEventListener('click', b.action);
        });

        dialogOverlay.classList.add('active');
    }

    function hideDialog() {
        dialogOverlay.classList.remove('active');
    }

    // 点击遮罩关闭
    dialogOverlay.addEventListener('click', (e) => {
        if (e.target === dialogOverlay) hideDialog();
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (dialogOverlay.classList.contains('active')) hideDialog();
            if (cardEl && cardEl.classList.contains('visible')) hideSageCard();
        }
    });

    // ==========================================================
    // 八、Toast 轻声提示
    // ==========================================================
    function showToast(msg, duration = 3500) {
        toastEl.textContent = msg;
        toastEl.classList.add('visible');
        clearTimeout(toastEl._timeout);
        toastEl._timeout = setTimeout(() => {
            toastEl.classList.remove('visible');
        }, duration);
    }

    // ==========================================================
    // 九、慧惠问候语
    // ==========================================================
    function updateGreeting() {
        const userType = getUserStateType();
        const boundSage = getBoundSage();
        const hour = new Date().getHours();
        const timeGreeting = hour < 11 ? '早安' : (hour < 14 ? '午安' : (hour < 19 ? '下午好' : '晚安'));

        let text = '';
        switch (userType) {
            case 'visitor':
                text = `${timeGreeting}。这儿有十位先哲，孔子门下最好的弟子。不急。哪天想认识谁，告诉我。`;
                break;
            case 'practitioner':
                text = `${timeGreeting}。今天想看看谁？`;
                break;
            case 'returner':
                text = '你回来了。';
                break;
        }
        greetingText.textContent = text;

        if (userType === 'practitioner' && boundSage && !state.recommendationDismissed) {
            generateRecommendation(boundSage);
        }
    }

    function generateRecommendation(boundSage) {
        const others = SAGES.filter(s => s.id !== boundSage.id && s.category !== boundSage.category);
        if (others.length === 0) return;

        const candidates = others.filter(s => !state.recommendationsPresented.includes(s.id));
        if (candidates.length === 0) return;

        const recommended = candidates[Math.floor(Math.random() * candidates.length)];
        state.recommendationsPresented.push(recommended.id);
        saveState();

        recommendationText.textContent = `这几天你修的，让${recommended.name}的故事又多了一层意思。想再听听他的吗？`;
        recommendationText.classList.add('visible');
        recommendationText.style.cursor = 'pointer';
        recommendationText.onclick = () => {
            showSageCard(recommended);
            recommendationText.classList.remove('visible');
            state.recommendationDismissed = true;
            recommendationText.onclick = null;
            recommendationText.style.cursor = '';
        };
    }

    // ==========================================================
    // 十、全局刷新
    // ==========================================================
    function refreshAll() {
        renderTree();
        updateGreeting();
    }

    // ==========================================================
    // 十一、响应式重绘
    // ==========================================================
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderTree();
        }, 250);
    });

    // ==========================================================
    // 十二、卡片下拉关闭 (移动端手势)
    // ==========================================================
    let touchStartY = 0;
    cardEl.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    cardEl.addEventListener('touchmove', (e) => {
        const deltaY = e.touches[0].clientY - touchStartY;
        if (deltaY > 60 && cardEl.scrollTop <= 0) {
            hideSageCard();
        }
    }, { passive: true });

    // ==========================================================
    // 十三、初始化
    // ==========================================================
    function init() {
        loadState();
        ensureOverlayElements();
        renderTree();
        updateGreeting();

        window.KongmenMap = {
            initiateFollow,
            showSageDetail,
            refreshAll,
            getState: () => state,
            SAGES
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
