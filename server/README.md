# EcoGrid EMS — Server

開發用的模擬後端：Express + Socket.IO，**純記憶體、無資料庫**，只負責兩件事。

此服務以容器部署到 **Cloud Run**，正式環境（GitHub Pages 靜態站）透過它的 `*.run.app` 網址連線。建置與部署流程見 [docs/gcp-deploy.md](../docs/gcp-deploy.md)，整體架構見 [根 README](../README.md) 的〈架構〉。

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

### 2. 台電開放資料代抓

台電兩支資料瀏覽器都拿不到，一律由後端用 Node 原生 `fetch()` 代抓後原樣轉發：

| 資料 | 上游 | 為什麼要代抓 | 正式環境（Cloud Run） |
|---|---|---|---|
| 電力供需摘要 | `www.taipower.com.tw` | WAF 擋 Vite dev proxy 的連線指紋 | ❌ 同一個 WAF 也擋雲端機房 IP，固定 403 → 回 502 |
| 機組出力明細 | `service.taipower.com.tw` | 上游沒有回 CORS 標頭 | ✅ 未擋雲端機房 IP（GCP 台灣機房實測 200） |

實作與原因見 [src/taipowerProxy.ts](src/taipowerProxy.ts) 的註解。

## 端點

| 方法 | 路徑 | 回應 |
|---|---|---|
| GET | `/health` | `{ status, uptime }` |
| GET | `/taipower/load-para` | 台電電力供需摘要（原樣轉發，上游異常時回 502；正式環境固定 502） |
| GET | `/taipower/generator-units` | 台電機組出力明細（原樣轉發，上游異常時回 502） |

Socket.IO 掛在同一個 HTTP server 上。

## 執行

```bash
pnpm --filter server dev     # tsx watch，通常直接用根目錄的 pnpm dev
pnpm --filter server build   # tsc -p tsconfig.json → dist/
pnpm --filter server start   # node dist/index.js
```

| 環境變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `4000`（容器內為 `8080`） | 監聽埠。Cloud Run 會以此告知要聽哪個埠，不可寫死 |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS 與 Socket.IO 允許的來源，**逗號分隔可給多個** |
| `NODE_ENV` | 未設 | 設為 `production` 時 log 改印單行 JSON（給 Cloud Logging 解析） |

### 容器

部署相關的四份設定（`Dockerfile`、`Dockerfile.dockerignore`、`.gcloudignore`、`cloudbuild.yaml`）都在這個資料夾，但 **build context 是 repo 根目錄**——pnpm 的 lockfile 與 workspace 設定都在那裡。指令一律從根目錄下：

```bash
docker build -f server/Dockerfile -t eco-grid-server .
docker run --rm -p 4000:8080 -e CLIENT_ORIGIN=http://localhost:5173 eco-grid-server
```

推到 GCP 的完整流程（Cloud Build → Artifact Registry → Cloud Run）見 [docs/gcp-deploy.md](../docs/gcp-deploy.md)。
