/* index.html behaviour; loaded as an external file so the page CSP can forbid inline script. */
(function () {
  'use strict';
  var STRINGS = {
    zh: {
      langBtn: 'EN', langAria: 'Switch to English', langOther: 'en',
      cta1Games: '看遊戲存檔',
      slotsTitle: '選擇存檔', slotsHint: '點一下看詳細進度',
      slotMs: '里程碑', slotNoNote: '還沒有進度筆記',
      game: '遊戲', code: '程式', know: '知識', all: '全部', filterAria: '依主題篩選文章',
      noPosts: '第一篇文章還在寫。', noPostsLink: '先去看看遊戲存檔', latestTitle: '最新日誌', latestHint: '點一下開始閱讀', noPostsCat: '這個主題還沒有文章。', showAll: '看全部文章',
      read: '閱讀',
      milestones: '里程碑', collect: '收集', lastNote: '最近進度', relatedPosts: '相關日誌', msDone: '已完成', msTodo: '未完成', newTab: '（在新分頁開啟）',
      notStarted: '未開始', playing: '進行中', cleared: '已破關',
      mapTitle: '海拉魯地圖：塔區進度', towersLabel: '已開塔', fullMap: '完整互動地圖',
      st0: '未開塔', st1: '已開塔', st2: '已探索', mapNote: '示意圖，位置與比例為概略',
      beast: '神獸', castle: '海拉魯城', start: '起點',
      loadFail: '讀取資料失敗，請檢查網路後再試一次。', retry: '重試', loading: '讀取存檔中…'
    },
    en: {
      skip: 'Skip to content', navAria: 'Main', navPosts: 'Posts', navGames: 'Games',
      langBtn: '中文', langAria: '切換成中文', langOther: 'zh-Hant',
      heroTitle: 'Play games\nWrite code\nCollect knowledge',
      heroSub: 'Notes and explorations from games, code and everything worth knowing.',
      cta1: 'Read the latest posts', cta2: 'See my save files', cta1Games: 'See my save files',
      slotsTitle: 'Select a save file', slotsHint: 'Open one for details',
      slotMs: 'Milestones', slotNoNote: 'No progress notes yet',
      postsTitle: 'Quest log', postsSub: 'Latest posts: game notes, code notes and things worth knowing.',
      game: 'Games', code: 'Code', know: 'Knowledge', all: 'All', filterAria: 'Filter posts by topic',
      noPosts: 'The first post is still being written.', noPostsLink: 'See my save files meanwhile', latestTitle: 'Latest posts', latestHint: 'Pick one to read', noPostsCat: 'No posts on this topic yet.', showAll: 'Show all posts',
      read: 'Read',
      gamesTitle: 'Save files', gamesSub: 'What I am playing and how far I have got. Open a save for milestones and collections.',
      milestones: 'Milestones', collect: 'Collection', lastNote: 'Latest', relatedPosts: 'Related posts', msDone: 'done', msTodo: 'not done',
      notStarted: 'Not started', playing: 'Playing', cleared: 'Cleared',
      mapTitle: 'Hyrule map: tower regions', towersLabel: 'Towers', fullMap: 'Full interactive map',
      st0: 'Tower locked', st1: 'Tower active', st2: 'Explored', mapNote: 'Schematic, positions and scale are approximate',
      beast: 'Divine Beast', castle: 'Hyrule Castle', start: 'Start',
      contTitle: 'Continue?', contSub: 'My code, and the source of this site, live on GitHub.',
      contGh: 'See my code on GitHub', contTop: 'Back to top', newTab: ' (opens in a new tab)',
      footer: 'Built with a keyboard and a controller',
      loadFail: 'Could not load the data. Check your connection and try again.', retry: 'Try again', loading: 'Loading save files…'
    }
  };
  // The Chinese copy lives in the HTML; harvest it so switching back restores it.
  document.querySelectorAll('[data-i]').forEach(function (n) {
    var k = n.getAttribute('data-i'); if (!(k in STRINGS.zh)) STRINGS.zh[k] = n.textContent;
  });
  STRINGS.zh.navAria = '主選單';

  var REGIONS = [
    ['hebra', '赫布拉', 'Hebra', ''], ['woodland', '森林', 'Woodland', ''], ['eldin', '艾爾汀', 'Eldin', 'beast'],
    ['akkala', '阿卡萊', 'Akkala', ''], ['tabantha', '塔邦塔', 'Tabantha', 'beast'], ['ridgeland', '山丘', 'Ridgeland', ''],
    ['central', '中央', 'Central', 'castle'], ['gerudo', '格魯德高地', 'Gerudo', ''], ['plateau', '初始台地', 'Great Plateau', 'start'],
    ['lanayru', '拉聶爾', 'Lanayru', 'beast'], ['dueling', '雙子山', 'Dueling Peaks', ''], ['hateno', '哈特諾', 'Hateno', ''],
    ['wasteland', '格魯德沙漠', 'Wasteland', 'beast'], ['lake', '海利亞湖', 'Lake', ''], ['faron', '費羅尼', 'Faron', '']
  ];
  var ARROW = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var EXT = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  var CHEV = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // isOwner is true only where the /admin/ token can read the private saves.
  var state = { lang: 'zh', filter: 'all', games: null, posts: null, isOwner: false, error: false };
  var LANG_STORAGE_KEY = 'ggrst-lang';
  var LATEST_IN_HERO = 3;
  var LEGACY_STATE_KEY = 'ggrst-state-v1';
  try {
    var savedLang = localStorage.getItem(LANG_STORAGE_KEY);
    if (savedLang === 'en' || savedLang === 'zh') state.lang = savedLang;
    localStorage.removeItem(LEGACY_STATE_KEY);
  } catch (storageError) {
    // Storage is blocked (private mode, disabled site data): the page works without it.
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      var v = attrs[a];
      if (v == null || v === false) continue;
      if (a === 'text') n.textContent = v;
      else if (a === 'html') n.innerHTML = v;
      else if (a.slice(0, 2) === 'on') n.addEventListener(a.slice(2), v);
      else n.setAttribute(a, v);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function pick(o, zh) { if (!o) return ''; return (zh ? o.zh : o.en) || o.zh || o.en || ''; }
  function clampN(v, max) { v = Number(v) || 0; return Math.max(0, Math.min(max || 0, v)); }

  var gameStats = window.ggrstSite.gameStats;

  function fmtDate(iso, zh) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    try { return new Intl.DateTimeFormat(zh ? 'zh-Hant-TW' : 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(d); }
    catch (formatError) { return iso; } // unsupported locale: show the ISO date
  }

  function failMsg(t, cls) {
    return el('p', { class: cls }, [t.loadFail, el('button', { type: 'button', text: t.retry, onclick: load })]);
  }

  var barsPainted = false;
  // Visitors see the newest posts in the hero screen; the owner sees the save files.
  function renderLatest(t, zh, root) {
    var latest = state.posts.slice(0, LATEST_IN_HERO);
    if (!latest.length) { root.appendChild(el('p', { class: 'screen-msg', text: t.noPosts })); return; }
    latest.forEach(function (p, idx) {
      var cat = STRINGS[state.lang][p.cat] ? p.cat : 'know';
      root.appendChild(el('a', { class: 'slot', href: window.ggrstSite.postUrl(p.slug) }, [
        el('span', { class: 'no', 'aria-hidden': 'true', text: String(idx + 1) }),
        el('span', { class: 'nm', text: pick(p.title, zh) }),
        el('span', { class: 'go', 'aria-hidden': 'true', html: ARROW }),
        el('span', { class: 'meta', text: t[cat] + '　' + fmtDate(p.date, zh) })
      ]));
    });
  }

  function renderSlots(t, zh) {
    var root = document.getElementById('slots');
    root.innerHTML = '';
    document.getElementById('slotsTitle').textContent = state.isOwner ? t.slotsTitle : t.latestTitle;
    document.getElementById('slotsHint').textContent = state.isOwner ? t.slotsHint : t.latestHint;
    if (state.error) { root.appendChild(failMsg(t, 'screen-msg')); return; }
    if (!state.posts) { root.appendChild(el('p', { class: 'screen-msg', text: t.loading })); return; }
    root.removeAttribute('aria-busy');
    if (!state.isOwner) { renderLatest(t, zh, root); return; }
    var bars = [];
    state.games.forEach(function (g, idx) {
      var s = gameStats(g), name = pick(g.name, zh);
      var note = pick(g.note, zh).trim().split('\n')[0];
      var fill = el('i');
      bars.push([fill, s.pct]);
      root.appendChild(el('button', { type: 'button', class: 'slot',
        'aria-label': name + '，' + s.pct + '%，' + t[s.state],
        onclick: function () { openSave(g.id); } }, [
        el('span', { class: 'no', 'aria-hidden': 'true', text: String(idx + 1) }),
        el('span', { class: 'nm', text: name }),
        el('span', { class: 'pc' + (s.pct === 100 ? ' done' : ''), text: s.pct + '%' }),
        el('span', { class: 'meta', text: t.slotMs + ' ' + s.n + '/' + s.total + '　' + (note || t.slotNoNote) }),
        el('span', { class: 'sbar', 'aria-hidden': 'true' }, [fill])
      ]));
    });
    var apply = function () { bars.forEach(function (b) { b[0].style.transform = 'scaleX(' + b[1] / 100 + ')'; }); };
    if (!barsPainted) { barsPainted = true; requestAnimationFrame(function () { requestAnimationFrame(apply); }); }
    else { bars.forEach(function (b) { b[0].style.transition = 'none'; }); apply(); }
  }

  function openSave(id) {
    var d = document.getElementById('g-' + id);
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'start' });
    d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
    d.querySelector('summary').focus({ preventScroll: true });
  }

  function renderMap(g, t, zh) {
    var towers = g.towers || {}, labels = [t.st0, t.st1, t.st2], on = 0;
    var grid = el('div', { class: 'map', role: 'list', 'aria-label': t.mapTitle });
    REGIONS.forEach(function (r) {
      var s = clampN(towers[r[0]], 2); if (s > 0) on++;
      var st = el('span', { class: 'st' }, [labels[s]]);
      if (r[3]) st.appendChild(el('span', { class: 'mark', text: t[r[3]] }));
      grid.appendChild(el('div', { class: 'reg', role: 'listitem', 'data-s': String(s), style: 'grid-area:' + r[0] }, [
        el('span', {}, [el('span', { class: 'nm', text: zh ? r[1] : r[2] }), el('span', { class: 'sb', text: zh ? r[2] : r[1], lang: zh ? 'en' : 'zh-Hant' })]),
        st
      ]));
    });
    var ext = el('a', { class: 'ext', href: 'https://game8.co/games/LoZ-BotW/archives/292501', target: '_blank', rel: 'noopener' },
      [t.fullMap, el('span', { html: EXT }), el('span', { class: 'sr', text: t.newTab })]);
    return el('div', { class: 'save-map' }, [
      el('div', { class: 'map-head' }, [
        el('h4', { text: t.mapTitle }),
        el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:12px' }, [
          el('span', { class: 'tally' }, [t.towersLabel + ' ', el('b', { text: String(on) }), ' / 15']), ext
        ])
      ]),
      grid,
      el('div', { class: 'legend', 'aria-hidden': 'true' }, [
        el('span', {}, [el('i', { class: 'sw', style: 'background:var(--card)' }), el('b', { text: t.st0 })]),
        el('span', {}, [el('i', { class: 'sw', style: 'background:var(--amber);border-color:var(--amber)' }), el('b', { text: t.st1 })]),
        el('span', {}, [el('i', { class: 'sw', style: 'background:var(--ink);border-color:var(--ink)' }), el('b', { text: t.st2 })]),
        el('span', { class: 'fine', text: t.mapNote })
      ])
    ]);
  }

  function relatedPostList(gameId, zh) {
    var related = (state.posts || []).filter(function (p) { return p.game === gameId; });
    if (!related.length) return null;
    return el('ul', { class: 'related' }, related.map(function (p) {
      return el('li', {}, [el('a', { href: window.ggrstSite.postUrl(p.slug) }, [pick(p.title, zh), el('time', { class: 'num', datetime: p.date, text: fmtDate(p.date, zh) })])]);
    }));
  }

  function renderSaves(t, zh) {
    var root = document.getElementById('saves');
    var openIds = {};
    root.querySelectorAll('details[open]').forEach(function (d) { openIds[d.id] = true; });
    root.innerHTML = '';
    if (state.error) { root.appendChild(failMsg(t, 'state')); return; }
    if (!state.games) return;
    state.games.forEach(function (g, idx) {
      var s = gameStats(g), name = pick(g.name, zh), alt = zh ? g.name.en : g.name.zh;
      var fill = el('i', { style: 'transform:scaleX(' + s.pct / 100 + ')' });
      var info = el('span', { class: 'info' }, [el('span', { class: 'status' + (s.state === 'cleared' ? ' done' : s.state === 'playing' ? ' go' : ''), text: t[s.state] })]);
      if (g.platform) info.appendChild(el('span', { text: g.platform }));
      info.appendChild(el('span', { class: 'num', text: t.milestones + ' ' + s.n + '/' + s.total }));

      var ms = el('ul', { class: 'ms' });
      (g.milestones || []).forEach(function (m) {
        ms.appendChild(el('li', { class: m.done ? 'done' : null }, [
          el('span', { class: 'box', 'aria-hidden': 'true', html: m.done ? CHECK : '' }),
          el('span', { class: 'lbl' }, [pick(m, zh), el('span', { class: 'sr', text: (zh ? '，' : ', ') + (m.done ? t.msDone : t.msTodo) })])
        ]));
      });
      var left = el('div', {}, [el('h4', { class: 'group-t', text: t.milestones }), ms]);
      var note = pick(g.note, zh).trim();
      if (note) left.appendChild(el('div', {}, [el('h4', { class: 'group-t', style: 'margin-top:22px', text: t.lastNote }), el('p', { class: 'note', style: 'margin:0', text: note })]));
      var related = relatedPostList(g.id, zh);
      if (related) left.appendChild(el('div', {}, [el('h4', { class: 'group-t', style: 'margin-top:22px', text: t.relatedPosts }), related]));

      var right = null;
      if ((g.collect || []).length) {
        var coll = el('div', { class: 'coll' });
        g.collect.forEach(function (c) {
          var got = clampN(c.got, c.max);
          coll.appendChild(el('div', { class: 'crow' }, [
            el('span', { text: pick(c, zh) }),
            el('b', { text: got + ' / ' + c.max }),
            el('span', { class: 'mini', 'aria-hidden': 'true' }, [el('i', { style: 'transform:scaleX(' + (c.max ? got / c.max : 0) + ')' })])
          ]));
        });
        right = el('div', {}, [el('h4', { class: 'group-t', text: t.collect }), coll]);
      }

      var body = el('div', { class: 'save-body' }, [left, right, g.map === 'botw' ? renderMap(g, t, zh) : null]);
      var d = el('details', { class: 'save', id: 'g-' + g.id }, [
        el('summary', {}, [
          el('span', { class: 'no', 'aria-hidden': 'true', text: String(idx + 1) }),
          el('span', {}, [el('h3', {}, [name, el('span', { class: 'alt', text: alt })]), info]),
          el('span', { class: 'pc', text: s.pct + '%' }),
          el('span', { class: 'chev', html: CHEV }),
          el('span', { class: 'gbar' + (s.pct === 100 ? ' done' : ''), role: 'progressbar', 'aria-label': name, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(s.pct) }, [fill])
        ]),
        body
      ]);
      if (openIds[d.id]) d.open = true;
      root.appendChild(d);
    });
  }

  function renderPosts(t, zh) {
    var list = document.getElementById('postList'), f = document.getElementById('filters');
    list.innerHTML = ''; f.innerHTML = '';
    var cta1 = document.getElementById('cta1'), cta2 = document.getElementById('cta2');
    if (state.error) { f.hidden = true; list.appendChild(el('li', {}, [failMsg(t, 'state')])); return; }
    if (!state.posts) return;
    var posts = state.posts;
    var hasPosts = posts.length > 0;
    // No posts yet: the hero sends people to the saves instead of an empty log.
    var sendToGames = !hasPosts && state.isOwner;
    cta1.href = sendToGames ? '#games' : '#posts';
    cta1.textContent = sendToGames ? t.cta1Games : t.cta1;
    cta2.hidden = !(hasPosts && state.isOwner);
    f.hidden = !hasPosts;
    if (!hasPosts) {
      list.appendChild(el('li', {}, [el('p', { class: 'state' }, [t.noPosts + ' ', state.isOwner ? el('a', { href: '#games', text: t.noPostsLink }) : null])]));
      return;
    }
    f.setAttribute('aria-label', t.filterAria);
    ['all', 'game', 'code', 'know'].forEach(function (c) {
      f.appendChild(el('button', { type: 'button', 'aria-pressed': state.filter === c ? 'true' : 'false', text: t[c],
        onclick: function () { state.filter = c; renderPosts(STRINGS[state.lang], state.lang === 'zh'); f.querySelector('[aria-pressed="true"]').focus(); } }));
    });
    var shown = posts.filter(function (p) { return state.filter === 'all' || p.cat === state.filter; });
    if (!shown.length) {
      list.appendChild(el('li', {}, [el('p', { class: 'state' }, [t.noPostsCat + ' ', el('a', { href: '#posts', text: t.showAll,
        onclick: function (e) { e.preventDefault(); state.filter = 'all'; renderPosts(STRINGS[state.lang], state.lang === 'zh'); } })])]));
      return;
    }
    shown.forEach(function (p) {
      var cat = STRINGS[state.lang][p.cat] ? p.cat : 'know';
      list.appendChild(el('li', { class: 'quest' }, [
        el('a', { href: window.ggrstSite.postUrl(p.slug) }, [
          el('span', { class: 'when' }, [
            el('span', { class: 'cat' }, [el('i', { class: cat, style: cat === 'know' ? null : 'background:' + (cat === 'game' ? 'var(--amber)' : 'var(--cobalt)') }), t[cat]]),
            el('time', { datetime: p.date, class: 'num', text: fmtDate(p.date, zh) })
          ]),
          el('span', {}, [el('h3', { text: pick(p.title, zh) }), pick(p.excerpt, zh) ? el('p', { text: pick(p.excerpt, zh) }) : null]),
          el('span', { class: 'go', 'aria-hidden': 'true', html: ARROW })
        ])
      ]));
    });
  }

  function render() {
    var zh = state.lang === 'zh', t = STRINGS[state.lang];
    document.documentElement.lang = zh ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-i]').forEach(function (n) { var v = t[n.getAttribute('data-i')]; if (v != null) n.textContent = v; });
    document.querySelectorAll('[data-i-aria]').forEach(function (n) { n.setAttribute('aria-label', t[n.getAttribute('data-i-aria')]); });
    var lb = document.getElementById('langBtn');
    lb.textContent = t.langBtn; lb.setAttribute('aria-label', t.langAria); lb.setAttribute('lang', t.langOther);
    document.getElementById('games').hidden = !state.isOwner;
    document.getElementById('navGamesLink').hidden = !state.isOwner;
    renderSlots(t, zh); renderSaves(t, zh); renderPosts(t, zh);
  }

  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function load() {
    state.error = false; state.games = null; state.posts = null; render();
    Promise.all([window.ggrstSite.loadPrivateGames(), getJSON('data/posts.json')]).then(function (res) {
      state.isOwner = res[0] !== null;
      state.games = res[0] || [];
      state.posts = window.ggrstSite.publishedPosts(res[1]);
      render();
      if (state.isOwner && /^#g-/.test(location.hash)) openSave(location.hash.slice(3));
    }).catch(function (error) {
      console.error('Site data failed to load:', error);
      state.error = true;
      render();
    });
  }

  document.getElementById('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_STORAGE_KEY, state.lang); } catch (storageError) { /* language choice just won't persist */ }
    render();
  });

  // Keep anchor jumps clear of the sticky header whatever its height.
  var hdr = document.getElementById('hdr');
  function setHdr() { document.documentElement.style.setProperty('--hdr', hdr.offsetHeight + 'px'); }
  if ('ResizeObserver' in window) new ResizeObserver(setHdr).observe(hdr); else setHdr();

  load();
})();
