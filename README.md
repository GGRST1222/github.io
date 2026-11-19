# ggrst.io

遊戲、程式、知識的個人部落格與遊戲存檔紀錄，部署在 GitHub Pages：**[ggrst.io](https://ggrst.io)**

## 網站內容

| 區塊 | 說明 |
| --- | --- |
| 選擇存檔 | 首頁主視覺，顯示每款遊戲的完成比例 |
| 任務日誌 | 可依主題（遊戲／程式／知識）篩選的文章列表 |
| 遊戲存檔 | 每款遊戲的里程碑、收集數量、最近進度；曠野之息附塔區地圖 |
| 要繼續嗎？ | GitHub 連結 |

網站支援 **中文／English** 切換（右上角按鈕）。訪客只能閱讀，內容都從後台編輯。

## 後台

網址：**[ggrst.io/admin/](https://ggrst.io/admin/)**

用 GitHub token 登入後，可以新增、編輯、刪除文章和遊戲存檔。每次儲存都會直接 commit 到這個 repo，GitHub Pages 約 1 分鐘後更新。

### 寫文章

- **預覽**：內文上方切到「預覽」，畫面和文章頁的排版一樣。
- **圖片**：拖曳到內文、直接貼上截圖，或按「插入圖片」。支援 PNG、JPEG、GIF、WebP，每張最多 5 MB。圖片先留在瀏覽器裡，按儲存時才上傳到 `images/<年>/<月>/`；沒用到的圖片不會上傳。
- **程式碼上色**：程式碼區塊開頭的 ```` ``` ```` 後寫上語言，例如 ```` ```js ````、```` ```python ````、```` ```csharp ````、```` ```powershell ````。沒寫語言或不認得的語言會顯示成純文字。

### 取得 token

1. 打開 [GitHub 新增 fine-grained token](https://github.com/settings/personal-access-tokens/new)
2. Repository access 選 **Only select repositories**，只勾 `GGRST1222/github.io`
3. Repository permissions → **Contents** 設為 **Read and write**
4. 產生後貼到後台登入畫面

> [!WARNING]
> Token 等同這個 repo 的寫入權限。只在自己的裝置勾「記住我」，外洩時到 GitHub 設定頁撤銷即可。

## 檔案結構

```
.
├── index.html        # 首頁
├── post.html         # 文章頁（post.html?p=<網址代稱>，Markdown 轉 HTML）
├── admin/
│   ├── index.html    # 後台
│   └── admin.js
├── data/
│   ├── games.json    # 遊戲存檔
│   └── posts.json    # 文章列表（標題、摘要、分類、日期）
├── posts/            # 文章內文，每篇一個 <網址代稱>.md
├── images/           # 文章圖片，後台上傳時自動建立（images/<年>/<月>/）
├── assets/
│   ├── site.css      # 共用色彩與樣式（含程式碼上色的顏色）
│   ├── prose.css     # 文章內文樣式，文章頁和後台預覽共用
│   ├── markdown.js   # Markdown → HTML（marked → DOMPurify → highlight.js），文章頁和後台預覽共用
│   ├── vendor/       # 自己放的第三方檔：marked 12.0.2、DOMPurify 3.1.6、highlight.js 11.9.0（含 PowerShell）
│   └── favicon.svg
├── CNAME             # 自訂網域 ggrst.io
└── README.md
```

也可以直接改 `data/*.json` 或 `posts/*.md` 再 push，效果和後台一樣。

## 本機預覽

網站用 `fetch` 讀取 `data/`，需要透過本機伺服器開啟（直接雙擊 `index.html` 會讀不到資料）：

```bash
python -m http.server 8000
```

然後開啟 <http://localhost:8000>。

## 部署

推送到 `master` 分支後，GitHub Pages 會自動更新網站。
