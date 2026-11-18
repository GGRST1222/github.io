/* post.html: renders one Markdown post. External file so the page CSP can forbid inline script. */
(function () {
  'use strict';

  var SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
  var MAX_HEADING_DEPTH = 6;
  var CATEGORY_LABELS = { game: '遊戲', code: '程式', know: '知識' };
  var CATEGORY_COLORS = { game: 'var(--amber)', code: 'var(--cobalt)' };
  var MSG_NOT_FOUND = '找不到這篇文章。';
  var MSG_LOAD_FAILED = '讀取文章失敗，請檢查網路後重新整理。';

  var output = document.getElementById('out');
  var slug = new URLSearchParams(location.search).get('p') || '';

  function showMessage(text, withBackLink) {
    var paragraph = document.createElement('p');
    paragraph.className = 'msg';
    paragraph.textContent = text + ' ';
    if (withBackLink) {
      var link = document.createElement('a');
      link.href = './#posts';
      link.textContent = '看其他文章';
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

  // The page title is the only h1, so Markdown "#" headings start at h2.
  function renderMarkdown(markdown) {
    if (!window.marked || !window.DOMPurify) return null;
    window.marked.use({
      walkTokens: function (token) {
        if (token.type === 'heading') token.depth = Math.min(MAX_HEADING_DEPTH, token.depth + 1);
      }
    });
    return window.DOMPurify.sanitize(window.marked.parse(markdown));
  }

  function buildHeader(meta, title) {
    var category = CATEGORY_LABELS[meta.cat] ? meta.cat : 'know';
    var dot = document.createElement('i');
    if (category === 'know') dot.className = 'know';
    else dot.style.background = CATEGORY_COLORS[category];

    var categoryLabel = document.createElement('span');
    categoryLabel.className = 'cat';
    categoryLabel.append(dot, CATEGORY_LABELS[category]);

    var time = document.createElement('time');
    time.className = 'num';
    time.dateTime = meta.date || '';
    time.textContent = meta.date || '';

    var metaRow = document.createElement('div');
    metaRow.className = 'post-meta';
    metaRow.append(categoryLabel, time);

    var heading = document.createElement('h1');
    heading.textContent = title;

    var header = document.createElement('header');
    header.className = 'post-head';
    header.append(metaRow, heading);
    return header;
  }

  function buildBody(markdown) {
    var body = document.createElement('div');
    body.className = 'prose';
    var sanitizedHtml = renderMarkdown(markdown);
    if (sanitizedHtml != null) {
      body.innerHTML = sanitizedHtml; // DOMPurify output, inserted once straight from sanitize()
    } else {
      var fallback = document.createElement('p');
      fallback.style.whiteSpace = 'pre-wrap';
      fallback.textContent = markdown;
      body.appendChild(fallback);
    }
    return body;
  }

  if (!SLUG_PATTERN.test(slug)) {
    showMessage(MSG_NOT_FOUND, true);
    return;
  }

  Promise.all([fetchResource('data/posts.json', true), fetchResource('posts/' + slug + '.md', false)])
    .then(function (results) {
      var posts = Array.isArray(results[0]) ? results[0] : [];
      var meta = posts.find(function (post) { return post.slug === slug; });
      if (!meta) {
        showMessage(MSG_NOT_FOUND, true);
        return;
      }
      var title = (meta.title && (meta.title.zh || meta.title.en)) || slug;
      document.title = title + ' · ggrst.io';
      output.replaceChildren(buildHeader(meta, title), buildBody(results[1]));
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
