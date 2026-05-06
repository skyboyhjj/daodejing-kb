// 道德经亲子体验营知识库 — 增强型全文检索引擎
// 支持：模糊匹配 · 多关键词AND/OR · 相关性排序 · 概念检索 · 全站可用
(function () {
  'use strict';

  var DROPDOWN_MAX = 40;
  var SNIPPET_RADIUS = 40;
  var DEBOUNCE_MS = 200;

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
      path.indexOf('/kg/') !== -1) {
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
    var tokens = tokenize(query);
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

  // ── 渲染结果 ──
  function renderResults(hits, tokens, results, base) {
    if (!hits.length) {
      results.innerHTML = '<div style="padding:12px;color:#888;">未找到匹配内容，请尝试其他关键词</div>';
      results.classList.add('active');
      return;
    }
    var html = '';
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var url = (base || resolveBase()) + h.url;
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
          var tokens = tokenize(q);
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
