# client/ — 開發參考

技術選型理由與頁面功能說明見 [README.md](README.md)；跨 package 的規則見 [根 CLAUDE.md](../CLAUDE.md)。

## 構件規範

- **路徑別名**：一律用 `@/*`（對應 `src/*`），禁止 `../../` 相對路徑。設定同時存在於 [vite.config.ts](vite.config.ts) 與 `tsconfig.app.json`，兩邊要一致。
- **shadcn/ui**：`components.json` 設定 `style: base-nova`、`baseColor: neutral`、`cssVariables: true`。生成元件一律放 `src/components/ui/`，透過 `npx shadcn@latest add` 產生，**不要手改生成檔的結構**（可改樣式、可加 variant）。
- **Base UI ≠ Radix**：`render` prop 取代 `asChild`；`ToggleGroup` / `Accordion` 的 `value` 一律是陣列（沒有 `type="single"`）；`Select` 需要額外的 `items` prop，placeholder 用 `{ value: null }` 這個項目表示，不是 `SelectValue` 的 `placeholder` prop。完整規則見 [.claude/skills/shadcn/rules/base-vs-radix.md](.claude/skills/shadcn/rules/base-vs-radix.md)。
- **命名慣例**：元件檔案與匯出用 PascalCase；hooks / lib / store 用 camelCase，hook 以 `use` 開頭（`useEMSStore`、`useTheme`、`useGeolocation`）；Zustand selector 一律以 `select` 開頭，並與對應 store 放同一個檔案匯出（`selectLatestFrequency`、`selectTotalOutputKw`）。
- **不使用 barrel file**（沒有 `index.ts` 匯總匯出），一律直接 import 來源檔案。
- **樣式**：以 Tailwind utility class 為主，變體用 `class-variance-authority`（`cva`），合併 class 用 `cn()`（`src/lib/utils.ts`，包 `clsx` + `tailwind-merge`）。間距一律 `gap-*`（不用 `space-x-*`），等寬高用 `size-*`。
- **資料驗證**：串接外部開放資料一定要寫對應的 `parse*()` 做欄位防呆（理由見下方〈已知資料怪癖〉），不要假設回傳結構穩定。

## 目錄結構

```
src/
├── api/            外部資料源，一個來源一支 react-query hook
│                   （taipower.ts、moenv.ts）
├── components/
│   ├── dashboard/  儀表板卡片與圖表
│   ├── equipment/  設備清單列與詳情
│   ├── map/        地圖、marker、InfoWindow、圖例
│   ├── layout/     AppShell.tsx（側邊欄、主題、連線徽章）
│   └── ui/         shadcn/ui 生成元件，勿手改結構
├── hooks/          use-mobile.ts、useTheme.ts
├── lib/            共用邏輯與設定（見下表）
├── pages/          四個路由頁，與 App.tsx 的路由一一對應
├── store/          Zustand：useEMSStore（設備、頻率）
│                   useAlertStore（告警）
└── types/          alerts、aqi、equipment、socket、taipower
```

`lib/` 檔案較雜，用途如下：

| 檔案 | 用途 |
|---|---|
| `socket.ts` | Socket.IO 單例連線，自動重連 |
| `useSocketBridge.ts` | 訂閱 socket 事件寫進 store，App.tsx 只掛一次 |
| `queryClient.ts` | react-query 預設值（staleTime 30s、retry 2） |
| `aqiScale.ts` | 環境部六級色階與四個指標的分級斷點 |
| `countyGroups.ts` | 地圖的縣市聚合邏輯 |
| `mapConfig.ts` | 地圖常數，含 `CLUSTER_ZOOM_THRESHOLD` |
| `geo.ts` | Haversine 距離 |
| `useGeolocation.ts` | 包 `navigator.geolocation`，含拒絕授權時的降級 |
| `alertMeta.ts` / `equipmentMeta.ts` | 告警等級、設備狀態的顯示文字與樣式對應 |
| `csv.ts` | 告警匯出 |
| `utils.ts` | `cn()`（clsx + tailwind-merge） |

## 資料流向

### 即時推播（Socket.IO → Zustand → 圖表）

```
server  setInterval(1s) → nextGridFrequency()
        └→ emit "grid:frequency_tick"
client  lib/socket.ts            單例連線，自動重連
        lib/useSocketBridge.ts   訂閱事件（App.tsx 掛一次）
        useEMSStore              pushFrequencyTick()
        FrequencyChart.tsx       useEMSStore.subscribe(...)
        ECharts                  chart.setOption() 命令式更新
```

`frequencyHistory` 上限 120 筆，超過從頭捨棄。

`FrequencyChart` **刻意繞過 React re-render**——每秒一次的 tick 若走 hook 訂閱會讓整棵子樹重繪，改動這個元件時別把 `subscribe` 換回 `useEMSStore(selector)`。

設備狀態（`equipment:snapshot` / `equipment:status_update`）與告警（`alert:broadcast`）走相同模式，分別更新 `useEMSStore` 與 `useAlertStore`。

### REST 拉取（開放資料 → 卡片）

```
src/api/*.ts   use<Thing>() hook（react-query useQuery）
  ↓ fetch()      取資料
  ↓ parse*()     欄位防呆與正規化
  ↓ queryClient  快取
卡片元件消費
```

