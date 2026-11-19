/* Rules shared by index.html and post.html: which posts are public, where a post lives, how far a game is. */
(function () {
  'use strict';

  var POSTS_BASE = '/posts/';

  function postUrl(slug) { return POSTS_BASE + encodeURIComponent(slug) + '/'; }

  // Drafts stay in data/posts.json so the admin can list them; the site never shows them.
  function publishedPosts(posts) {
    return (Array.isArray(posts) ? posts : [])
      .filter(function (post) { return !post.draft; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  function gameStats(game) {
    var milestones = game.milestones || [];
    var doneCount = milestones.filter(function (m) { return m.done; }).length;
    var pct = milestones.length ? Math.round(doneCount / milestones.length * 100) : 0;
    var towers = game.towers || {};
    var isStarted = doneCount > 0 || (game.collect || []).some(function (c) { return c.got > 0; }) ||
      Object.keys(towers).some(function (key) { return towers[key] > 0; }) || Boolean(game.note && (game.note.zh || game.note.en));
    return { n: doneCount, total: milestones.length, pct: pct, state: pct === 100 ? 'cleared' : isStarted ? 'playing' : 'notStarted' };
  }

  window.ggrstSite = Object.freeze({ postUrl: postUrl, publishedPosts: publishedPosts, gameStats: gameStats });
})();
