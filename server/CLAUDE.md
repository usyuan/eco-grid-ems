# server/ — 開發參考

職責、端點與執行方式見 [README.md](README.md)；跨 package 的規則見 [根 CLAUDE.md](../CLAUDE.md)。

這個服務**會以容器部署到 Cloud Run**（設定與流程見 [docs/gcp-deploy.md](../docs/gcp-deploy.md)），但它仍然是模擬服務：純記憶體、沒有資料庫、重啟即歸零。上線不代表它變成正式後端——不要往裡面加需要持久化或水平擴充的功能。

## 部署設定檔都在 server/，但裡面的路徑相對於 repo 根目錄

`cloudbuild.yaml`、`Dockerfile`、`Dockerfile.dockerignore`、`.gcloudignore` 四份都放在這個資料夾，因為它們只服務 `server/` 的部署。但**它們的內容仍以 repo 根目錄為基準**——`server/Dockerfile` 需要根目錄的 `pnpm-lock.yaml`，所以 build context 與上傳來源都必須是 repo 根。看到 `--file=server/Dockerfile` 搭配 context `.` 不要「順手修正」成相對 `server/` 的寫法。

這個擺法有兩個非預設行為，改動時務必留意，兩個壞掉時**都不會報錯**：

| 檔案 | 為什麼能放這裡 | 少了什麼就靜默失效 |
|---|---|---|
| `Dockerfile.dockerignore` | BuildKit 支援「與 Dockerfile 同層、以 Dockerfile 檔名為前綴」的 ignore 檔 | 檔名改成 `.dockerignore` 就完全不會被讀；經典 builder 也不認，所以 `cloudbuild.yaml` 的 build step 必須留著 `DOCKER_BUILDKIT=1` |
| `.gcloudignore` | `gcloud builds submit` 的 `--ignore-file` 可以指定位置 | workflow 少帶 `--ignore-file server/.gcloudignore`，gcloud 會改用 `.gitignore` 生成一份，`client/` 與 `docs/` 就會一起被上傳 |

## Cloud Run 上多出來的限制

- **`--max-instances=1` 是刻意的**。模擬艦隊是行程內狀態，開第二個 instance 會讓不同使用者看到不同的設備清單與告警。要放寬得先有共用狀態（Socket.IO 的 Redis adapter 之類），不是改個數字而已。
- **沒人連線時計時器會停擺**。Cloud Run 預設在請求以外把 CPU 節流到趨近於零，`setInterval` 不會準時跑。這是預期行為（沒人在看就不該計費），不要用 `--no-cpu-throttling` 去「修」它——那會切成 instance-based 計費，閒置也算錢，免費額度很快就沒了。
- **WebSocket 最多撐 60 分鐘**。Cloud Run 把 WebSocket 當成長時間請求，`--timeout=3600` 已經是上限，到點會斷線；前端 `lib/socket.ts` 本來就設了無限重連，不需要額外處理。
- **執行身分 `eco-grid-runtime` 刻意零權限**。這支伺服器對外開 WebSocket、代抓外部資料，是整條部署線上最暴露的東西，不該持有任何 GCP 權限。日後若真需要呼叫 GCP API（例如讀 Secret Manager），只對那一個資源授予最小角色，**不要**改回預設的 Compute Engine 帳戶或給專案層級角色。設定見 `cloudbuild.yaml` deploy step 的 `--service-account` 與 [docs/gcp-deploy.md](../docs/gcp-deploy.md) §3。
- **`PORT` 與 `CLIENT_ORIGIN` 由環境決定**。`PORT` 是 Cloud Run 指定的（8080），不能寫死；`CLIENT_ORIGIN` 改吃逗號分隔的清單，正式環境放 GitHub Pages 的網域。

## log 要印成單行 JSON

Cloud Run 把容器 stdout 的每一行當一筆 log entry 送進 Cloud Logging。純文字會全部被歸成 `severity=DEFAULT`，在 Logs Explorer 沒辦法按嚴重性篩；[src/logger.ts](src/logger.ts) 因此在 `NODE_ENV=production` 時把每筆 log 印成**單行** JSON。

**不要用 `JSON.stringify` 的縮排參數**——Cloud Logging 以換行切分 entry，多行會被拆成好幾筆互不相干的紀錄。新增 log 一律走 `log.info` / `log.warn` / `log.error`，不要直接 `console.log`。

## Socket 事件契約有兩份型別定義

[src/types.ts](src/types.ts) 與 [client/src/types/socket.ts](../client/src/types/socket.ts) **沒有共用 package，是各自維護的兩份**。改事件名稱或 payload 形狀時兩邊都要改，否則編譯不會報錯，只會在執行期發現前端收不到東西。

目前的事件：

| 方向 | 事件 | payload |
|---|---|---|
| → client | `equipment:snapshot` | `EquipmentNode[]`，連線時先送一次 |
| → client | `equipment:status_update` | `Partial<EquipmentNode> & { id }` |
| → client | `grid:frequency_tick` | `{ frequency, timestamp }` |
| → client | `alert:broadcast` | `AlertEvent` |
| → server | `equipment:request_snapshot` | 無 |

## taipowerProxy.ts 必須用 Node 原生 fetch

`www.taipower.com.tw` 的 WAF 擋的是**連線指紋**（TLS handshake、HTTP 客戶端特徵），不是請求標頭。原生 `fetch()`（undici）過得去，Vite dev proxy 的 `http-proxy` 過不去。

因此**不要**把它改成 axios / node-fetch，也不要加 proxy agent——換一套 HTTP 客戶端很可能又被擋回去，而且失敗時回的是 200 的假維護頁，不會拋錯，很難察覺。瀏覽器 User-Agent 那組標頭也要留著。

完整的排查紀錄見 [client/CLAUDE.md](../client/CLAUDE.md) 的〈踩坑〉。

另外兩件改動時要知道的事：

- **`/load-para` 在 Cloud Run 上固定失敗**。`www.taipower.com.tw` 的 WAF 除了認連線指紋，也封鎖雲端機房 IP——實測從 GCP **台灣**機房一樣 403，所以不是境外封鎖，把 Cloud Run 搬到 `asia-east1` 沒有用。別為了修它去換地區（會失去免費額度）。`/generator-units` 打的 `service.taipower.com.tw` 沒有這個限制。
- **不要把 `upstream.json()` 改成 `text()` + `JSON.parse`**。`001.json` 開頭帶 UTF-8 BOM，`Response.json()` 依規範會先剝掉 BOM，自己 `JSON.parse` 會在第一個字元炸掉。

## 模擬資料是行程內記憶體

沒有資料庫也沒有持久化。重啟後設備 id（`EQ-0001` 起跳的流水號）與所有告警全部重來，前端對此沒有任何持久化預期，不需要為了「保留狀態」加儲存層。

- 設備艦隊在模組載入時以固定組成建立（60 太陽能、12 風機、8 儲能、12 變流器、10 電表），但容量帶隨機值。
- 電網頻率是**帶均值回歸的隨機漫步**（`nextGridFrequency`）：每次加一個 ±0.03 的擾動，再往 60 Hz 拉回 5%。調整波動幅度改這兩個係數即可，不要改成純亂數——前端的頻率圖預期它是連續的。

## ESM 匯入要帶 .js 副檔名

`type: module` + `moduleResolution: NodeNext`，所以 import 自家模組時要寫 `from "./mockData.js"`（即使原始檔是 `.ts`）。漏掉副檔名 `tsx` 開發時可能過得去，但 `pnpm --filter server build` 之後 `node dist/index.js` 會在執行期炸掉。
