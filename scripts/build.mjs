// Builds the deployable site into _site/: copies the static files, then adds one page per published post
// (/posts/<slug>/index.html with its own title and share preview), feed.xml and sitemap.xml.
// Run: node scripts/build.mjs   (no dependencies; GitHub Actions runs it on every push to master)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
const COPIED = ['index.html', 'post.html', 'robots.txt', 'CNAME', 'admin', 'assets', 'data', 'posts', 'images'];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/;
const DESCRIPTION_LENGTH = 150;
const FEED_LENGTH = 20;
const TIME_ZONE_OFFSET = '+08:00'; // post dates are Taiwan calendar days

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const SITE_URL = 'https://' + read('CNAME').trim();
const CATEGORY_LABELS = new Map([['game', '遊戲'], ['code', '程式'], ['know', '知識']]);

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function replaceOnce(html, search, replacement) {
  const parts = html.split(search);
  if (parts.length !== 2) throw new Error(`post.html template: expected "${search}" exactly once, found ${parts.length - 1}`);
  return parts.join(replacement);
}

// Plain-text summary for posts without a written excerpt: drop code, images, link targets and Markdown marks.
function summarize(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>|~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > DESCRIPTION_LENGTH ? text.slice(0, DESCRIPTION_LENGTH - 1) + '…' : text;
}

function firstImageUrl(markdown) {
  const match = /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(markdown);
  if (!match) return null;
  try { return new URL(match[1], SITE_URL + '/').href; } catch { return null; } // malformed image URL: no preview image
}

const postUrl = (slug) => `${SITE_URL}/posts/${encodeURIComponent(slug)}/`;
const titleOf = (post) => post.title?.zh || post.title?.en || post.slug;

function loadPosts() {
  const index = JSON.parse(read('data/posts.json'));
  return index
    .filter((post) => !post.draft)
    .filter((post) => {
      if (SLUG_PATTERN.test(post.slug) && existsSync(join(ROOT, 'posts', post.slug + '.md'))) return true;
      console.warn(`::warning::Skipping post "${post.slug}": bad slug or missing posts/${post.slug}.md`);
      return false;
    })
    .map((post) => {
      const markdown = read(`posts/${post.slug}.md`);
      return { ...post, description: post.excerpt?.zh || summarize(markdown), image: firstImageUrl(markdown) };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function headTags(post) {
  const url = postUrl(post.slug);
  const tags = [
    `<title>${escapeHtml(titleOf(post))} · ggrst.io</title>`,
    `<meta name="description" content="${escapeHtml(post.description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="ggrst.io">',
    '<meta property="og:locale" content="zh_TW">',
    `<meta property="og:title" content="${escapeHtml(titleOf(post))}">`,
    `<meta property="og:description" content="${escapeHtml(post.description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    post.date ? `<meta property="article:published_time" content="${escapeHtml(post.date)}">` : null,
    post.image ? `<meta property="og:image" content="${escapeHtml(post.image)}">` : null,
    `<meta name="twitter:card" content="${post.image ? 'summary_large_image' : 'summary'}">`
  ];
  return tags.filter(Boolean).join('\n');
}

// The static header and description show at once, and stay for readers and crawlers without JavaScript;
// post.js replaces them with the rendered post.
function postPage(template, post) {
  let html = replaceOnce(template, '<title>文章 · ggrst.io</title>', headTags(post));
  html = replaceOnce(html, '<body>', `<body data-slug="${escapeHtml(post.slug)}">`);
  return replaceOnce(html, '<div id="out" aria-live="polite"><p class="msg">讀取文章中…</p></div>',
    '<div id="out" aria-live="polite"><header class="post-head"><div class="post-meta">' +
    `<time class="num" datetime="${escapeHtml(post.date || '')}">${escapeHtml(post.date || '')}</time></div>` +
    `<h1>${escapeHtml(titleOf(post))}</h1></header><p class="msg">${escapeHtml(post.description)}</p></div>`);
}

function feedXml(posts) {
  const items = posts.slice(0, FEED_LENGTH).map((post) => [
    '<item>',
    `<title>${escapeHtml(titleOf(post))}</title>`,
    `<link>${escapeHtml(postUrl(post.slug))}</link>`,
    `<guid isPermaLink="true">${escapeHtml(postUrl(post.slug))}</guid>`,
    post.date ? `<pubDate>${new Date(post.date + 'T00:00:00' + TIME_ZONE_OFFSET).toUTCString()}</pubDate>` : '',
    CATEGORY_LABELS.has(post.cat) ? `<category>${CATEGORY_LABELS.get(post.cat)}</category>` : '',
    `<description>${escapeHtml(post.description)}</description>`,
    '</item>'
  ].join('')).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n' +
    `<title>ggrst.io</title><link>${SITE_URL}/</link><description>遊戲、程式、知識的部落格與遊戲存檔紀錄</description><language>zh-Hant</language>\n` +
    `<atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>\n${items}\n</channel></rss>\n`;
}

function sitemapXml(posts) {
  const urls = [`<url><loc>${SITE_URL}/</loc></url>`].concat(posts.map((post) =>
    `<url><loc>${escapeHtml(postUrl(post.slug))}</loc>${post.date ? `<lastmod>${escapeHtml(post.date)}</lastmod>` : ''}</url>`));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT);
  COPIED.filter((path) => existsSync(join(ROOT, path)))
    .forEach((path) => cpSync(join(ROOT, path), join(OUT, path), { recursive: true }));

  const template = read('post.html');
  const posts = loadPosts();
  posts.forEach((post) => {
    const dir = join(OUT, 'posts', post.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), postPage(template, post));
  });
  writeFileSync(join(OUT, 'feed.xml'), feedXml(posts));
  writeFileSync(join(OUT, 'sitemap.xml'), sitemapXml(posts));
  console.log(`Built ${posts.length} post page(s), feed.xml and sitemap.xml into _site/`);
}

build();
