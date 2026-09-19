# EcoGrid EMS — Client

台灣電網即時監控儀表板的前端，也是這個專案**唯一會被部署**的產物。專案整體介紹與架構見 [根 README](../README.md)；開發時的構件規範與踩坑見 [CLAUDE.md](CLAUDE.md)。

## 技術選型

| 分類 | 選型 | 為什麼 |
|---|---|---|
| 框架 / 語言 | React + TypeScript | `tsconfig` 採 project references（`tsconfig.app.json` / `tsconfig.node.json`） |
| 建置 | Vite | `base: './'`——GitHub Pages 以子路徑服務，資產必須走相對路徑 |
| UI 元件 | shadcn/ui（`style: base-nova`） | 底層 primitive 是 **Base UI**（`@base-ui/react`），**不是 Radix**，API 有差異 |
| CSS | Tailwind CSS v4 | CSS-first 設定，無 `tailwind.config.js`，主題 token 定義在 `src/index.css` |
| 圖示 | `lucide-react` | shadcn `iconLibrary` 設定 |
| 狀態管理 | Zustand | 即時推播進來的資料（設備、頻率、告警）不適合放 react-query |
| 路由 | `react-router-dom`（`HashRouter`） | 靜態主機沒有 rewrite 規則，hash routing 才不會重整 404 |
| 伺服器資料 | `@tanstack/react-query` | 每個外部資料源包一支 `use<Thing>()` hook |
| 即時通訊 | `socket.io-client` | 訂閱後端推播的設備狀態與電網頻率 |
| 圖表 | `echarts` + `recharts` | 頻率折線圖用 ECharts（每秒更新，需繞過 React render）；發電占比圓餅圖用 Recharts |
| 地圖 | `@vis.gl/react-google-maps` | Google 官方維護的 React 綁定；用 Advanced Marker 渲染自訂 DOM 徽章 |
| 表格 / 虛擬滾動 | `@tanstack/react-table` + `@tanstack/react-virtual` | 告警表格與百來筆設備清單 |
| Lint | `oxlint` | 取代 ESLint，設定於 `.oxlintrc.json` |
| 測試 | 無 | 目前未設置測試框架 |

版本號一律以 [package.json](package.json) 為準。

## 頁面

路由直接宣告在 `App.tsx`，未獨立成 `router/`。

### 儀表板 `/`

四張 KPI + 每秒更新的頻率折線圖 + 發電占比圓餅圖（皆來自 `server/` 的模擬推播），再加上三張真實開放資料卡片：台電電力供需摘要、台電機組出力明細、最近測站空氣品質。

空氣品質卡片會請求定位權限，用 Haversine 距離從全台測站中挑最近的一站並標示距離；使用者手動切換測站後不再顯示自動選取提示。定位被拒或瀏覽器不支援時降級為顯示第一個測站。

### 環境地圖 `/map`

把空氣品質卡片背後那份環境部測站資料（全台約 84–86 站，每筆自帶經緯度）攤到地圖上：

- **Marker**：Advanced Marker 渲染自訂 DOM，圓形徽章直接顯示數值，底色為環境部官方六級色階（`src/lib/aqiScale.ts`）。
- **縣市聚合**：縮放層級低於 `CLUSTER_ZOOM_THRESHOLD` 時，測站依 `county` 聚合成一顆縣市 marker（`src/lib/countyGroups.ts`），顯示平均值與測站數——否則全台視野下 80 幾個徽章會互相遮蔽。平均只計入有測值的測站；點擊聚合會 `fitBounds` 到該縣市範圍並展開成個別測站。
- **指標切換**：AQI / PM2.5 / PM10 / O₃(8hr)。四個指標各有自己的分級斷點（取自環境部 AQI 副指標濃度對照表），所以切換後同一組顏色仍代表同一種健康風險等級。O₃ 用 8 小時移動平均而非小時值，與 AQI 算法一致。
- **InfoWindow**：關掉 API 原生標題列（`headerDisabled`）改渲染 React 內容，外框顏色靠覆寫 Google 的 class 融入主題（覆寫規則見 `src/index.css` 底部）。
- **降級**：測站資料抓不到時顯示提示畫面而非白屏，其他頁面不受影響。

### 設備管理 `/equipment`

102 台模擬設備清單，狀態 chips 篩選（含各狀態數量）、名稱／位置關鍵字搜尋、`@tanstack/react-virtual` 虛擬滾動，點列開 Dialog 看詳情。

### 告警紀錄 `/alerts`

`@tanstack/react-table` 表格，可排序分頁、等級篩選、單筆／全部確認、匯出 CSV。

## 開發

```bash
pnpm dev       # 或從 repo 根目錄 pnpm dev 一起啟動 server
pnpm build     # tsc -b && vite build
pnpm lint      # oxlint
```

## 環境變數

複製 [.env.example](.env.example) 為 `.env`：

| 變數 | 說明 |
|---|---|
| `VITE_SOCKET_URL` | 本地 `server` 的 Socket.IO 位址，預設 `http://localhost:4000` |
| `VITE_API_BASE_URL` | `server` 的 REST 位址（台電供需摘要、機組出力明細代抓） |
| `VITE_MOENV_API_KEY` | 環境部開放資料 API 金鑰 |
| `VITE_GOOGLE_MAPS_API_KEY` | 地圖頁；未填時地圖頁顯示提示，其他頁面不受影響 |
| `VITE_GOOGLE_MAPS_MAP_ID` | 地圖頁；Advanced Marker 需要向量地圖 |

正式環境的變數在 [.env.production](.env.production)，只有 `VITE_MOENV_BASE_URL`——原因見 [根 README](../README.md) 的〈架構〉。

## Google Maps 設定

金鑰與 Map ID 都會出現在前端 bundle 裡，這是 Maps JavaScript API 的運作方式，不是疏漏。**保護方式不是把它藏起來，而是限制它只能從本站網域使用**，所以下面第 2、4 步不能跳過。

1. **建立專案並啟用 API**：在 [Google Cloud Console](https://console.cloud.google.com/) 建立專案，綁定帳單帳戶（不綁會蓋上 "For development purposes only" 浮水印），到「API 和服務 → 程式庫」啟用 **Maps JavaScript API**（只需要這一個）。
2. **建立並鎖定金鑰**：「憑證 → 建立憑證 → API 金鑰」，建好後點進去設定：
   - 應用程式限制選「網站」，加入 `http://localhost:5173/*` 與 `https://<帳號>.github.io/eco-grid-ems/*`
   - API 限制選「限制金鑰」，只勾 Maps JavaScript API
3. **建立 Map ID**：「Google Maps Platform → 地圖管理 → 建立地圖 ID」，地圖類型選 **JavaScript**、轉譯類型選 **向量**。Advanced Marker 只在向量地圖上支援，這步是必要的。
4. **設每日配額上限**：「Maps JavaScript API → 配額」設一個可接受的上限，避免金鑰外流時被刷爆。
5. **填入設定**：本機寫進 `client/.env`；部署則加到 GitHub repo 的 Settings → Secrets and variables → Actions，workflow 會在 build 時注入。
