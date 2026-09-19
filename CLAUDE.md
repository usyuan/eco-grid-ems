# EcoGrid EMS — 開發參考

pnpm workspace（`client` + `server`）。本檔只記錄**跨 package** 的規則。

> **動工前必讀**——各 package 的規範與踩坑都在自己的 CLAUDE.md，本檔不重複：
>
> - 改 `client/` 底下任何檔案前，先讀 [client/CLAUDE.md](client/CLAUDE.md)
> - 改 `server/` 底下任何檔案前，先讀 [server/CLAUDE.md](server/CLAUDE.md)
>
> 這兩份記載了外部資料源的已知怪癖、被 WAF 擋掉的連線方式、以及若干「看起來多餘但砍掉會壞」的設定。沒讀就改，很容易重踩一次。

## 指令

一律從 repo 根目錄執行：

```bash
pnpm dev                      # 同時啟動 server(4000) + client(5173)
pnpm --filter client lint     # oxlint
pnpm --filter client build    # tsc -b && vite build
pnpm --filter <pkg> <script>  # 針對單一 package
```

容器（build context 是 repo 根目錄，不是 `server/`）：

```bash
docker build -f server/Dockerfile -t eco-grid-server .
```

## 部署

兩個 package 各走各的 workflow，互不相干：

| 產物 | Workflow | 目的地 | 觸發路徑 |
|---|---|---|---|
| `client/` | [deploy-client-pages.yml](.github/workflows/deploy-client-pages.yml) | GitHub Pages | `client/**` |
| `server/` | [deploy-cloud-run.yml](.github/workflows/deploy-cloud-run.yml) | Cloud Build → Artifact Registry → Cloud Run | `server/**` |

前端要連上後端，靠的是 repo variable `VITE_SERVER_URL`（Cloud Run 的 `*.run.app` 網址）在建置時注入。**改這個 variable 不會自動觸發前端重新建置**，要手動重跑 Pages 的 workflow。

GCP 一次性設定、免費額度與成本守則見 [docs/gcp-deploy.md](docs/gcp-deploy.md)——Cloud Run 的瓶頸是 WebSocket 連線時間（約 50 小時／月），不是請求數，動 Cloud Run 參數前先讀那一節。

## 慣例

- 回覆與 git commit 訊息一律用繁體中文。
- 註解寫「為什麼」，不寫「做了什麼」——這個 codebase 的既有註解大多在解釋外部資料源的怪癖或某個 workaround 的理由，維持同樣密度。

## 新增外部資料源時的決策流程

正式環境的前端是 GitHub Pages 純靜態站，`server/` 則以容器部署在 Cloud Run。因此瀏覽器拿得到的資料只有兩種：本身有回 `Access-Control-Allow-Origin` 的來源，或經 `server/` 代抓。加新的外部 API 前先照這個順序判斷：

1. **測 CORS**：`curl -I` 看有沒有 `Access-Control-Allow-Origin`。有 → 直接在 `.env.production` 加 `VITE_*_BASE_URL` 走直連，開發環境同樣可直連。
2. **沒有 CORS** → 開發環境在 [client/vite.config.ts](client/vite.config.ts) 加 `server.proxy` 條目；正式環境要另外在 `server/` 開一支代抓端點才會通，只加 Vite proxy 的話線上是 404。
3. **Vite proxy 也打不通**（回 404 或假維護頁，但 `curl` 正常）→ 是對方 WAF 在擋 proxy 的連線特徵。先用 Node 原生 `fetch()` 測一次確認端點沒壞，再比照 [server/src/taipowerProxy.ts](server/src/taipowerProxy.ts) 改由後端代抓，**不要在 Vite proxy 上硬解**。完整案例見 [client/CLAUDE.md](client/CLAUDE.md)。

現況：

| 來源 | 走法 | 正式環境 |
|---|---|---|
| 環境部 `data.moenv.gov.tw` | 第 1 條，直連 | ✅ |
| 台電 `service.taipower.com.tw`（機組出力明細） | 第 2 條，由 `server/` 代抓 `/taipower/generator-units` | ✅ |
| 台電 `www.taipower.com.tw`（電力供需摘要） | 第 3 條，由 `server/` 代抓 `/taipower/load-para` | ❌ 該站也封鎖雲端機房 IP，Cloud Run 打過去固定 403 |

最後一列提醒一件事：**改由後端代抓不保證正式環境能用**，對方可能擋雲端機房 IP。加新來源時除了本機測試，也要在 Cloud Shell（它本身就是 GCP 機房 IP）用 `curl` 打一次；結果是 403 的話，這個來源在正式環境就無解，換地區也沒用。案例見 [client/CLAUDE.md](client/CLAUDE.md) 的〈踩坑〉。

