/* Shared Markdown renderer for post.html and the admin preview: marked parses, DOMPurify sanitizes, highlight.js colors code. */
(function () {
  'use strict';

  var MAX_HEADING_DEPTH = 6;
  var LANGUAGE_CLASS_PREFIX = 'language-';
  var COPY_RESET_MS = 2000;
  var parser = null;

  // The page title is the only h1, so Markdown "#" headings start at h2.
  function demoteHeading(token) {
    if (token.type === 'heading') token.depth = Math.min(MAX_HEADING_DEPTH, token.depth + 1);
  }

  // One parser instance: marked.use() on the shared instance would stack the heading shift on every render.
  function getParser() {
    if (!parser && window.marked && window.marked.Marked) parser = new window.marked.Marked({ walkTokens: demoteHeading });
    return parser;
  }

  // The hook runs only during this sanitize() call, on DOMPurify's inert copy, so images are lazy and
  // already point at their final src before the browser sees them.
  function sanitize(html, options) {
    window.DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if (node.nodeName === 'IMG') {
        node.setAttribute('loading', 'lazy');
        node.setAttribute('decoding', 'async');
        if (options.resolveImageSource && node.hasAttribute('src')) node.setAttribute('src', options.resolveImageSource(node.getAttribute('src')));
      } else if (node.nodeName === 'A' && options.resolveLinkHref && node.hasAttribute('href')) {
        node.setAttribute('href', options.resolveLinkHref(node.getAttribute('href')));
      }
    });
    try {
      return window.DOMPurify.sanitize(html);
    } finally {
      window.DOMPurify.removeHook('afterSanitizeAttributes');
    }
  }

  function findLanguage(codeBlock) {
    var languageClass = Array.prototype.find.call(codeBlock.classList, function (name) {
      return name.indexOf(LANGUAGE_CLASS_PREFIX) === 0;
    });
    return languageClass ? window.hljs.getLanguage(languageClass.slice(LANGUAGE_CLASS_PREFIX.length)) : null;
  }

  // Only fences that name a known language get colored: auto-detection guesses wrong on short snippets.
  function highlightCodeBlock(codeBlock) {
    if (!window.hljs) return;
    var language = findLanguage(codeBlock);
    if (!language) return;
    window.hljs.highlightElement(codeBlock);
    codeBlock.parentElement.dataset.lang = language.name || '';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('Clipboard API unavailable'));
  }

  // The button sits in a wrapper, not inside <pre>, so it stays put while a long line scrolls sideways.
  function addCopyButton(pre) {
    var wrapper = document.createElement('div');
    wrapper.className = 'code-wrap';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = '複製';
    button.addEventListener('click', function () {
      copyText(pre.querySelector('code').textContent).then(function () {
        button.textContent = '已複製';
      }, function (copyError) {
        console.warn('Copy failed, selecting the code instead:', copyError);
        window.getSelection().selectAllChildren(pre);
        button.textContent = '請按 Ctrl+C';
      }).then(function () {
        setTimeout(function () { button.textContent = '複製'; }, COPY_RESET_MS);
      });
    });
    pre.replaceWith(wrapper);
    wrapper.append(pre, button);
  }

  /**
   * Renders Markdown into container. Returns false, leaving container untouched, when marked or DOMPurify did not load.
   * options.resolveImageSource(src) and options.resolveLinkHref(href) may rewrite each image or link.
   */
  function renderInto(container, markdown, options) {
    var markdownParser = getParser();
    if (!markdownParser || !window.DOMPurify) return false;
    container.innerHTML = sanitize(markdownParser.parse(markdown), options || {}); // DOMPurify output, inserted once straight from sanitize()
    container.querySelectorAll('pre > code').forEach(function (codeBlock) {
      highlightCodeBlock(codeBlock);
      addCopyButton(codeBlock.parentElement);
    });
    return true;
  }

  window.ggrstMarkdown = Object.freeze({ renderInto: renderInto });
})();
