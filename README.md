# ggrst.io

遊戲、程式、知識的個人部落格與遊戲進度紀錄，部署在 GitHub Pages：**[ggrst.io](https://ggrst.io)**

## 網站內容

| 區塊 | 說明 |
| --- | --- |
| 首頁 | 玩遊戲、寫程式、收集知識 |
| 遊戲進度 | 正在玩的遊戲、里程碑與收集數量，存在瀏覽器的本機儲存裡 |
| 最新文章 | 可依主題篩選的文章列表 |
| 關於我 | 自我介紹 |
| 聯絡 | 討論遊戲、程式或打招呼 |

網站支援 **中文／English** 切換（右上角按鈕）。

## 檔案結構

```
.
├── index.html   # 整個網站：HTML、CSS、JavaScript 都在這一個檔案
├── CNAME        # 自訂網域 ggrst.io
└── README.md
```

## 本機預覽

不需要建置工具，直接用瀏覽器打開 `index.html`，或啟動一個本機伺服器：

```bash
python -m http.server 8000
```

然後開啟 <http://localhost:8000>。

## 部署

推送到 `master` 分支後，GitHub Pages 會自動更新網站。

> [!NOTE]
> 遊戲進度只存在各自裝置的瀏覽器裡，換裝置或清除瀏覽器資料就會看不到。
