/* Rules shared by index.html and post.html: which posts are public, where a post lives, how far a game is,
   and which game saves this viewer may see (the owner: all; visitors: the ones marked public). */
(function () {
  'use strict';

  var POSTS_BASE = '/posts/';
  var OWNER_TOKEN_KEY = 'ggrst-admin-token'; // written by the /admin/ login
  var SAVES_URL = 'https://api.github.com/repos/GGRST1222/ggrst-saves/contents/games.json';
  var PUBLIC_GAMES_URL = '/data/games-public.json'; // written by the admin: only the saves marked public

  function readOwnerToken() {
    try { return sessionStorage.getItem(OWNER_TOKEN_KEY) || localStorage.getItem(OWNER_TOKEN_KEY); }
    catch (storageError) { return null; } // storage blocked: treat the visitor as public
  }

  // Game saves live in a private repo. Only a browser where the owner logged in to /admin/ holds a token
  // that can read them; everyone else gets null and sees posts only.
  function loadPrivateGames() {
    var token = readOwnerToken();
    if (!token) return Promise.resolve(null);
    return fetch(SAVES_URL, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' reading private saves');
      return response.json();
    }).then(function (games) {
      return Array.isArray(games) ? games : [];
    }).catch(function (error) {
      console.warn('Private saves unavailable, showing the public site:', error);
      return null;
    });
  }

  function postUrl(slug) { return POSTS_BASE + encodeURIComponent(slug) + '/'; }

  // Drafts stay in data/posts.json so the admin can list them; the site never shows them.
  function publishedPosts(posts) {
    return (Array.isArray(posts) ? posts : [])
      .filter(function (post) { return !post.draft; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  // GitHub Pages answers a missing file with an error page (seen as 503, not 404), and the saves are only
  // extra content: any failure means "no public saves", never a broken page.
  function loadPublicGames() {
    return fetch(PUBLIC_GAMES_URL, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' reading ' + PUBLIC_GAMES_URL);
      return response.json();
    }).then(function (games) {
      return Array.isArray(games) ? games : [];
    }).catch(function (error) {
      console.warn('Public saves unavailable, showing posts only:', error);
      return [];
    });
  }

  // The owner gets every save from the private repo; visitors get only the saves marked public. Never rejects.
  function loadGames() {
    return loadPrivateGames().then(function (privateGames) {
      if (privateGames) return { games: privateGames, isOwner: true };
      return loadPublicGames().then(function (games) { return { games: games, isOwner: false }; });
    });
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

  window.ggrstSite = Object.freeze({ postUrl: postUrl, publishedPosts: publishedPosts, gameStats: gameStats, loadGames: loadGames });
})();
