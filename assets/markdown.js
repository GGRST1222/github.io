/* Shared Markdown renderer for post.html and the admin preview: marked parses, DOMPurify sanitizes, highlight.js colors code. */
(function () {
  'use strict';

  var MAX_HEADING_DEPTH = 6;
  var LANGUAGE_CLASS_PREFIX = 'language-';
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

  // The hook runs only during this sanitize() call, on DOMPurify's inert copy, so no image is fetched from its original src.
  function sanitize(html, resolveImageSource) {
    if (!resolveImageSource) return window.DOMPurify.sanitize(html);
    window.DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if (node.nodeName === 'IMG' && node.hasAttribute('src')) node.setAttribute('src', resolveImageSource(node.getAttribute('src')));
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
  function highlightCodeBlocks(container) {
    if (!window.hljs) return;
    container.querySelectorAll('pre > code').forEach(function (codeBlock) {
      var language = findLanguage(codeBlock);
      if (!language) return;
      window.hljs.highlightElement(codeBlock);
      codeBlock.parentElement.dataset.lang = language.name || '';
    });
  }

  /**
   * Renders Markdown into container. Returns false, leaving container untouched, when marked or DOMPurify did not load.
   * options.resolveImageSource(src) may return a different src for each image (the admin preview uses it).
   */
  function renderInto(container, markdown, options) {
    var markdownParser = getParser();
    if (!markdownParser || !window.DOMPurify) return false;
    var resolveImageSource = options && options.resolveImageSource;
    container.innerHTML = sanitize(markdownParser.parse(markdown), resolveImageSource); // DOMPurify output, inserted once straight from sanitize()
    highlightCodeBlocks(container);
    return true;
  }

  window.ggrstMarkdown = Object.freeze({ renderInto: renderInto });
})();
