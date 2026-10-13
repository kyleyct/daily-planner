# 每日計劃 / Daily Planner

個人每日計劃網頁：目標、時間表、番茄鐘、事件倒數、想做的事、早晚習慣推送提醒。  
Personal daily planner: goals, schedule, pomodoro, event countdown, wish list, morning/evening habit Web Push.

**線上版 / Live:** https://kyleyct.github.io/daily-planner/

## 資料說明 / Data

- **目標、時間表、檢討、番茄鐘等** 存在瀏覽器 `localStorage`（key：`kylePlanner.v1`），**不會**上傳到 GitHub。
- Goals and reviews stay in the browser. Nothing goal-related is uploaded.
- 若開啟 **推送提醒**，只會把 **推送訂閱端點 + 早上／晚上時間開關** 同步到 Cloudflare Worker（KV）。伺服器**沒有**你的目標內容。
- 清瀏覽器資料、換裝置、私密模式可能遺失本機資料 → 請定期在「設定／備份」**匯出 JSON**。

## 習慣提醒（Web Push）

早上「訂今日目標」、晚上「今晚檢討」。文案強調：**習慣與計劃／檢討，比完成多少更重要。**

### 如何開啟（步驟）

1. 打開 https://kyleyct.github.io/daily-planner/  
2. **（建議）安裝成 PWA**  
   - Android / Desktop Chrome：選單 →「安裝應用程式」或「加到主畫面」  
   - **iOS Safari：** 分享 →「加入主畫面」（必須用主畫面圖示開啟，推送才較可靠）  
3. 點右上角 **設定／備份**  
4. 在「習慣提醒（推送）」設定早上／晚上時間，並勾選要開的時段（預設 08:00、21:00，香港時間）  
5. 按 **開啟推送提醒**，允許瀏覽器通知  
6. 狀態顯示「已開啟推送提醒」即可。之後改時間會自動同步到 Worker。

關 Tab 後，Cloudflare Worker 的 Cron（約每 5 分鐘）會在對應時段送出推送；點通知會打開 App 並切到目標或檢討頁。

### 限制

- **iOS：** 需加入主畫面；系統版本需支援 Web Push（Safari 16.4+）。未安裝時設定會提示「需安裝到主畫面」。  
- 必須允許通知權限；拒絕後要到系統／瀏覽器設定改回來。  
- 依賴 Cloudflare Worker + KV；免費方案 Cron 為每 5 分鐘一檔，提醒時間會對齊到約 5 分鐘視窗。  
- 若 `PUSH_API` 尚未指向已部署的 Worker，設定會顯示「推送後端尚未設定」。

## 安裝 PWA / Install

1. 用 Chrome / Edge / Safari 打開上面的 Pages URL。  
2. Android / Desktop：選單 →「安裝應用程式」或「加到主畫面」。  
3. iOS Safari：分享 →「加入主畫面」。  
4. 安裝後可離線打開靜態頁面；**習慣推送**需已開啟並由 Worker 送出（番茄鐘結束通知仍偏向分頁／App 開著時較準）。

## 本機開啟 / Local

```bash
python3 -m http.server 8080 --directory .
# then open http://localhost:8080/
```

`file://` 亦可看 UI；Service Worker／推送只在 `http(s)` 下可用。

## Cloudflare Worker（推送後端）

程式在 `worker/`。詳見 [`worker/README.md`](worker/README.md)。

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create SUBS   # 把 id 填進 wrangler.toml
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler deploy
# 把印出的 *.workers.dev URL 寫進 ../index.html 的 PUSH_API，再 commit / push
```

## 檔案 / Files

| File | Purpose |
|------|---------|
| `index.html` | App UI + logic（含設定裡的推送） |
| `manifest.webmanifest` | PWA manifest |
| `sw.js` | Cache-first SW + `push` / `notificationclick` |
| `icons/` | 192 / 512 / apple-touch / favicon |
| `worker/` | Cloudflare Worker（訂閱、排程、Cron 推送） |

## 授權 / License

Personal use. Source on GitHub for Kyle.
