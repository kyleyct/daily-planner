# 每日計劃 / Daily Planner

個人每日計劃網頁：目標、時間表、番茄鐘、事件倒數、想做的事。  
Personal daily planner: goals, schedule, pomodoro, event countdown, wish list.

**線上版 / Live:** https://kyleyct.github.io/daily-planner/

## 資料說明 / Data

- 所有資料存在瀏覽器 `localStorage`（key：`kylePlanner.v1`），**不會**上傳到 GitHub 或任何伺服器。
- All data stays in the browser (`localStorage`). Nothing is uploaded.
- 清瀏覽器資料、換裝置、私密模式可能遺失資料 → 請定期在「設定／備份」**匯出 JSON**，需要時再匯入。
- Clearing site data, switching devices, or private browsing can wipe data — export a JSON backup regularly from Settings.

## 安裝 PWA / Install

1. 用 Chrome / Edge / Safari 打開上面的 Pages URL。  
2. **Android / Desktop Chrome：** 選單 →「安裝應用程式」或「加到主畫面」。  
3. **iOS Safari：** 分享 →「加入主畫面」（需用 Safari；主畫面圖示才能較完整地當 App 用）。  
4. 安裝後可離線打開靜態頁面；番茄鐘結束通知仍需分頁／App 開著（本版**沒有**關 Tab 仍推播的 Web Push）。

## 本機開啟 / Local

直接打開 `index.html`（`file://`）亦可使用；Service Worker 只在 `http(s)` 下註冊，本機檔案模式會自動略過。

```bash
# optional local server
python3 -m http.server 8080 --directory .
# then open http://localhost:8080/
```

## 檔案 / Files

| File | Purpose |
|------|---------|
| `index.html` | App UI + logic |
| `manifest.webmanifest` | PWA manifest |
| `sw.js` | Cache-first service worker（無 push） |
| `icons/` | 192 / 512 / apple-touch / favicon |

## 授權 / License

Personal use. Source on GitHub for Kyle.
