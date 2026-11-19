/* ggrst.io admin: edits posts (public site repo) and game saves (private repo) through the GitHub Contents API. */
(function () {
  'use strict';
  var OWNER = 'GGRST1222';
  var API_ROOT = 'https://api.github.com/repos/' + OWNER + '/';
  var SITE_REPO = Object.freeze({ name: 'github.io', branch: 'master', label: '網站' });
  // Game saves are owner-only, so they live outside the public site repo.
  var SAVES_REPO = Object.freeze({ name: 'ggrst-saves', branch: 'master', label: '遊戲存檔' });
  var SAVES_FILE = 'games.json';
  // Saves marked public are copied here, in the public site repo, for visitors.
  var PUBLIC_GAMES_FILE = 'data/games-public.json';
  var TOKEN_KEY = 'ggrst-admin-token';
  var CATS = [['game', '遊戲'], ['code', '程式'], ['know', '知識']];
  var REGIONS = [['hebra', '赫布拉'], ['woodland', '森林'], ['eldin', '艾爾汀'], ['akkala', '阿卡萊'], ['tabantha', '塔邦塔'],
    ['ridgeland', '山丘'], ['central', '中央'], ['gerudo', '格魯德高地'], ['plateau', '初始台地'], ['lanayru', '拉聶爾'],
    ['dueling', '雙子山'], ['hateno', '哈特諾'], ['wasteland', '格魯德沙漠'], ['lake', '海利亞湖'], ['faron', '費羅尼']];
  var TOWER_ST = ['未開塔', '已開塔', '已探索'];
  var SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
  var GAME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;
  var TOAST_MS = 6000;
  var TOAST_ERROR_MS = 9000;
  var DELETE_CONFIRM_MS = 4000;
  var BASE64_CHUNK = 0x8000; // keeps String.fromCharCode.apply under engine argument limits
  var IMAGE_EXTENSIONS = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/gif', 'gif'], ['image/webp', 'webp']]);
  var IMAGE_ACCEPT = Array.from(IMAGE_EXTENSIONS.keys()).join(',');
  var IMAGE_DIR = 'images';
  var BYTES_PER_MB = 1024 * 1024;
  var MAX_IMAGE_MB = 5; // per uploaded file, after compression
  var MAX_IMAGE_BYTES = MAX_IMAGE_MB * BYTES_PER_MB;
  var MAX_SOURCE_IMAGE_MB = 25; // phone photos before compression
  var MAX_SOURCE_IMAGE_BYTES = MAX_SOURCE_IMAGE_MB * BYTES_PER_MB;
  var COMPRESSIBLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']); // not GIF: re-encoding drops the animation
  var IMAGE_MAX_EDGE = 1600; // px; twice the 72ch column, sharp on high-density screens
  var IMAGE_QUALITY = 0.85;
  var COMPRESS_OVER_BYTES = 500 * 1024; // smaller images that already fit IMAGE_MAX_EDGE are uploaded as they are
  var SPLIT_MIN_WIDTH = 1200; // px; below this the side-by-side panes are too narrow to read
  var PREVIEW_DELAY_MS = 200;
  var AUTOSAVE_PREFIX = 'ggrst-autosave:';
  var AUTOSAVE_DELAY_MS = 800;
  var LINK_PLACEHOLDER = 'https://';
  var IMAGE_NAME_RANDOM_BYTES = 3; // 6 hex characters, so two images saved in the same second don't collide
  var MAX_ALT_LENGTH = 80;
  var DEFAULT_IMAGE_ALT = '圖片說明';
  var SITE_ROOT_URL = new URL('../', location.href).href; // post.html resolves image paths from the site root

  // A <meta> CSP cannot set frame-ancestors, so refuse to run inside a frame (clickjacking).
  if (window.top !== window.self) {
    document.body.textContent = '後台不能在框架內開啟。';
    return;
  }

  var app = document.getElementById('app');
  var state = { token: null, tab: 'posts', posts: null, postsSha: null, games: null, gamesSha: null, dirty: false, busy: false };

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      var v = attrs[a];
      if (v == null || v === false) continue;
      if (a === 'text') n.textContent = v;
      else if (a === 'value') n.value = v;
      else if (a === 'checked') n.checked = !!v;
      else if (a.slice(0, 2) === 'on') n.addEventListener(a.slice(2), v);
      else n.setAttribute(a, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function field(label, input, hint) {
    return el('label', { class: 'f' }, [label, hint ? el('span', { class: 'hint', text: hint }) : null, input]);
  }
  function bytesToBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += BASE64_CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + BASE64_CHUNK));
    return btoa(bin);
  }
  function b64encode(str) { return bytesToBase64(new TextEncoder().encode(str)); }
  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  var toastTimer;
  function toast(msg, bad, link) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : '');
    if (link) { t.appendChild(document.createTextNode(' ')); t.appendChild(el('a', { href: link[1], target: '_blank', rel: 'noopener', text: link[0] })); }
    t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, bad ? TOAST_ERROR_MS : TOAST_MS);
  }
  function setDirty(v) { state.dirty = v; }
  window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  function leaveOk() { return !state.dirty || window.confirm('有尚未儲存的變更，確定要離開這個編輯畫面嗎？'); }
  function commitMsg(text) {
    return '[version]: main [bugtrack id]: [priority]: [problem]: content update [solution]: ' + text + ' (via admin)';
  }

  /* ---------- GitHub API ---------- */
  function gh(method, path, body, repo) {
    return fetch(API_ROOT + (repo || SITE_REPO).name + path, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + state.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      if (r.ok) return r.status === 204 ? null : r.json();
      var e = new Error('HTTP ' + r.status); e.status = r.status; throw e;
    });
  }
  function explain(e) {
    if (e && e.userMessage) return e.userMessage;
    if (!e || !e.status) return '連不上 GitHub，請檢查網路後再試一次。';
    if (e.status === 401) return '登入已失效（token 無效或過期），請重新登入。';
    if (e.status === 403) return 'Token 沒有寫入權限，或 GitHub 暫時限制了請求次數。請確認 Contents 權限是 Read and write。';
    if (e.status === 404) return '找不到檔案或 repo。請確認 token 有 ' + OWNER + '/' + SITE_REPO.name + ' 和 ' + OWNER + '/' + SAVES_REPO.name + ' 的權限。';
    if (e.status === 409 || e.status === 422) return '檔案在別處被改過了。已重新載入最新資料，請再改一次。';
    return 'GitHub 回應錯誤（' + e.status + '），請稍後再試。';
  }
  // repo defaults to the public site repo; pass SAVES_REPO for the private game saves.
  function getFile(path, repo) {
    var target = repo || SITE_REPO;
    return gh('GET', '/contents/' + path + '?ref=' + target.branch, null, target).then(function (f) { return { text: b64decode(f.content), sha: f.sha }; });
  }
  function putContent(path, base64, sha, msg, repo) {
    var target = repo || SITE_REPO;
    return gh('PUT', '/contents/' + path, { message: msg, content: base64, sha: sha || undefined, branch: target.branch }, target)
      .then(function (r) { return r.content.sha; });
  }
  function putFile(path, text, sha, msg, repo) { return putContent(path, b64encode(text), sha, msg, repo); }
  function delFile(path, sha, msg) { return gh('DELETE', '/contents/' + path, { message: msg, sha: sha, branch: SITE_REPO.branch }); }
  // A missing public file just means nothing is public yet; it is created on the first public save.
  function getPublicGamesFile() {
    return getFile(PUBLIC_GAMES_FILE).catch(function (e) {
      if (e && e.status === 404) return { text: publicGamesText([]), sha: null };
      throw e;
    });
  }
  function loadData() {
    return Promise.all([getFile('data/posts.json'), getFile(SAVES_FILE, SAVES_REPO), getPublicGamesFile()]).then(function (r) {
      state.posts = JSON.parse(r[0].text); state.postsSha = r[0].sha;
      state.games = JSON.parse(r[1].text); state.gamesSha = r[1].sha;
      state.publicGamesText = r[2].text; state.publicGamesSha = r[2].sha;
    });
  }
  function onFail(e) {
    toast(explain(e), true);
    if (e && e.status === 401) return logout();
    if (e && (e.status === 409 || e.status === 422)) loadData().then(function () { setDirty(false); renderList(); }).catch(function () {});
  }
  function busy(btn, on, label) {
    state.busy = on;
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || '儲存中…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function saved(link) { toast('已儲存。網站約 1 分鐘後更新。', false, link || ['看網站', '../']); }

  /* ---------- login ---------- */
  function readToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY); }
    catch (storageError) { return null; } // storage blocked: the login screen asks again
  }
  function storeToken(tok, remember) {
    try {
      sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY);
      if (tok) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, tok);
    } catch (storageError) {
      // Storage blocked: the session still works in memory, it just won't survive a reload.
      console.warn('Token not persisted:', storageError.name);
    }
  }
  function logout() {
    if (!leaveOk()) return;
    storeToken(null); state.token = null; setDirty(false);
    document.getElementById('topnav').hidden = true;
    renderLogin();
  }
  document.getElementById('logout').addEventListener('click', logout);

  // The token must be able to write both repos; name the one it is missing so the fix is obvious.
  function checkPush(repo) {
    return gh('GET', '', null, repo).then(function (info) {
      if (info.permissions && info.permissions.push) return;
      var error = new Error('No push access to ' + repo.name);
      error.userMessage = 'Token 沒有 ' + OWNER + '/' + repo.name + '（' + repo.label + '）的寫入權限。請在 token 的 Repository access 加上這個 repo，Contents 設為 Read and write。';
      throw error;
    }, function (error) {
      if (error && error.status === 404) {
        error.userMessage = 'Token 看不到 ' + OWNER + '/' + repo.name + '（' + repo.label + '）。請在 token 的 Repository access 加上這個 repo。';
      }
      throw error;
    });
  }

  function renderLogin(errMsg) {
    app.innerHTML = '';
    var tok = el('input', { type: 'password', id: 'tok', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'tokErr' });
    var rem = el('input', { type: 'checkbox' });
    var err = el('p', { class: 'err', id: 'tokErr', text: errMsg || '' });
    var btn = el('button', { type: 'submit', class: 'btn btn-solid', text: '登入' });
    var form = el('form', { class: 'stack', onsubmit: function (e) {
      e.preventDefault();
      var v = tok.value.trim();
      if (!v) { err.textContent = '請貼上 token。'; tok.setAttribute('aria-invalid', 'true'); tok.focus(); return; }
      state.token = v; busy(btn, true, '確認中…');
      Promise.all([checkPush(SITE_REPO), checkPush(SAVES_REPO)]).then(function () {
        state.busy = false; storeToken(v, rem.checked); return start();
      }).catch(function (e) {
        busy(btn, false); state.token = null;
        err.textContent = explain(e); tok.setAttribute('aria-invalid', 'true'); tok.focus();
      });
    } }, [
      field('GitHub token', tok),
      el('label', { class: 'chk' }, [rem, '在這台裝置記住我']),
      err, el('div', {}, [btn])
    ]);
    app.appendChild(el('div', { class: 'login panel stack' }, [
      el('h1', { text: '後台登入' }),
      el('p', { class: 'muted', style: 'margin:0', text: '用 GitHub token 登入。文章會 commit 到 ' + OWNER + '/' + SITE_REPO.name + '（網站約 1 分鐘後更新），遊戲存檔存在私人的 ' + OWNER + '/' + SAVES_REPO.name + '，只有登入過的瀏覽器看得到。' }),
      form,
      el('details', {}, [
        el('summary', { style: 'cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center', text: '怎麼取得 token？' }),
        el('ol', {}, [
          el('li', {}, ['打開 ', el('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener', text: 'GitHub 新增 fine-grained token' })]),
          el('li', { text: 'Repository access 選「Only select repositories」，勾 ' + OWNER + '/' + SITE_REPO.name + ' 和 ' + OWNER + '/' + SAVES_REPO.name }),
          el('li', { text: 'Permissions → Repository permissions → Contents 設為「Read and write」' }),
          el('li', { text: '產生後複製 token，貼到上面' })
        ]),
        el('p', { class: 'muted', text: '沒勾「記住我」時，關掉分頁就會登出。不要在公用電腦勾選。' })
      ])
    ]));
    tok.focus();
  }

  function start() {
    app.innerHTML = '';
    app.appendChild(el('p', { class: 'muted', text: '讀取資料中…' }));
    return loadData().then(function () {
      document.getElementById('topnav').hidden = false;
      renderList();
    }).catch(function (e) {
      if (e && e.status === 401) { storeToken(null); state.token = null; renderLogin(explain(e)); return; }
      app.innerHTML = '';
      app.appendChild(el('p', { class: 'err', text: explain(e) + ' ' }));
      app.appendChild(el('button', { type: 'button', class: 'btn btn-line', text: '重試', onclick: start }));
    });
  }

  /* ---------- list screens ---------- */
  function shell(title, actions, body) {
    app.innerHTML = '';
    var tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': '內容類型' });
    [['posts', '文章'], ['games', '遊戲存檔']].forEach(function (t) {
      tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false',
        text: t[1], onclick: function () { if (!leaveOk()) return; setDirty(false); state.tab = t[0]; renderList(); } }));
    });
    app.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'bar' }, [el('h1', { text: '後台' }), tabs]),
      el('div', { class: 'bar' }, [el('h2', { text: title }), actions]),
      body
    ]));
  }
  function armDelete(btn, run) {
    btn.addEventListener('click', function () {
      if (state.busy) return;
      if (!btn.classList.contains('armed')) {
        btn.classList.add('armed'); btn.dataset.label = btn.textContent; btn.textContent = '再按一次確認刪除';
        setTimeout(function () { if (btn.isConnected && btn.classList.contains('armed') && !btn.disabled) { btn.classList.remove('armed'); btn.textContent = btn.dataset.label; } }, DELETE_CONFIRM_MS);
        return;
      }
      btn.classList.remove('armed'); run();
    });
  }
  function renderList() {
    if (state.tab === 'posts') {
      var posts = state.posts.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      var ul = el('ul', { class: 'list' });
      if (!posts.length) ul.appendChild(el('li', { class: 'empty', style: 'display:block', text: '還沒有文章。按「新增文章」寫第一篇。' }));
      posts.forEach(function (p) {
        var del = el('button', { type: 'button', class: 'btn btn-danger', text: '刪除' });
        armDelete(del, function () { deletePost(p, del); });
        var cat = (CATS.filter(function (c) { return c[0] === p.cat; })[0] || ['', ''])[1];
        ul.appendChild(el('li', {}, [
          el('div', {}, [el('div', { class: 't' }, [(p.title && p.title.zh) || p.slug, p.draft ? el('span', { class: 'badge', text: '草稿' }) : null]), el('div', { class: 's', text: [cat, p.date, p.slug].filter(Boolean).join(' · ') })]),
          el('div', { class: 'acts' }, [el('button', { type: 'button', class: 'btn btn-line', text: '編輯', onclick: function () { editPost(p); } }), del])
        ]));
      });
      shell('文章', el('button', { type: 'button', class: 'btn btn-solid', text: '新增文章', onclick: function () { editPost(null); } }), ul);
    } else {
      var gl = el('ul', { class: 'list' });
      if (!state.games.length) gl.appendChild(el('li', { class: 'empty', style: 'display:block', text: '還沒有遊戲存檔。按「新增遊戲」建立第一個。' }));
      state.games.forEach(function (g, i) {
        var done = (g.milestones || []).filter(function (m) { return m.done; }).length, tot = (g.milestones || []).length;
        var del = el('button', { type: 'button', class: 'btn btn-danger', text: '刪除' });
        armDelete(del, function () { deleteGame(i, del); });
        gl.appendChild(el('li', {}, [
          el('div', {}, [el('div', { class: 't' }, [g.name.zh || g.name.en, el('span', { class: 'badge' + (g.public ? ' on' : ''), text: g.public ? '公開' : '僅自己' })]),
            el('div', { class: 's', text: [g.platform, '里程碑 ' + done + '/' + tot].filter(Boolean).join(' · ') })]),
          el('div', { class: 'acts' }, [el('button', { type: 'button', class: 'btn btn-line', text: '編輯', onclick: function () { editGame(i); } }), del])
        ]));
      });
      shell('遊戲存檔', el('button', { type: 'button', class: 'btn btn-solid', text: '新增遊戲', onclick: function () { editGame(-1); } }), gl);
    }
  }

  /* ---------- post body: images ---------- */
  function twoDigits(n) { return (n < 10 ? '0' : '') + n; }
  function randomHex(byteCount) {
    return Array.from(crypto.getRandomValues(new Uint8Array(byteCount)), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  // images/2026/11/20261119-214530-a1b2c3.webp: sorted by date, independent of the post's slug, which may not exist yet.
  function newImagePath(extension) {
    var d = new Date();
    var stamp = d.getFullYear() + twoDigits(d.getMonth() + 1) + twoDigits(d.getDate()) + '-' +
      twoDigits(d.getHours()) + twoDigits(d.getMinutes()) + twoDigits(d.getSeconds());
    return IMAGE_DIR + '/' + d.getFullYear() + '/' + twoDigits(d.getMonth() + 1) + '/' + stamp + '-' + randomHex(IMAGE_NAME_RANDOM_BYTES) + '.' + extension;
  }
  // Pasted screenshots are all named "image.png", so they get a placeholder the author is meant to replace.
  function imageAlt(file, isPasted) {
    if (isPasted) return DEFAULT_IMAGE_ALT;
    var name = file.name.replace(/\.[^.]*$/, '').replace(/[[\]\\\r\n]/g, ' ').trim().slice(0, MAX_ALT_LENGTH);
    return name || DEFAULT_IMAGE_ALT;
  }
  // Splits files into accepted images and messages for the rest; maxBytes is checked again after compression.
  function checkImages(files, maxBytes, sizeMessage) {
    return files.reduce(function (result, file) {
      if (!IMAGE_EXTENSIONS.has(file.type)) return { accepted: result.accepted, problems: result.problems.concat(['「' + file.name + '」不是 PNG、JPEG、GIF 或 WebP 圖片']) };
      if (file.size > maxBytes) return { accepted: result.accepted, problems: result.problems.concat(['「' + file.name + '」' + sizeMessage]) };
      return { accepted: result.accepted.concat([file]), problems: result.problems };
    }, { accepted: [], problems: [] });
  }
  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }
  // Shrinks photos to IMAGE_MAX_EDGE and re-encodes them as WebP. GIFs keep their animation, and any image
  // the browser cannot decode or shrink is uploaded unchanged.
  function compressImage(file) {
    if (!COMPRESSIBLE_TYPES.has(file.type) || typeof createImageBitmap !== 'function') return Promise.resolve(file);
    return createImageBitmap(file).then(function (bitmap) {
      var scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size <= COMPRESS_OVER_BYTES) { bitmap.close(); return file; }
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvasToBlob(canvas, 'image/webp', IMAGE_QUALITY).then(function (blob) {
        // A browser that cannot encode WebP returns PNG, usually larger than the original: keep the original then.
        if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]*$/, '') + '.webp', { type: 'image/webp' });
      });
    }, function (decodeError) {
      console.warn('Could not decode image, uploading it unchanged:', file.name, decodeError);
      return file;
    });
  }
  function hasDraggedFiles(event) {
    return Boolean(event.dataTransfer) && Array.prototype.indexOf.call(event.dataTransfer.types, 'Files') !== -1;
  }
  function readImageBase64(file) {
    return file.arrayBuffer().then(function (buffer) { return bytesToBase64(new Uint8Array(buffer)); }, function (readError) {
      console.error('Image read failed:', file.name, readError);
      var error = new Error('Image read failed: ' + file.name);
      error.userMessage = '讀不到圖片「' + file.name + '」，請重新插入一次。';
      throw error;
    });
  }

  /* ---------- post body: editor ---------- */
  // Returns { node, textarea, showWrite, uploadImages, pendingImageCount, dispose }.
  // Images stay in the browser until uploadImages runs on save.
  function postBodyEditor() {
    var pendingImages = new Map(); // repo path -> { file, objectUrl, isUploaded }
    var splitQuery = window.matchMedia('(min-width: ' + SPLIT_MIN_WIDTH + 'px)');
    var mode = 'write', previewTimer = null;
    var textarea = el('textarea', { id: 'postBody', class: 'md', spellcheck: 'false', value: '', 'aria-describedby': 'postBodyHint' });
    var preview = el('div', { class: 'prose preview', hidden: true, 'aria-label': '預覽' });
    var picker = el('input', { type: 'file', accept: IMAGE_ACCEPT, multiple: true, hidden: true, onchange: function () {
      insertImages(Array.from(picker.files), false); picker.value = '';
    } });
    var modeButtons = {
      write: el('button', { type: 'button', 'aria-pressed': 'true', text: '撰寫', onclick: function () { setMode('write'); textarea.focus(); } }),
      preview: el('button', { type: 'button', 'aria-pressed': 'false', text: '預覽', onclick: function () { setMode('preview'); } }),
      split: el('button', { type: 'button', 'aria-pressed': 'false', text: '並排', hidden: !splitQuery.matches, onclick: function () { setMode('split'); textarea.focus(); } })
    };
    var node = el('div', { class: 'editor' }, [
      el('div', { class: 'editor-bar' }, [
        el('label', { class: 'f', for: 'postBody' }, ['內文（Markdown）']),
        el('div', { class: 'acts' }, [
          el('div', { class: 'tabs', role: 'group', 'aria-label': '編輯模式' }, [modeButtons.write, modeButtons.preview, modeButtons.split]),
          el('button', { type: 'button', class: 'btn btn-line', text: '插入圖片', onclick: function () { picker.click(); } })
        ])
      ]),
      el('p', { class: 'editor-hint', id: 'postBodyHint', text: '程式碼區塊開頭的三個反引號後面寫上語言（例如 js、python、csharp）就會自動上色。圖片可以拖曳、貼上或按「插入圖片」，大圖會自動縮小，儲存文章時才上傳。快捷鍵：Ctrl+B 粗體、Ctrl+I 斜體、Ctrl+K 連結。' }),
      el('div', { class: 'panes' }, [textarea, preview]),
      picker
    ]);

    function resolvePreviewImage(src) {
      var pending = pendingImages.get(src);
      return pending ? pending.objectUrl : new URL(src, SITE_ROOT_URL).href;
    }
    function renderPreview() {
      if (!textarea.value.trim()) { preview.replaceChildren(el('p', { class: 'muted', text: '還沒有內容可以預覽。' })); return; }
      var isRendered = Boolean(window.ggrstMarkdown && window.ggrstMarkdown.renderInto(preview, textarea.value, { resolveImageSource: resolvePreviewImage }));
      if (!isRendered) preview.replaceChildren(el('p', { class: 'err', text: '預覽元件沒有載入，請重新整理頁面。' }));
    }
    function setMode(nextMode) {
      mode = nextMode === 'split' && !splitQuery.matches ? 'write' : nextMode;
      Object.keys(modeButtons).forEach(function (key) { modeButtons[key].setAttribute('aria-pressed', String(key === mode)); });
      textarea.hidden = mode === 'preview';
      preview.hidden = mode === 'write';
      node.classList.toggle('split', mode === 'split');
      app.classList.toggle('wide', mode === 'split');
      if (mode !== 'write') renderPreview();
    }
    splitQuery.addEventListener('change', function () {
      modeButtons.split.hidden = !splitQuery.matches;
      if (mode === 'split' && !splitQuery.matches) setMode('write');
    });
    textarea.addEventListener('input', function () {
      if (mode !== 'split') return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, PREVIEW_DELAY_MS);
    });

    // execCommand keeps the edit on the textarea's undo stack (Ctrl+Z); setRangeText is the fallback where it is gone.
    function replaceRange(text, start, end) {
      textarea.focus();
      textarea.setSelectionRange(start, end);
      var isInserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
      if (!isInserted) {
        textarea.setRangeText(text, start, end, 'end');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    function wrapSelection(before, after, placeholder) {
      var start = textarea.selectionStart, end = textarea.selectionEnd;
      var selected = textarea.value.slice(start, end) || placeholder;
      replaceRange(before + selected + after, start, end);
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }
    function insertLink() {
      var start = textarea.selectionStart, end = textarea.selectionEnd;
      var text = textarea.value.slice(start, end) || '連結文字';
      replaceRange('[' + text + '](' + LINK_PLACEHOLDER + ')', start, end);
      var urlStart = start + text.length + 3;
      textarea.setSelectionRange(urlStart, urlStart + LINK_PLACEHOLDER.length);
    }
    var SHORTCUTS = new Map([
      ['b', function () { wrapSelection('**', '**', '粗體文字'); }],
      ['i', function () { wrapSelection('*', '*', '斜體文字'); }],
      ['k', insertLink]
    ]);
    textarea.addEventListener('keydown', function (event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      var action = SHORTCUTS.get(event.key.toLowerCase());
      if (!action) return;
      event.preventDefault();
      action();
    });

    // Puts the snippet on its own paragraph at the caret.
    function insertBlock(snippet) {
      var start = textarea.selectionStart, before = textarea.value.slice(0, start);
      var lead = !before || /\n\n$/.test(before) ? '' : (/\n$/.test(before) ? '\n' : '\n\n');
      replaceRange(lead + snippet + '\n\n', start, textarea.selectionEnd);
      if (mode !== 'write') renderPreview();
    }
    function insertImages(files, isPasted) {
      var checked = checkImages(files, MAX_SOURCE_IMAGE_BYTES, '超過 ' + MAX_SOURCE_IMAGE_MB + ' MB，請先縮小');
      if (!checked.accepted.length) { if (checked.problems.length) toast(checked.problems.join('；') + '。', true); return; }
      toast('處理 ' + checked.accepted.length + ' 張圖片中…');
      Promise.all(checked.accepted.map(compressImage)).then(function (prepared) {
        var final = checkImages(prepared, MAX_IMAGE_BYTES, '縮小後仍超過 ' + MAX_IMAGE_MB + ' MB，請先壓縮');
        var problems = checked.problems.concat(final.problems);
        if (final.accepted.length) {
          insertBlock(final.accepted.map(function (file) {
            var path = newImagePath(IMAGE_EXTENSIONS.get(file.type));
            pendingImages.set(path, { file: file, objectUrl: URL.createObjectURL(file), isUploaded: false });
            return '![' + imageAlt(file, isPasted) + '](' + path + ')';
          }).join('\n\n'));
        }
        if (problems.length) toast(problems.join('；') + '。', true);
        else toast('已插入 ' + final.accepted.length + ' 張圖片，儲存文章時會一起上傳。');
      });
    }

    textarea.addEventListener('dragover', function (event) {
      if (!hasDraggedFiles(event)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; node.classList.add('dropping');
    });
    textarea.addEventListener('dragleave', function () { node.classList.remove('dropping'); });
    textarea.addEventListener('drop', function (event) {
      node.classList.remove('dropping');
      if (!hasDraggedFiles(event)) return;
      event.preventDefault(); textarea.focus();
      insertImages(Array.from(event.dataTransfer.files), false);
    });
    // Spreadsheet and office copies carry text plus a picture of it; the text is what the author meant to paste.
    textarea.addEventListener('paste', function (event) {
      var clipboard = event.clipboardData;
      if (!clipboard || clipboard.getData('text/plain')) return;
      var images = Array.from(clipboard.files).filter(function (file) { return file.type.indexOf('image/') === 0; });
      if (!images.length) return;
      event.preventDefault(); insertImages(images, true);
    });

    function waitingImagePaths(markdown) {
      return Array.from(pendingImages.keys()).filter(function (path) {
        return !pendingImages.get(path).isUploaded && markdown.indexOf(path) !== -1;
      });
    }
    // Uploads the not-yet-uploaded images the Markdown still references, one commit at a time:
    // parallel commits to one branch make GitHub reject all but the first.
    function uploadImages(markdown, onProgress) {
      var waiting = waitingImagePaths(markdown);
      return waiting.reduce(function (chain, path, index) {
        return chain.then(function () {
          var image = pendingImages.get(path);
          onProgress(index + 1, waiting.length);
          return readImageBase64(image.file)
            .then(function (base64) { return putContent(path, base64, null, commitMsg('add image ' + path)); })
            .then(function () { pendingImages.set(path, Object.assign({}, image, { isUploaded: true })); });
        });
      }, Promise.resolve());
    }
    function dispose() {
      clearTimeout(previewTimer);
      app.classList.remove('wide');
      pendingImages.forEach(function (image) { URL.revokeObjectURL(image.objectUrl); });
    }

    return { node: node, textarea: textarea, showWrite: function () { setMode('write'); }, uploadImages: uploadImages,
      pendingImageCount: function () { return waitingImagePaths(textarea.value).length; }, dispose: dispose };
  }

  /* ---------- posts: autosave ---------- */
  // Per-browser safety net while writing. Storage can be blocked; then the editor simply works without it.
  function autosaveStore(key) {
    var storageKey = AUTOSAVE_PREFIX + key;
    return {
      read: function () {
        try { var raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : null; }
        catch (storageError) { console.warn('Autosave unreadable, ignoring it:', storageError.name); return null; }
      },
      write: function (snapshot) {
        try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); }
        catch (storageError) { console.warn('Autosave not written:', storageError.name); }
      },
      clear: function () {
        try { localStorage.removeItem(storageKey); }
        catch (storageError) { console.warn('Autosave not cleared:', storageError.name); }
      }
    };
  }
  function sameFields(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function formatSavedAt(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + twoDigits(d.getHours()) + ':' + twoDigits(d.getMinutes());
  }
  function restoreBanner(snapshot, onRestore, onDiscard) {
    var banner = el('div', { class: 'restore', role: 'status' });
    var lostImages = snapshot.pendingImages ? '還沒上傳的 ' + snapshot.pendingImages + ' 張圖片需要重新插入。' : '';
    banner.append(
      el('p', { text: '有 ' + formatSavedAt(snapshot.savedAt) + ' 自動暫存、還沒儲存的內容。' + lostImages }),
      el('div', { class: 'acts' }, [
        el('button', { type: 'button', class: 'btn btn-solid', text: '還原', onclick: function () { banner.remove(); onRestore(); } }),
        el('button', { type: 'button', class: 'btn btn-line', text: '捨棄', onclick: function () { banner.remove(); onDiscard(); } })
      ]));
    return banner;
  }

  /* ---------- posts: fields ---------- */
  // Every input of the post form except the body. read()/apply() move the values in and out as one plain object.
  function postFields(p) {
    var isNew = !p;
    var inputs = {
      slug: el('input', { type: 'text', value: p ? p.slug : '', readonly: !isNew, spellcheck: 'false', autocomplete: 'off' }),
      cat: el('select', {}, CATS.map(function (c) { return el('option', { value: c[0], text: c[1] }); })),
      date: el('input', { type: 'date', value: p ? p.date : today() }),
      titleZh: el('input', { type: 'text', value: p ? p.title.zh : '' }),
      titleEn: el('input', { type: 'text', value: p ? (p.title.en || '') : '' }),
      excerptZh: el('textarea', { rows: '2', value: p ? (p.excerpt.zh || '') : '' }),
      excerptEn: el('textarea', { rows: '2', value: p ? (p.excerpt.en || '') : '' }),
      game: el('select', {}, [el('option', { value: '', text: '（無）' })].concat(state.games.map(function (g) {
        return el('option', { value: g.id, text: (g.name && (g.name.zh || g.name.en)) || g.id });
      }))),
      draft: el('input', { type: 'checkbox', checked: Boolean(p && p.draft) })
    };
    inputs.cat.value = p ? p.cat : 'game';
    inputs.game.value = (p && p.game) || '';
    var node = el('div', { class: 'stack' }, [
      el('div', { class: 'grid2' }, [field('中文標題', inputs.titleZh), field('英文標題', inputs.titleEn, '可留空，英文版會改用中文標題')]),
      el('div', { class: 'grid2' }, [field('中文摘要', inputs.excerptZh, '列表上的一句話介紹，也是分享預覽的說明'), field('英文摘要', inputs.excerptEn)]),
      el('div', { class: 'grid2' }, [field('分類', inputs.cat), field('日期', inputs.date)]),
      el('div', { class: 'grid2' }, [
        field('網址代稱', inputs.slug, isNew ? '文章網址會是 ggrst.io/posts/這個值/，建立後不能改' : '建立後不能修改'),
        field('相關遊戲', inputs.game, '文章頁會顯示這款遊戲的存檔，存檔卡也會列出這篇')
      ]),
      el('label', { class: 'chk' }, [inputs.draft, el('span', {}, ['設為草稿', el('span', { class: 'hint', text: '　網站上不顯示。注意：.md 檔仍在公開的 GitHub repo 裡' })])])
    ]);
    function read() {
      return Object.fromEntries(Object.keys(inputs).map(function (key) {
        var input = inputs[key];
        return [key, input.type === 'checkbox' ? input.checked : input.value];
      }));
    }
    function apply(values) {
      Object.keys(inputs).forEach(function (key) {
        if (!(key in values) || (key === 'slug' && !isNew)) return;
        if (inputs[key].type === 'checkbox') inputs[key].checked = Boolean(values[key]);
        else inputs[key].value = values[key];
      });
    }
    return { node: node, inputs: inputs, read: read, apply: apply };
  }

  function postMetaFrom(values, slug) {
    var meta = { slug: slug, cat: values.cat, date: values.date || today(),
      title: { zh: values.titleZh.trim(), en: values.titleEn.trim() }, excerpt: { zh: values.excerptZh.trim(), en: values.excerptEn.trim() } };
    return Object.assign(meta, values.game ? { game: values.game } : {}, values.draft ? { draft: true } : {});
  }

  /* ---------- posts ---------- */
  function editPost(p) {
    var isNew = !p;
    var fields = postFields(p), inputs = fields.inputs;
    var bodyEditor = postBodyEditor();
    var body = bodyEditor.textarea;
    var autosave = autosaveStore(isNew ? 'new' : p.slug);
    var autosaveTimer = null, isClosed = false;
    var err = el('p', { class: 'err', role: 'alert' });
    var save = el('button', { type: 'submit', class: 'btn btn-solid' });
    var bodySha = null;
    var notice = el('div', {});

    function saveLabel() { return isNew ? (inputs.draft.checked ? '儲存草稿' : '發佈文章') : '儲存變更'; }
    function snapshotValues() { return Object.assign(fields.read(), { body: body.value }); }
    // A focused field fires one last change event as the form is removed; isClosed keeps it from re-saving.
    function scheduleAutosave() {
      if (isClosed) return;
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function () {
        autosave.write({ savedAt: new Date().toISOString(), values: snapshotValues(), pendingImages: bodyEditor.pendingImageCount() });
      }, AUTOSAVE_DELAY_MS);
    }
    function leaveEditor() { isClosed = true; clearTimeout(autosaveTimer); bodyEditor.dispose(); }
    function offerRestore() {
      var snapshot = autosave.read();
      if (!snapshot || !snapshot.values || sameFields(snapshot.values, snapshotValues())) return;
      notice.replaceChildren(restoreBanner(snapshot, function () {
        fields.apply(snapshot.values); body.value = snapshot.values.body || ''; save.textContent = saveLabel(); setDirty(true);
      }, autosave.clear));
    }
    function onChange() { setDirty(true); save.textContent = saveLabel(); scheduleAutosave(); }

    function submit(e) {
      e.preventDefault(); if (state.busy) return;
      err.textContent = ''; [inputs.slug, inputs.titleZh, body].forEach(function (n) { n.removeAttribute('aria-invalid'); });
      var values = fields.read(), s = values.slug.trim().toLowerCase();
      var bad = function (n, m) { err.textContent = m; n.setAttribute('aria-invalid', 'true'); n.focus(); };
      if (!SLUG_PATTERN.test(s)) return bad(inputs.slug, '網址代稱只能用小寫英文、數字和連字號，例如 botw-first-week。');
      if (isNew && state.posts.some(function (x) { return x.slug === s; })) return bad(inputs.slug, '已經有文章用了「' + s + '」，請換一個網址代稱。');
      if (!values.titleZh.trim()) return bad(inputs.titleZh, '請填中文標題。');
      if (!body.value.trim()) { bodyEditor.showWrite(); return bad(body, '內文是空的，請先寫點內容。'); }
      var meta = postMetaFrom(values, s);
      var next = state.posts.filter(function (x) { return x.slug !== s; }).concat([meta]);
      var markdown = body.value.replace(/\r\n/g, '\n');
      busy(save, true);
      bodyEditor.uploadImages(markdown, function (done, total) { save.textContent = '上傳圖片 ' + done + '/' + total + '…'; })
        .then(function () { save.textContent = '儲存中…'; return putFile('posts/' + s + '.md', markdown, bodySha, commitMsg((isNew ? 'add' : 'update') + ' post ' + s)); })
        .then(function (sha) { bodySha = sha; return putFile('data/posts.json', JSON.stringify(next, null, 2) + '\n', state.postsSha, commitMsg('update post index for ' + s)); })
        .then(function (sha) {
          state.posts = next; state.postsSha = sha; setDirty(false); busy(save, false);
          leaveEditor(); autosave.clear();
          if (meta.draft) toast('已存成草稿，網站上不會顯示。');
          else saved(['看文章', '../posts/' + encodeURIComponent(s) + '/']);
          renderList();
        })
        .catch(function (e) { busy(save, false); onFail(e); });
    }

    var form = el('form', { class: 'panel stack', oninput: onChange, onchange: onChange, onsubmit: submit }, [
      notice,
      fields.node,
      bodyEditor.node,
      err,
      el('div', { class: 'acts' }, [save, el('button', { type: 'button', class: 'btn btn-line', text: '取消', onclick: function () {
        if (!leaveOk()) return;
        setDirty(false); leaveEditor(); autosave.clear(); renderList();
      } })])
    ]);
    save.textContent = saveLabel();
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'stack' }, [el('h1', { text: isNew ? '新增文章' : '編輯文章' }), form]));
    if (isNew) { offerRestore(); inputs.titleZh.focus(); return; }
    body.disabled = true; body.value = '讀取內文中…'; save.disabled = true;
    getFile('posts/' + p.slug + '.md').then(function (f) { body.value = f.text; bodySha = f.sha; })
      .catch(function (e) { body.value = ''; if (!(e && e.status === 404)) toast(explain(e), true); })
      .then(function () { body.disabled = false; save.disabled = false; offerRestore(); body.focus(); });
  }

  function deletePost(p, btn) {
    busy(btn, true, '刪除中…');
    var next = state.posts.filter(function (x) { return x.slug !== p.slug; });
    putFile('data/posts.json', JSON.stringify(next, null, 2) + '\n', state.postsSha, commitMsg('remove post ' + p.slug + ' from index'))
      .then(function (sha) {
        state.posts = next; state.postsSha = sha;
        return getFile('posts/' + p.slug + '.md').then(function (f) { return delFile('posts/' + p.slug + '.md', f.sha, commitMsg('delete post ' + p.slug)); })
          .catch(function (e) { if (!(e && e.status === 404)) throw e; });
      })
      .then(function () { busy(btn, false); toast('已刪除「' + ((p.title && p.title.zh) || p.slug) + '」。'); renderList(); })
      .catch(function (e) { busy(btn, false); onFail(e); renderList(); });
  }

  /* ---------- games ---------- */
  function publicGamesText(games) {
    return JSON.stringify(games.filter(function (g) { return g.public; }), null, 2) + '\n';
  }
  // Writes the public copy only when the public subset changed, so editing a private save leaves
  // no commit in the public repo. The commit message names no game for the same reason.
  function syncPublicGames(games) {
    var nextText = publicGamesText(games);
    if (nextText === state.publicGamesText) return Promise.resolve(false);
    return putFile(PUBLIC_GAMES_FILE, nextText, state.publicGamesSha, commitMsg('update public game saves')).then(function (sha) {
      state.publicGamesText = nextText; state.publicGamesSha = sha;
      return true;
    });
  }
  function saveGames(next, btn, msg) {
    busy(btn, true);
    return putFile(SAVES_FILE, JSON.stringify(next, null, 2) + '\n', state.gamesSha, commitMsg(msg), SAVES_REPO)
      .then(function (sha) {
        state.games = next; state.gamesSha = sha; setDirty(false);
        return syncPublicGames(next).catch(function (e) {
          console.error('Public saves not updated:', e);
          var error = new Error('Public saves not updated');
          error.status = e && e.status;
          error.userMessage = '存檔已儲存，但網站上的公開版本沒有更新（' + explain(e) + '）。再按一次儲存會重試。';
          throw error;
        });
      })
      .then(function (isPublicChanged) {
        busy(btn, false);
        if (isPublicChanged) saved(); else toast('已儲存。這個變更只有你看得到。');
        renderList();
      })
      .catch(function (e) { busy(btn, false); onFail(e); });
  }
  function deleteGame(i, btn) {
    var g = state.games[i], next = state.games.filter(function (_, k) { return k !== i; });
    saveGames(next, btn, 'delete game ' + g.id);
  }

  function removeRowButton(label, row) {
    return el('button', { type: 'button', class: 'x', 'aria-label': label, text: '×', onclick: function () { row.remove(); setDirty(true); } });
  }

  // Each editor returns { node, add?, read } so editGame only assembles and validates.
  function milestoneEditor(milestones) {
    var rows = el('div', { class: 'rows' });
    function add(milestone) {
      var done = el('input', { type: 'checkbox', checked: milestone.done });
      var zh = el('input', { type: 'text', value: milestone.zh || '', 'aria-label': '里程碑中文' });
      var en = el('input', { type: 'text', value: milestone.en || '', 'aria-label': '里程碑英文' });
      var row = el('div', { class: 'row ms' }, [el('label', { class: 'chk' }, [done, el('span', { class: 'sr', text: '完成' })]), zh, en]);
      row.appendChild(removeRowButton('移除這個里程碑', row));
      row.readValue = function () { return { zh: zh.value.trim(), en: en.value.trim(), done: done.checked }; };
      rows.appendChild(row);
      return zh;
    }
    milestones.forEach(add);
    return {
      node: rows, add: add,
      read: function () {
        return Array.prototype.map.call(rows.children, function (row) { return row.readValue(); })
          .filter(function (m) { return m.zh || m.en; });
      }
    };
  }

  function collectEditor(items) {
    var rows = el('div', { class: 'rows' });
    function add(item) {
      var zh = el('input', { type: 'text', value: item.zh || '', 'aria-label': '收集項目中文' });
      var en = el('input', { type: 'text', value: item.en || '', 'aria-label': '收集項目英文' });
      var got = el('input', { type: 'number', min: '0', inputmode: 'numeric', value: String(item.got || 0) });
      var max = el('input', { type: 'number', min: '1', inputmode: 'numeric', value: String(item.max || '') });
      var row = el('div', { class: 'row co' }, [zh, en,
        el('label', { class: 'f' }, [el('span', { class: 'sr nl', text: '已收集' }), got]),
        el('label', { class: 'f' }, [el('span', { class: 'sr nl', text: '總數' }), max])]);
      row.appendChild(removeRowButton('移除這個收集項目', row));
      row.readValue = function () {
        return { value: { zh: zh.value.trim(), en: en.value.trim(), got: parseInt(got.value, 10) || 0, max: parseInt(max.value, 10) || 0 },
          gotInput: got, maxInput: max };
      };
      rows.appendChild(row);
      return zh;
    }
    items.forEach(add);
    // Returns { items } or { error, input } for the first invalid row.
    function read() {
      var result = [];
      for (var k = 0; k < rows.children.length; k++) {
        var entry = rows.children[k].readValue(), item = entry.value, name = item.zh || item.en;
        if (!name) continue;
        if (item.max < 1) return { error: '「' + name + '」的總數要大於 0。', input: entry.maxInput };
        if (item.got > item.max) return { error: '「' + name + '」已收集 ' + item.got + '，超過總數 ' + item.max + '。', input: entry.gotInput };
        result.push(item);
      }
      return { items: result };
    }
    return { node: rows, add: add, read: read };
  }

  function towerEditor(towers) {
    var selects = {};
    var node = el('div', { class: 'towers' }, REGIONS.map(function (region) {
      var select = el('select', {}, TOWER_ST.map(function (label, level) { return el('option', { value: String(level), text: label }); }));
      select.value = String((towers && towers[region[0]]) || 0);
      selects[region[0]] = select;
      return field(region[1], select);
    }));
    return {
      node: node,
      read: function () {
        var out = {};
        Object.keys(selects).forEach(function (key) { var level = +selects[key].value; if (level) out[key] = level; });
        return out;
      }
    };
  }

  function editGame(i) {
    var isNew = i < 0;
    var g = isNew ? { id: '', name: { zh: '', en: '' }, platform: 'Switch', milestones: [], collect: [], note: { zh: '', en: '' } }
      : JSON.parse(JSON.stringify(state.games[i]));
    var nz = el('input', { type: 'text', value: g.name.zh }), ne = el('input', { type: 'text', value: g.name.en || '' });
    var plat = el('input', { type: 'text', value: g.platform || '', list: 'plats' });
    var plats = el('datalist', { id: 'plats' }, ['Switch', 'Switch 2', 'PC', 'PS5', 'Xbox', '手機'].map(function (x) { return el('option', { value: x }); }));
    var gid = el('input', { type: 'text', value: g.id, readonly: !isNew, spellcheck: 'false', autocomplete: 'off' });
    var noteZ = el('textarea', { rows: '3', value: (g.note && g.note.zh) || '' }), noteE = el('textarea', { rows: '3', value: (g.note && g.note.en) || '' });
    var isPublic = el('input', { type: 'checkbox', checked: Boolean(g.public) });
    var err = el('p', { class: 'err', role: 'alert' });
    var save = el('button', { type: 'submit', class: 'btn btn-solid', text: isNew ? '建立存檔' : '儲存變更' });
    var milestones = milestoneEditor(g.milestones || []);
    var collection = collectEditor(g.collect || []);
    var towers = g.map === 'botw' ? towerEditor(g.towers) : null;
    var form;

    function submit(ev) {
      ev.preventDefault(); if (state.busy) return;
      err.textContent = '';
      form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
      var bad = function (n, m) { err.textContent = m; n.setAttribute('aria-invalid', 'true'); n.focus(); };
      var id = gid.value.trim().toLowerCase();
      if (!nz.value.trim()) return bad(nz, '請填中文名稱。');
      if (!GAME_ID_PATTERN.test(id)) return bad(gid, '代號只能用小寫英文、數字和連字號，例如 totk。');
      if (isNew && state.games.some(function (x) { return x.id === id; })) return bad(gid, '已經有遊戲用了代號「' + id + '」。');
      var collected = collection.read();
      if (collected.error) return bad(collected.input, collected.error);
      var out = { id: id, name: { zh: nz.value.trim(), en: ne.value.trim() }, platform: plat.value.trim(),
        milestones: milestones.read(), collect: collected.items, note: { zh: noteZ.value.trim(), en: noteE.value.trim() } };
      if (g.map) { out.map = g.map; out.towers = towers ? towers.read() : {}; }
      if (isPublic.checked) out.public = true;
      var next = isNew ? state.games.concat([out]) : state.games.map(function (x, k) { return k === i ? out : x; });
      saveGames(next, save, (isNew ? 'add game ' : 'update game ') + id);
    }

    form = el('form', { class: 'panel stack', oninput: function () { setDirty(true); }, onchange: function () { setDirty(true); }, onsubmit: submit }, [
      el('div', { class: 'grid2' }, [field('中文名稱', nz), field('英文名稱', ne)]),
      el('div', { class: 'grid2' }, [field('平台', plat), field('代號', gid, isNew ? '網址用，例如 totk，建立後不能改' : '建立後不能修改')]), plats,
      el('fieldset', { class: 'stack' }, [el('legend', { text: '里程碑' }),
        el('p', { class: 'muted', style: 'margin:0', text: '勾選代表已完成。完成比例就是首頁顯示的百分比。' }),
        milestones.node,
        el('div', {}, [el('button', { type: 'button', class: 'btn btn-line', text: '新增里程碑', onclick: function () { milestones.add({}).focus(); setDirty(true); } })])]),
      el('fieldset', { class: 'stack' }, [el('legend', { text: '收集' }),
        el('div', { class: 'row-head', style: 'grid-template-columns:minmax(0,1fr) minmax(0,1fr) 96px 96px 44px' }, ['中文', '英文', '已收集', '總數', '']),
        collection.node,
        el('div', {}, [el('button', { type: 'button', class: 'btn btn-line', text: '新增收集項目', onclick: function () { collection.add({}).focus(); setDirty(true); } })])]),
      towers ? el('fieldset', { class: 'stack' }, [el('legend', { text: '海拉魯地圖塔區' }), towers.node]) : null,
      el('div', { class: 'grid2' }, [field('最近進度（中文）', noteZ, '顯示在首頁存檔上'), field('最近進度（英文）', noteE)]),
      el('label', { class: 'chk' }, [isPublic, el('span', {}, ['公開這個存檔', el('span', { class: 'hint', text: '　勾選後訪客也看得到；沒勾只有登入後台的你看得到' })])]),
      err,
      el('div', { class: 'acts' }, [save, el('button', { type: 'button', class: 'btn btn-line', text: '取消', onclick: function () { if (leaveOk()) { setDirty(false); renderList(); } } })])
    ]);
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'stack' }, [el('h1', { text: isNew ? '新增遊戲' : '編輯「' + (g.name.zh || g.id) + '」' }), form]));
    nz.focus();
  }

  /* ---------- boot ---------- */
  state.token = readToken();
  if (state.token) start(); else renderLogin();
})();
