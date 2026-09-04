# client/ — 開發注意事項

## www.taipower.com.tw 會擋掉 Vite dev proxy 的請求

**現象**：`www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.json`（電力供需摘要，含目前負載、今日預測尖峰、昨日尖峰實績）這支 API：

- 用 `curl`（帶一般瀏覽器 `User-Agent`）直接打 → 正常回傳 `200 application/json`
- 用瀏覽器直接打（同樣帶真實 UA）→ 也正常
- 透過 **Vite dev server 的 proxy**（`server.proxy`，底層是 Node 的 `http-proxy` / 核心 `https` 模組）轉發 → 回傳 `404`，內容是一個假的「網站系統升級維護公告」HTML 頁面，並帶一個 `SecurityTeam_FakeCookie` cookie

**原因**：這是該站 WAF／機器人偵測機制針對連線本身的特徵（TLS handshake、HTTP 客戶端指紋等）做的判斷，跟請求標頭內容（User-Agent 是否正確、要不要 API 金鑰）無關——**這支 API 本身完全公開，不需要任何 API Key**。Node 原生 `fetch()`（底層是 undici）用同樣的 UA 打卻不會被擋，跟 curl／真實瀏覽器行為一致；只有 Vite 的 proxy 中介層會被擋。

**現行解法**：這支 API 改成由我們自己的後端（[server/src/taipowerProxy.ts](../server/src/taipowerProxy.ts)）用原生 `fetch()` 代抓，前端改打自己後端的 `GET /taipower/load-para`（見 [client/src/api/taipower.ts](src/api/taipower.ts) 的 `usePowerSupply()`），不再透過 Vite proxy 直連。

**如果之後又遇到類似問題**（新增別的外部 API，Vite proxy 打不通但 curl/瀏覽器正常）：
1. 先確認是否為同一種現象（proxy 404 + 假維護頁 / 反爬蟲頁）
2. 用 `node` 內建 `fetch()` 直接測一次，確認是否真的是 proxy 中介層的問題而非端點本身失效
3. 若原生 `fetch()` 正常，比照這支 API 的做法，改走後端代抓，不要在 Vite proxy 上硬解

## 空氣品質卡片：地區依使用者位置自動選取

新增 `useGeolocation.ts`（包 `navigator.geolocation`）+ `geo.ts`（Haversine 公式算兩點距離）。邏輯：

1. 進頁面時請求定位權限
2. 拿到座標後，跟全台 ~86 個測站的經緯度逐一算距離，選最近的
3. 卡片上會顯示「依你目前位置自動選取最近測站（約 X.X 公里）」
4. 使用者仍可用右上角下拉選單手動切換到任何測站，切換後就不再顯示自動選取的提示
5. 若定位被拒絕或瀏覽器不支援，優雅降級為預設顯示第一個測站（不會卡住或報錯）

## UI 框架：導入 shadcn/ui（取代手刻元件）

專案原本的 `Card`/`Badge`/`Modal` 等元件是自己手刻的簡化版，後來改用官方 `shadcn` skill（`pnpm dlx skills add shadcn/ui`，裝在 `client/.claude/skills/shadcn`）+ CLI（`npx shadcn@latest`）重新產生，`style` 選 `base`（底層是 `@base-ui/react`，不是 Radix）+ `nova`。

### CLI 已知問題：`Could not load the workspace config`

`npx shadcn@latest init`／`add` 在這個專案（`client/tsconfig.json` 用 Vite 新版的 `references` 拆分寫法，實際 `paths`/`baseUrl` 定義在 `tsconfig.app.json`）會直接失敗，報 `Could not load the workspace config in .../client`。試過移開根目錄 `pnpm-workspace.yaml`／`package.json`／`pnpm-lock.yaml`（懷疑是 monorepo 偵測誤判）都無效，真正原因是 CLI 的 workspace loader 只讀 `client/tsconfig.json` 本身，不會跟著 `references` 找到實際定義 `paths` 的檔案。