- **取資料**：環境部開發時走 `/api/moenv` Vite proxy、正式環境直連（有開 CORS）；台電兩支一律經 `server/` 代抓（`/taipower/load-para`、`/taipower/generator-units`），開發與正式同一條路。
- **`parse*()`**：`parseGeneratorUnits`、`parseLoadPara` 等，理由見下方〈已知資料怪癖〉。
- **快取設定**（`src/lib/queryClient.ts`）：`staleTime` 30s、`retry` 2、不隨視窗 focus 重抓。
- **消費端**：`PowerSupplyCard`、`AirQualityCard`、`GeneratorMixCard`。
- **輪詢間隔**：電力供需摘要 60s，機組出力明細與空氣品質 300s。

## 已知資料怪癖

消費開放資料前務必留意，這三點都是實測踩到的：

- **台電機組出力明細**（`server` 的 `/taipower/generator-units` → `service.taipower.com.tw/data/opendata/apply/file/d006001/001.json`）：`aaData` 陣列中混有「小計」列，且部分分類欄位殘留來源網頁的 HTML 標籤 → 一律透過 `parseGeneratorUnits()`（[src/api/taipower.ts](src/api/taipower.ts)）消費，不要直接迭代 `aaData`。
- **台電電力供需摘要**（`server` 的 `/taipower/load-para` → `service.taipower.com.tw/data/opendata/apply/file/d006020/001.json`）：`curr_load` 單位是「萬瓩」，換算 MW 要 ×10；`records` 陣列裡混著 4 種不同形狀的物件，要用「某欄位存不存在」判斷型別，不能用陣列索引。
- **環境部 AQI**（`/api/moenv` → `data.moenv.gov.tw/api/v2/aqx_p_432`）：回傳的是**裸陣列**，沒有 `records` 外層包裝。

## 踩坑

### 電力供需摘要原本用錯網址：www.taipower.com.tw 擋 Vite proxy，也擋雲端機房 IP

**結論先講**：電力供需摘要一開始打的是 `www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.json`，這是官網「今日電力資訊」頁面自用的資料檔。同一份資料在[政府資料開放平台 dataset 162595](https://data.gov.tw/dataset/162595) 有官方下載網址 `service.taipower.com.tw/.../d006020/001.json`，內容逐字相同，也沒有下面這些問題，現在改用這支。以下留作紀錄，以及「為什麼要先找官方網址」的理由。

**現象一**：`loadpara.json` 這支——

- `curl`（帶一般瀏覽器 UA）直接打 → 正常回 `200 application/json`
- 瀏覽器直接打 → 也正常
- 透過 **Vite dev server 的 proxy**（`server.proxy`，底層是 Node 的 `http-proxy` / 核心 `https` 模組）轉發 → 回 `404`，內容是假的「網站系統升級維護公告」HTML，並帶一個 `SecurityTeam_FakeCookie`

**原因**：該站的 WAF／機器人偵測是針對**連線本身的特徵**（TLS handshake、HTTP 客戶端指紋）判斷，跟請求標頭無關——這支 API 完全公開，不需要任何 API Key。Node 原生 `fetch()`（undici）用同樣的 UA 打不會被擋，只有 Vite proxy 中介層會。

**當時的解法**：改由 [server/src/taipowerProxy.ts](../server/src/taipowerProxy.ts) 用原生 `fetch()` 代抓，本機開發就拿得到。

**現象二：正式環境一樣取不到**。後端部署到 Cloud Run 後打這支固定 403，線上的供需摘要卡片一直是錯誤狀態。`www` 前面有一層 CloudFront，403 是它回的（`Server: CloudFront`、內文 `ERROR: The request could not be satisfied`），和現象一的假維護頁不是同一層。排查過程：

| 從哪裡發出 | 協定 | UA | 結果 |
|---|---|---|---|
| 本機（台灣住宅網路） | HTTP/1.1、HTTP/2 | 瀏覽器 | 200 |
| 本機（台灣住宅網路） | HTTP/1.1 | 不帶／`curl/*` | 403（CloudFront） |
| Cloud Run `us-central1` | — | 瀏覽器 | 403 |
| GCP Cloud Shell（ipinfo 判定為台灣台北） | HTTP/2 | 瀏覽器 | 403（CloudFront） |

第二列說明 **UA 本身就會觸發 403**，所以在雲端測的時候一定要帶瀏覽器 UA，否則分不出是不是 IP 的問題。最後一列跟第一列只差在來源 IP，協定、UA、地理位置都一樣，因此確定是依雲端機房 IP 擋，換 Cloud Run 地區沒有用。

**真正的解法**：不去繞這層防護，改用官方開放資料網址。日後遇到類似狀況的排查順序見 [根 CLAUDE.md](../CLAUDE.md)。同一家的 `service.taipower.com.tw`（機組出力明細）沒有這個限制，Cloud Shell 與 Cloud Run `us-central1` 皆實測 200。

### shadcn CLI 報 `Could not load the workspace config`

`npx shadcn@latest init` / `add` 在這個專案會直接失敗。原因是 CLI 的 workspace loader 只讀 `client/tsconfig.json` 本身，不會跟著 `references` 找到實際定義 `paths` 的 `tsconfig.app.json`。

**解法**：在 [tsconfig.json](tsconfig.json)（那個只有 `"files": []` + `references` 的殼）裡直接補一份 `compilerOptions.baseUrl` / `paths`，跟 `tsconfig.app.json` 重複一份。**這份設定看起來多餘但不要砍掉**，砍了下次跑 CLI 就會再壞。

另外 CLI 在無 TTY 環境下，若偵測到 `src/components/ui` 已有檔案會卡在「Would you like to re-install existing UI components?」不會自動繼續，要用 `printf 'n\n' | npx shadcn@latest ...` 餵答案。

導入 shadcn 的完整背景與前後對照見 [docs/shadcn-migration.md](../docs/shadcn-migration.md)。
