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

## 其他已知的台電/環境部開放資料細節

- 台電機組出力明細（`/api/taipower` proxy → `service.taipower.com.tw/data/opendata/apply/file/d006001/001.json`）：陣列中混有「小計」列，且部分分類欄位殘留來源網頁的 HTML 標籤，消費時請用 `parseGeneratorUnits()`（[client/src/api/taipower.ts](src/api/taipower.ts)），不要直接迭代 `aaData`
- `loadpara.json` 的 `curr_load` 單位是「萬瓩」，換算 MW 需 ×10；`records` 陣列裡是 4 種不同形狀的物件混在一起，要用欄位是否存在判斷，不能用陣列索引
- 環境部 AQI（`/api/moenv` proxy → `data.moenv.gov.tw/api/v2/aqx_p_432`）回傳的是**裸陣列**，沒有 `records` 外層包裝
