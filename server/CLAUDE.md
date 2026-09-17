# server/ — 開發參考

職責、端點與執行方式見 [README.md](README.md)；跨 package 的規則見 [根 CLAUDE.md](../CLAUDE.md)。

**這個服務不會被部署**，只在開發環境跑。它的存在是為了讓前端有即時資料可以展示，以及代抓前端拿不到的外部 API——不要往裡面加正式環境會依賴的功能。

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

## 模擬資料是行程內記憶體

沒有資料庫也沒有持久化。重啟後設備 id（`EQ-0001` 起跳的流水號）與所有告警全部重來，前端對此沒有任何持久化預期，不需要為了「保留狀態」加儲存層。

- 設備艦隊在模組載入時以固定組成建立（60 太陽能、12 風機、8 儲能、12 變流器、10 電表），但容量帶隨機值。
- 電網頻率是**帶均值回歸的隨機漫步**（`nextGridFrequency`）：每次加一個 ±0.03 的擾動，再往 60 Hz 拉回 5%。調整波動幅度改這兩個係數即可，不要改成純亂數——前端的頻率圖預期它是連續的。

## ESM 匯入要帶 .js 副檔名

`type: module` + `moduleResolution: NodeNext`，所以 import 自家模組時要寫 `from "./mockData.js"`（即使原始檔是 `.ts`）。漏掉副檔名 `tsx` 開發時可能過得去，但 `pnpm --filter server build` 之後 `node dist/index.js` 會在執行期炸掉。
