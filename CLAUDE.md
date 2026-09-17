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

## 慣例

- 回覆與 git commit 訊息一律用繁體中文。
- 註解寫「為什麼」，不寫「做了什麼」——這個 codebase 的既有註解大多在解釋外部資料源的怪癖或某個 workaround 的理由，維持同樣密度。

## 新增外部資料源時的決策流程

正式環境是 GitHub Pages 純靜態站，**`server/` 不會被部署**，所以瀏覽器只能直連本身有回 `Access-Control-Allow-Origin` 的來源。加新的外部 API 前先照這個順序判斷：

1. **測 CORS**：`curl -I` 看有沒有 `Access-Control-Allow-Origin`。有 → 直接在 `.env.production` 加 `VITE_*_BASE_URL` 走直連，開發環境同樣可直連。
2. **沒有 CORS** → 開發環境在 [client/vite.config.ts](client/vite.config.ts) 加 `server.proxy` 條目；正式環境無解，要在 README 明講這是已知限制。
3. **Vite proxy 也打不通**（回 404 或假維護頁，但 `curl` 正常）→ 是對方 WAF 在擋 proxy 的連線特徵。先用 Node 原生 `fetch()` 測一次確認端點沒壞，再比照 [server/src/taipowerProxy.ts](server/src/taipowerProxy.ts) 改由後端代抓，**不要在 Vite proxy 上硬解**。完整案例見 [client/CLAUDE.md](client/CLAUDE.md)。

現況：環境部 `data.moenv.gov.tw` 走第 1 條；台電 `service.taipower.com.tw` 走第 2 條（正式環境不可用）；台電 `www.taipower.com.tw` 走第 3 條。