**解法**：在 `client/tsconfig.json`（那個只有 `"files": []` + `references` 的殼）裡直接補一份 `compilerOptions.baseUrl`/`paths`，跟 `tsconfig.app.json` 內容重複一份即可。之後每次要跑 `shadcn` CLI 指令，這份設定要留著，不要因為「看起來多餘」就砍掉。

另外 CLI 在非互動環境（無 TTY）下，若偵測到 `src/components/ui`已有檔案會卡在「Would you like to re-install existing UI components?」的問答不會自動繼續，要用 `printf 'n\n' | npx shadcn@latest ...` 餵答案。

### 使用前後差異

| 項目 | 使用前（手刻） | 使用後（shadcn skill + CLI） |
|---|---|---|
| 元件實作 | 自己寫的簡化版 `Card`/`Badge`/`Modal`，約 20-50 行陽春版 | 官方 CLI 生成、以 `@base-ui/react` 為底層 primitive 的正式元件，含完整無障礙屬性、鍵盤操作、focus 管理 |
| Dialog | 手刻 `Modal.tsx`：`fixed inset-0` + 手動點外部關閉，沒有 focus trap、沒有 `role="dialog"` | 官方 `Dialog`（base-ui）：內建 focus trap、Esc 關閉、`DialogTitle`/`aria-*` 完整、Portal 渲染 |
| 側邊欄／手機導覽 | 手刻 drawer：自己管 `useState` 開關、手動 `-translate-x-full` transform、手動遮罩 | 官方 `Sidebar` 元件系統（`SidebarProvider`/`Sidebar`/`SidebarTrigger`）：內建收合、手機自動切成 `Sheet` 抽屜 |
| 篩選 chips | `<button>` 迴圈 + 手動判斷 active class | `ToggleGroup`/`ToggleGroupItem`，語意正確（`role="group"`、方向鍵可切換） |
| 色彩變數 | 自訂 `--color-background`/`--color-surface`/`--color-primary`，命名隨意 | shadcn 語意化 token（`--background`/`--card`/`--primary`/`--muted-foreground`…），元件間一致套用；EcoGrid 品牌色（深色 + 綠色）已整合進 `.dark` 區塊 |
| 圖示/間距慣例 | 無規範，`gap-2`/`space-x-2` 混用 | Skill 強制規範：一律 `gap-*`、等寬高用 `size-*`、按鈕內圖示用 `data-icon` |
| 依賴 | — | 新增 `@base-ui/react`、`cn`、`tw-animate-css`、`@fontsource-variable/geist` |

base（非 Radix）與 Radix 的 API 差異注意：`render` prop 取代 `asChild`；`ToggleGroup`/`Accordion` 的 `value` 一律是陣列（沒有 `type="single"`）；`Select` 需要額外的 `items` prop 且 placeholder 用 `{ value: null }` 這個項目表示，不是 `SelectValue` 的 `placeholder` prop。詳細規則見 `client/.claude/skills/shadcn/rules/base-vs-radix.md`。

## 其他已知的台電/環境部開放資料細節

- 台電機組出力明細（`/api/taipower` proxy → `service.taipower.com.tw/data/opendata/apply/file/d006001/001.json`）：陣列中混有「小計」列，且部分分類欄位殘留來源網頁的 HTML 標籤，消費時請用 `parseGeneratorUnits()`（[client/src/api/taipower.ts](src/api/taipower.ts)），不要直接迭代 `aaData`
- `loadpara.json` 的 `curr_load` 單位是「萬瓩」，換算 MW 需 ×10；`records` 陣列裡是 4 種不同形狀的物件混在一起，要用欄位是否存在判斷，不能用陣列索引
- 環境部 AQI（`/api/moenv` proxy → `data.moenv.gov.tw/api/v2/aqx_p_432`）回傳的是**裸陣列**，沒有 `records` 外層包裝
