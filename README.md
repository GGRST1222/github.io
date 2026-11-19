# ggrst.io

遊戲、程式、知識的個人部落格與遊戲存檔紀錄，部署在 GitHub Pages：**[ggrst.io](https://ggrst.io)**

## 網站內容

| 區塊 | 說明 |
| --- | --- |
| 選擇存檔／最新日誌 | 首頁主視覺：有公開的遊戲存檔時顯示存檔，沒有時列出最新 3 篇文章 |
| 任務日誌 | 可依主題（遊戲／程式／知識）篩選的文章列表 |
| 遊戲存檔 | 公開的遊戲存檔：里程碑、收集、最近進度、相關日誌；曠野之息附塔區地圖 |
| 要繼續嗎？ | GitHub 連結 |

網站支援 **中文／English** 切換（右上角按鈕）。訪客只能閱讀，內容都從後台編輯。

### 遊戲存檔：逐款決定公開

完整的遊戲存檔放在**私人 repo** [`GGRST1222/ggrst-saves`](https://github.com/GGRST1222/ggrst-saves) 的 `games.json`。每款遊戲預設**只有自己看得到**；在後台編輯存檔時勾「公開這個存檔」，後台會把勾選的遊戲複製到這個 repo 的 `data/games-public.json`，訪客就看得到。

| 誰在看 | 看到的存檔 |
| --- | --- |
| 訪客 | 只有公開的遊戲；一款都沒公開時，首頁主視覺改列最新文章，遊戲區和導覽「遊戲」都不顯示 |
| 你（這台瀏覽器登入過後台） | 全部遊戲，沒公開的標「僅自己可見」 |

只改沒公開的遊戲時，公開 repo 不會有任何 commit；公開版本的 commit 訊息也不寫遊戲名稱。

> [!NOTE]
> 文章的「相關遊戲」欄位（`game: "botw"` 這類代號）仍在公開的 `data/posts.json` 裡；`data/games.json` 搬家前的內容也還留在這個 repo 的 git 歷史中。

## 後台

網址：**[ggrst.io/admin/](https://ggrst.io/admin/)**

用 GitHub token 登入後，可以新增、編輯、刪除文章和遊戲存檔。文章會 commit 到這個 repo，GitHub Pages 約 1 分鐘後更新；遊戲存檔 commit 到私人的 `GGRST1222/ggrst-saves`，存了就生效。

### 寫文章

- **預覽**：內文上方切「撰寫／預覽」，畫面和文章頁的排版一樣。螢幕寬度 1200px 以上還有「並排」，左邊寫、右邊即時預覽。
- **自動暫存**：寫到一半關掉分頁也不會不見，下次開啟同一篇會問要不要還原（存在這台瀏覽器裡，還沒上傳的圖片要重新插入）。
- **草稿**：勾「設為草稿」就不會出現在網站上；注意 `.md` 檔仍在公開的 GitHub repo 裡。
- **相關遊戲**：選一款遊戲，你登入時文章頁會顯示它的存檔進度，存檔卡也會列出這篇（訪客看不到）。
- **快捷鍵**：Ctrl+B 粗體、Ctrl+I 斜體、Ctrl+K 連結。
- **圖片**：拖曳到內文、直接貼上截圖，或按「插入圖片」。支援 PNG、JPEG、GIF、WebP。超過 1600px 或 500 KB 的照片會在瀏覽器裡自動縮小並轉成 WebP（原圖最大 25 MB，GIF 不轉以保留動畫），上傳的檔案每張最多 5 MB。圖片先留在瀏覽器裡，按儲存時才上傳到 `images/<年>/<月>/`；沒用到的圖片不會上傳。
- **程式碼上色**：程式碼區塊開頭的 ```` ``` ```` 後寫上語言，例如 ```` ```js ````、```` ```python ````、```` ```csharp ````、```` ```powershell ````。沒寫語言或不認得的語言會顯示成純文字。

### 取得 token

1. 打開 [GitHub 新增 fine-grained token](https://github.com/settings/personal-access-tokens/new)
2. Repository access 選 **Only select repositories**，勾 `GGRST1222/github.io` 和 `GGRST1222/ggrst-saves`
3. Repository permissions → **Contents** 設為 **Read and write**
4. 產生後貼到後台登入畫面

> [!WARNING]
> Token 等同這兩個 repo 的寫入權限，也是看遊戲存檔的鑰匙。只在自己的裝置勾「記住我」，外洩時到 GitHub 設定頁撤銷即可。

## 檔案結構

```
.
├── index.html        # 首頁
├── post.html         # 文章頁（post.html?p=<網址代稱>，Markdown 轉 HTML）
├── admin/
│   ├── index.html    # 後台
│   └── admin.js
├── data/
│   └── posts.json    # 文章列表（標題、摘要、分類、日期）
├── posts/            # 文章內文，每篇一個 <網址代稱>.md
├── images/           # 文章圖片，後台上傳時自動建立（images/<年>/<月>/）
├── assets/
│   ├── site.css      # 共用色彩與樣式（含程式碼上色的顏色）
│   ├── prose.css     # 文章內文樣式，文章頁和後台預覽共用
│   ├── site-data.js  # 首頁和文章頁共用：文章網址、草稿過濾、遊戲完成度、登入後讀私人存檔
│   ├── markdown.js   # Markdown → HTML（marked → DOMPurify → highlight.js），文章頁和後台預覽共用
│   ├── vendor/       # 自己放的第三方檔：marked 12.0.2、DOMPurify 3.1.6、highlight.js 11.9.0（含 PowerShell）
│   └── favicon.svg
├── scripts/build.mjs  # 建置：文章頁、RSS、sitemap → _site/
├── .github/workflows/pages.yml  # push 後自動建置並部署
├── robots.txt
├── CNAME             # 自訂網域 ggrst.io
└── README.md
```

也可以直接改 `data/posts.json` 或 `posts/*.md` 再 push，效果和後台一樣；遊戲存檔則是改私人 repo 的 `games.json`。

## 本機預覽

網站用 `fetch` 讀取 `data/`，需要透過本機伺服器開啟（直接雙擊 `index.html` 會讀不到資料）：

```bash
node scripts/build.mjs
python -m http.server 8000 --directory _site
```

然後開啟 <http://localhost:8000>。文章網址 `/posts/<網址代稱>/` 是建置產生的，所以要先跑 `build.mjs`，並從 `_site/` 開伺服器。

## 文章頁

每篇文章的網址是 `ggrst.io/posts/<網址代稱>/`，有自己的標題和分享預覽（摘要、第一張圖）。文章頁有目錄（3 個以上小標時）、小標錨點、程式碼複製按鈕、點圖放大、上一篇／下一篇，以及（只有你登入時）相關遊戲的存檔卡。舊網址 `post.html?p=<網址代稱>` 仍然可用。

另外有 RSS（`/feed.xml`）和 sitemap（`/sitemap.xml`）。

## 部署

推送到 `master` 後，GitHub Actions（`.github/workflows/pages.yml`）會執行 `node scripts/build.mjs` 把網站建到 `_site/`，再部署到 GitHub Pages，約 1 分鐘。Settings → Pages → Source 必須設為 **GitHub Actions**。

建置會為每篇非草稿文章產生 `posts/<網址代稱>/index.html`，並產生 `feed.xml`、`sitemap.xml`。只用 Node 內建模組，不需要 `npm install`。
