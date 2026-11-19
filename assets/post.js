/* Post page: renders one Markdown post. Served at /posts/<slug>/ (built by scripts/build.mjs) and at post.html?p=<slug>. */
(function () {
  'use strict';

  var SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
  var CATEGORY_LABELS = { game: '遊戲', code: '程式', know: '知識' };
  var CATEGORY_COLORS = { game: 'var(--amber)', code: 'var(--cobalt)' };
  var GAME_STATE_LABELS = { notStarted: '未開始', playing: '進行中', cleared: '已破關' };
  var MIN_TOC_HEADINGS = 3;
  var HEADING_ID_PREFIX = 'h-';
  var SITE_ROOT = location.origin + '/';
  var MSG_NOT_FOUND = '找不到這篇文章。';
  var MSG_LOAD_FAILED = '讀取文章失敗，請檢查網路後重新整理。';

  var output = document.getElementById('out');
  var slug = document.body.dataset.slug || new URLSearchParams(location.search).get('p') || '';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function showMessage(text, withBackLink) {
    var paragraph = el('p', 'msg', text + ' ');
    if (withBackLink) {
      var link = el('a', null, '看其他文章');
      link.href = '/#posts';
      paragraph.appendChild(link);
    }
    output.replaceChildren(paragraph);
  }

  function fetchResource(url, asJson) {
    return fetch(url, { cache: 'no-cache' }).then(function (response) {
      if (response.status === 404) {
        var notFound = new Error('Not found: ' + url);
        notFound.notFound = true;
        throw notFound;
      }
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
      return asJson ? response.json() : response.text();
    });
  }

  // Markdown links and images are written relative to the site root (images/2026/11/x.png),
  // which /posts/<slug>/ would otherwise resolve one folder too deep.
  function resolveFromRoot(url) {
    if (url.charAt(0) === '#') return url;
    try { return new URL(url, SITE_ROOT).href; } catch (urlError) { return url; } // malformed URL: leave it for the browser to ignore
  }

  function buildHeader(meta, title) {
    var category = CATEGORY_LABELS[meta.cat] ? meta.cat : 'know';
    var dot = el('i', category === 'know' ? 'know' : null);
    if (category !== 'know') dot.style.background = CATEGORY_COLORS[category];
    var categoryLabel = el('span', 'cat');
    categoryLabel.append(dot, CATEGORY_LABELS[category]);
    var time = el('time', 'num', meta.date || '');
    time.dateTime = meta.date || '';
    var metaRow = el('div', 'post-meta');
    metaRow.append(categoryLabel, time);
    var header = el('header', 'post-head');
    header.append(metaRow, el('h1', null, title));
    return header;
  }

  function buildGameCard(game) {
    var stats = window.ggrstSite.gameStats(game);
    var card = el('a', 'game-card');
    card.href = '/#g-' + encodeURIComponent(game.id);
    var fill = el('i');
    fill.style.transform = 'scaleX(' + stats.pct / 100 + ')';
    var bar = el('span', 'gb');
    bar.setAttribute('aria-hidden', 'true');
    bar.appendChild(fill);
    card.append(el('span', 'gk', '遊戲存檔 · ' + GAME_STATE_LABELS[stats.state]), el('span', 'gn', (game.name && (game.name.zh || game.name.en)) || game.id),
      el('span', 'gp num', stats.pct + '%'), bar);
    card.setAttribute('aria-label', '遊戲存檔：' + ((game.name && game.name.zh) || game.id) + '，完成 ' + stats.pct + '%');
    return card;
  }

  function headingId(text, usedIds) {
    var base = HEADING_ID_PREFIX + (text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '') || 'section');
    var id = base;
    for (var n = 2; usedIds.has(id); n++) id = base + '-' + n;
    usedIds.add(id);
    return id;
  }

  // Gives every h2/h3 an id and a "#" link, so any section can be shared. Returns the headings for the table of contents.
  function addHeadingAnchors(body) {
    var usedIds = new Set();
    return Array.prototype.map.call(body.querySelectorAll('h2, h3'), function (heading) {
      var text = heading.textContent;
      heading.id = headingId(text, usedIds);
      var anchor = el('a', 'anchor', '#');
      anchor.href = '#' + heading.id;
      anchor.setAttribute('aria-label', '連到「' + text + '」這一段');
      heading.appendChild(anchor);
      return { id: heading.id, text: text, isSub: heading.tagName === 'H3' };
    });
  }

  function buildToc(headings) {
    if (headings.length < MIN_TOC_HEADINGS) return null;
    var list = el('ol');
    headings.forEach(function (heading) {
      var link = el('a', null, heading.text);
      link.href = '#' + heading.id;
      var item = el('li', heading.isSub ? 'sub' : null);
      item.appendChild(link);
      list.appendChild(item);
    });
    var toc = el('details', 'toc');
    toc.open = true;
    toc.append(el('summary', null, '目錄'), list);
    return toc;
  }

  function pagerLink(post, label, className) {
    var link = el('a', className);
    link.href = window.ggrstSite.postUrl(post.slug);
    link.append(el('span', 'pk', label), el('span', 'pt', (post.title && (post.title.zh || post.title.en)) || post.slug));
    return link;
  }

  // Posts are newest first: the next item in the list is the older post.
  function buildPager(posts, index) {
    var newer = posts[index - 1], older = posts[index + 1];
    if (!newer && !older) return null;
    var pager = el('nav', 'pager');
    pager.setAttribute('aria-label', '更多文章');
    if (older) pager.appendChild(pagerLink(older, '← 較舊的文章', 'prev'));
    if (newer) pager.appendChild(pagerLink(newer, '較新的文章 →', 'next'));
    return pager;
  }

  function enableLightbox(body) {
    var dialog = el('dialog', 'lightbox');
    var image = el('img');
    var close = el('button', null, '×');
    close.type = 'button';
    close.setAttribute('aria-label', '關閉大圖');
    dialog.append(image, close);
    document.body.appendChild(dialog);
    close.addEventListener('click', function () { dialog.close(); });
    image.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    body.addEventListener('click', function (event) {
      var target = event.target;
      if (target.nodeName !== 'IMG' || target.closest('a')) return;
      image.src = target.currentSrc || target.src;
      image.alt = target.alt;
      dialog.showModal();
    });
  }

  function buildBody(markdown) {
    var body = el('div', 'prose');
    var isRendered = Boolean(window.ggrstMarkdown && window.ggrstMarkdown.renderInto(body, markdown,
      { resolveImageSource: resolveFromRoot, resolveLinkHref: resolveFromRoot }));
    if (!isRendered) {
      var fallback = el('p', null, markdown);
      fallback.style.whiteSpace = 'pre-wrap';
      body.appendChild(fallback);
    }
    return body;
  }

  function renderPost(posts, games, markdown) {
    var index = posts.findIndex(function (post) { return post.slug === slug; });
    if (index < 0) { showMessage(MSG_NOT_FOUND, true); return; }
    var meta = posts[index];
    var title = (meta.title && (meta.title.zh || meta.title.en)) || slug;
    document.title = title + ' · ggrst.io';
    var game = meta.game ? games.find(function (g) { return g.id === meta.game; }) : null;
    var body = buildBody(markdown);
    var toc = buildToc(addHeadingAnchors(body));
    output.replaceChildren.apply(output, [buildHeader(meta, title), game ? buildGameCard(game) : null, toc, body, buildPager(posts, index)]
      .filter(Boolean));
    enableLightbox(body);
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  if (!SLUG_PATTERN.test(slug) || !window.ggrstSite) {
    showMessage(MSG_NOT_FOUND, true);
    return;
  }

  // The game card is owner-only: loadPrivateGames() resolves to null for everyone else, never rejects.
  Promise.all([fetchResource('/data/posts.json', true), window.ggrstSite.loadPrivateGames(), fetchResource('/posts/' + slug + '.md', false)])
    .then(function (results) {
      renderPost(window.ggrstSite.publishedPosts(results[0]), results[1] || [], results[2]);
    })
    .catch(function (error) {
      if (error && error.notFound) {
        showMessage(MSG_NOT_FOUND, true);
        return;
      }
      console.error('Post failed to load:', error);
      showMessage(MSG_LOAD_FAILED, false);
    });
})();
