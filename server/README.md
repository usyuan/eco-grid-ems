# EcoGrid EMS — Server

開發用的模擬後端：Express + Socket.IO，**純記憶體、無資料庫**，只負責兩件事。

**此服務不會被部署**——正式環境（GitHub Pages）是純靜態站，只有 `client/` 會上線。詳見 [根 README](../README.md) 的〈架構〉。

開發時的注意事項見 [CLAUDE.md](CLAUDE.md)。

## 職責

### 1. 模擬設備艦隊與電網頻率推播

啟動時以固定種子建立 102 台設備（60 太陽能板組、12 風機、8 儲能、12 變流器、10 智慧電表），再用兩個計時器持續推播：

| 週期 | 行為 | 事件 |
|---|---|---|
| 1s | 電網頻率以 60 Hz 為中心隨機漫步 | `grid:frequency_tick` |
| 2.5s | 隨機挑 ~6% 的設備擾動出力與狀態；轉為 warning/critical 時機率性產生告警 | `equipment:status_update`、`alert:broadcast` |

用戶端連上時會先收到一份完整快照（`equipment:snapshot`），也可主動發 `equipment:request_snapshot` 重取。

事件與 payload 的型別定義在 [src/types.ts](src/types.ts)，完整事件表與維護注意見 [CLAUDE.md](CLAUDE.md)。

### 2. 台電供需摘要代抓

`www.taipower.com.tw` 的 WAF 會擋掉 Vite dev proxy 的請求，但 Node 原生 `fetch()` 正常，因此這支資料改由後端代抓。實作與原因見 [src/taipowerProxy.ts](src/taipowerProxy.ts) 的註解。

## 端點

| 方法 | 路徑 | 回應 |
|---|---|---|
| GET | `/health` | `{ status, uptime }` |
| GET | `/taipower/load-para` | 台電電力供需摘要（原樣轉發，上游異常時回 502） |

Socket.IO 掛在同一個 HTTP server 上。

## 執行

```bash
pnpm --filter server dev     # tsx watch，通常直接用根目錄的 pnpm dev
pnpm --filter server build   # tsc -p tsconfig.json → dist/
pnpm --filter server start   # node dist/index.js
```

| 環境變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `4000` | 監聽埠 |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS 與 Socket.IO 允許的來源 |
