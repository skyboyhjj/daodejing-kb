// 道德经亲子体验营知识库 — 增强型全文检索引擎
// 支持：模糊匹配 · 多关键词AND/OR · 相关性排序 · 概念检索 · 全站可用
(function () {
  'use strict';

  var DROPDOWN_MAX = 40;
  var SNIPPET_RADIUS = 40;
  var DEBOUNCE_MS = 200;

  // ── 繁体→简体 转换映射 ──
  // 覆盖道德经高频字及常用繁体字（约500对）
  var T2S_MAP = null;
  var T2S_PAIRS = '無无為为聖圣強强經经親亲體体驗验單单讓让樣样條条樓楼門门開开關关時时處处傳传標标機机識识記记設设計计話话語语說说請请讀读變变議议謙谦資资買买賣卖賞赏貨货貪贪貧贫賀贺賽赛賠赔賺赚贈赠車车轉转輯辑達达運运進进連连選选遠远適适邊边還还過过這这長长間间問问聞闻防防陰阴難难雲云電电靜静響响頁页項项須须題题風风飛飞餘余驅驱高高魚鱼鳥鸟黃黄龍龙龜龟萬万與与並并兩两個个來来們们備备內内動动務务問问國国報报學学實实對对將将專专尋寻導导屬属師师幾几後后從从愛爱應应懷怀戰战戲戏戶户書书會会歸归氣气決决灣湾現现當当發发種种積积節节簡简紀纪約约純纯級级結结給给統统總总繼继線线縣县義义聲声與与舉举補补裝装裡里見见視视覺觉觀观該该論论護护豐丰負负賢贤軍军辦办農农迴回這这連连運运達达違违遠远適适還还鄰邻針针銘铭錢钱鐵铁閉闭開开間间院院隱隐雙双離离難难雲云電电靈灵韓韩響响領领題题願愿類类風风飛飞養养驗验體体魚鱼鳥鸟齊齐龍龙龜龟點点廣广張张徑径彷彷徵征層层幣币屆届歲岁歷历殺杀溫温準准溝沟燈灯營营爭争獨独獲获環环產产異异當当療疗癒愈監监確确禍祸禮礼稱称穩稳競竞籤签絲丝織织繫系習习號号術术複复規规詩诗詳详認认說说請请論论護护變变責责貴贵賞赏踐践載载退退通通進进運运道道達达違违遠远適适還还部部量量集集離离雪雪靈灵靜静頭头顯显飄飘馬马駐驻驗验體体鬥斗魂魂鮮鲜鹽盐麗丽齊齐龍龙';

  function buildT2SMap() {
    if (T2S_MAP) return T2S_MAP;
    T2S_MAP = {};
    for (var i = 0; i < T2S_PAIRS.length; i += 2) {
      var trad = T2S_PAIRS[i];
      var simp = T2S_PAIRS[i + 1];
      if (trad !== simp) {
        T2S_MAP[trad] = simp;
      }
    }
    return T2S_MAP;
  }

  // 繁体转简体
  function t2s(text) {
    if (!text) return text;
    var map = buildT2SMap();
    var result = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      result += map[ch] || ch;
    }
    return result;
  }

  // ── 工具函数 ──
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function tokenize(q) { return q.trim().split(/\s+/).filter(Boolean); }

  // ── 模糊匹配核心 ──
  // 支持：完全匹配 > 包含匹配 > 拼音首字母(预留)
  function fuzzyMatch(text, token) {
    var lower = text.toLowerCase();
    var tLower = token.toLowerCase();
    // 精确包含
    if (lower.indexOf(tLower) !== -1) return true;
    // 单字符模糊：允许1个字符差异(仅对3+字符token)
    if (tLower.length >= 3) {
      for (var i = 0; i < tLower.length; i++) {
        var partial = tLower.substring(0, i) + tLower.substring(i + 1);
        if (lower.indexOf(partial) !== -1) return true;
      }
    }
    return false;
  }

  // ── 相关性评分 ──
  function scoreItem(item, tokens) {
    var score = 0;
    var titleLower = (item.title || '').toLowerCase();
    var textLower = (item.text || '').toLowerCase();
    var conceptsStr = (item.concepts || []).join(' ').toLowerCase();

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i].toLowerCase();
      // 标题精确匹配 +10
      if (titleLower.indexOf(t) !== -1) score += 10;
      // 概念匹配 +8
      if (conceptsStr.indexOf(t) !== -1) score += 8;
      // 正文匹配 +3
      if (textLower.indexOf(t) !== -1) score += 3;
      // 标题起始匹配 +5
      if (titleLower.indexOf(t) === 0) score += 5;
      // 多次出现加分
      var count = 0;
      var idx = textLower.indexOf(t);
      while (idx !== -1 && count < 5) {
        count++;
        idx = textLower.indexOf(t, idx + 1);
      }
      score += count;
    }
    return score;
  }

  // ── 数据管理 ──
  var indexPromise = null;
  var data = null;

  function resolveBase() {
    // 自动检测当前页面相对于根目录的路径
    if (typeof window !== 'undefined' && window.DaoSearchBase) {
      return window.DaoSearchBase.replace(/\/$/, '') + '/';
    }
    // 检测路径深度
    var path = window.location.pathname;
    if (path.indexOf('/chapters/') !== -1 ||
      path.indexOf('/concepts/') !== -1 ||
      path.indexOf('/paths/') !== -1 ||
      path.indexOf('/empower/') !== -1 ||
      path.indexOf('/compare/') !== -1 ||
      path.indexOf('/kg/') !== -1 ||
      path.indexOf('/l1/') !== -1) {
      return '../';
    }
    return '';
  }

  // 通过动态 <script> 加载索引（兼容 file:// 协议）
  function loadIndexViaScript(base) {
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = base + 'data/search-data.js';
      script.onload = function () {
        if (window.__DaoSearchData) {
          data = window.__DaoSearchData;
          resolve(data);
        } else {
          resolve(null);
        }
      };
      script.onerror = function () {
        console.warn('[DaoSearch] script标签加载索引也失败');
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }

  function loadIndex() {
    // 优先使用已通过 <script> 预加载的数据
    if (data) return Promise.resolve(data);
    if (window.__DaoSearchData) {
      data = window.__DaoSearchData;
      return Promise.resolve(data);
    }

    if (!indexPromise) {
      var base = resolveBase();
      indexPromise = fetch(base + 'data/search-index.json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { data = j; return data; })
        .catch(function (e) {
          console.warn('[DaoSearch] fetch加载失败(' + e.message + ')，尝试script方式加载...');
          // fetch 失败时回退到动态 script 加载（兼容 file:// 协议）
          return loadIndexViaScript(base);
        });
    }
    return indexPromise;
  }

  // ── 搜索引擎 ──
  function searchAll(query) {
    // 繁体转简体：对用户输入进行转换后再分词
    var simpQuery = t2s(query);
    var tokens = tokenize(simpQuery);
    if (!tokens.length || !data) return [];
    var hits = [];

    // 搜索章节
    var chapters = data.chapters || [];
    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      var searchText = (ch.title + ' ' + (ch.text || '') + ' ' + (ch.concepts || []).join(' ')).toLowerCase();
      var match = true;
      for (var j = 0; j < tokens.length; j++) {
        if (!fuzzyMatch(searchText, tokens[j])) { match = false; break; }
      }
      if (match) {
        var snippet = extractSnippet(ch.text || '', tokens);
        var score = scoreItem(ch, tokens);
        hits.push({
          type: 'chapter',
          num: ch.num,
          title: '第' + ch.num + '章 · ' + ch.title,
          url: ch.url,
          snippet: snippet,
          score: score,
          concepts: ch.concepts || []
        });
      }
    }

    // 搜索概念
    var concepts = data.concepts || [];
    for (var k = 0; k < concepts.length; k++) {
      var concept = concepts[k];
      var cSearchText = (concept.title + ' ' + (concept.text || '')).toLowerCase();
      var cMatch = true;
      for (var m = 0; m < tokens.length; m++) {
        if (!fuzzyMatch(cSearchText, tokens[m])) { cMatch = false; break; }
      }
      if (cMatch) {
        var cSnippet = extractSnippet(concept.text || '', tokens);
        var cScore = scoreItem({ title: concept.title, text: concept.text, concepts: [] }, tokens);
        cScore += 5; // 概念条目基础加分
        hits.push({
          type: 'concept',
          title: '概念 · ' + concept.title,
          url: concept.url,
          snippet: cSnippet,
          score: cScore,
          concepts: []
        });
      }
    }

    // 按相关性排序
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, DROPDOWN_MAX);
  }

  function extractSnippet(text, tokens) {
    if (!text) return '';
    var lower = text.toLowerCase();
    var bestIdx = -1;
    // 找到第一个匹配token的位置
    for (var i = 0; i < tokens.length; i++) {
      var idx = lower.indexOf(tokens[i].toLowerCase());
      if (idx !== -1) { bestIdx = idx; break; }
    }
    if (bestIdx === -1) {
      return text.substring(0, 80) + (text.length > 80 ? '…' : '');
    }
    var start = Math.max(0, bestIdx - SNIPPET_RADIUS);
    var end = Math.min(text.length, bestIdx + tokens[0].length + SNIPPET_RADIUS);
    return (start > 0 ? '…' : '') + text.substring(start, end) + (end < text.length ? '…' : '');
  }

  function highlightSnippet(snippet, tokens) {
    var s = escapeHtml(snippet);
    for (var i = 0; i < tokens.length; i++) {
      var pattern = escapeRegex(escapeHtml(tokens[i]));
      s = s.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark>$1</mark>');
    }
    return s;
  }

  // ── 获取当前层级上下文（用于搜索结果保持层级）──
  function getCurrentLevel() {
    try {
      // 优先从 URL 参数读取
      var params = new URLSearchParams(window.location.search);
      var level = params.get('level');
      if (level && ['l1', 'l2', 'l3', 'l4', 'all'].indexOf(level) !== -1) {
        return level;
      }
    } catch (e) { }
    try {
      // 其次从 localStorage 读取
      var stored = localStorage.getItem('daodejing-level-preference');
      if (stored && ['l1', 'l2', 'l3', 'l4', 'all'].indexOf(stored) !== -1) {
        return stored;
      }
    } catch (e) { }
    return null;
  }

  // ── 渲染结果 ──
  function renderResults(hits, tokens, results, base) {
    if (!hits.length) {
      results.innerHTML = '<div style="padding:12px;color:#888;">未找到匹配内容，请尝试其他关键词</div>';
      results.classList.add('active');
      return;
    }
    var currentLevel = getCurrentLevel();
    var html = '';
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      // 防御性回退：若搜索数据缺失 url 字段，尝试从章节号重建
      if (!h.url && h.num) {
        h.url = 'chapters/ch' + (h.num < 10 ? '0' + h.num : h.num);
      }
      // 跳过仍然没有 URL 的条目（搜索数据损坏）
      if (!h.url) continue;
      var url = (base || resolveBase()) + h.url;
      // 保持层级上下文：为章节链接追加 ?level= 参数
      if (currentLevel && h.type === 'chapter' && url.indexOf('?level=') === -1) {
        url += '?level=' + currentLevel;
      }
      var typeIcon = h.type === 'concept' ? '🌐' : '📖';
      var conceptsHtml = '';
      if (h.concepts && h.concepts.length) {
        conceptsHtml = '<span class="search-concepts">';
        for (var c = 0; c < h.concepts.length && c < 3; c++) {
          conceptsHtml += '<span class="search-concept-tag">' + escapeHtml(h.concepts[c]) + '</span>';
        }
        conceptsHtml += '</span>';
      }
      html += '<div class="search-item" data-url="' + escapeHtml(url) + '">'
        + '<div class="search-chapter">' + typeIcon + ' ' + escapeHtml(h.title) + conceptsHtml + '</div>'
        + '<div class="search-snippet">' + highlightSnippet(h.snippet, tokens) + '</div>'
        + '</div>';
    }
    results.innerHTML = html;
    results.classList.add('active');

    // 绑定点击事件
    var items = results.querySelectorAll('.search-item');
    for (var j = 0; j < items.length; j++) {
      items[j].addEventListener('click', function () {
        window.location.href = this.getAttribute('data-url');
      });
    }
  }

  // ── 初始化 ──
  function init() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!input || !results) return;

    var debounceTimer = null;
    var base = resolveBase();

    // 输入搜索
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var q = input.value.trim();
        if (!q) {
          results.classList.remove('active');
          results.innerHTML = '';
          return;
        }
        loadIndex().then(function () {
          if (!data) {
            results.innerHTML = '<div style="padding:12px;color:#888;">搜索索引加载失败</div>';
            results.classList.add('active');
            return;
          }
          var hits = searchAll(q);
          var tokens = tokenize(t2s(q));
          renderResults(hits, tokens, results, base);
        });
      }, DEBOUNCE_MS);
    });

    // 键盘导航
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        results.classList.remove('active');
        input.blur();
      }
      // Enter键：跳转到第一个结果
      if (e.key === 'Enter') {
        var firstItem = results.querySelector('.search-item');
        if (firstItem) {
          window.location.href = firstItem.getAttribute('data-url');
        }
      }
    });

    // 点击外部关闭
    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.remove('active');
      }
    });

    // 获得焦点时预加载索引
    input.addEventListener('focus', function () {
      loadIndex();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
