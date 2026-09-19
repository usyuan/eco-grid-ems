import { Router, type Response } from "express";
import { log } from "./logger.js";

/**
 * 電力供需摘要。www.taipower.com.tw 的 WAF 會擋掉 Vite dev proxy（底層是 Node http-proxy／核心 https 模組）
 * 發出的請求，回傳一個帶 SecurityTeam_FakeCookie 的假「網站維護中」頁面；但 Node 原生 fetch（undici）搭配
 * 一般瀏覽器 User-Agent 打就正常，跟 curl／真實瀏覽器行為一致。因此改由後端用原生 fetch 代抓。
 *
 * 部署到 Cloud Run 後這支一律 403：同一個 WAF 也封鎖雲端機房 IP（實測 GCP 台灣機房一樣被擋，
 * 所以不是境外封鎖，換地區沒用）。只有從住宅／一般網路發出才通，正式環境無解，詳見 client/CLAUDE.md。
 */
const TAIPOWER_LOAD_PARA_URL = "https://www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.json";

/**
 * 機組出力明細。service.taipower.com.tw 沒有回 CORS 標頭所以瀏覽器不能直連；它不像 www 那台擋雲端機房 IP
 * （GCP 台灣機房與 Cloud Run us-central1 皆實測 200），所以由後端代抓在正式環境可用。
 */
const TAIPOWER_GENERATOR_UNITS_URL = "https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json";

const BROWSER_LIKE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

async function forwardJson(url: string, res: Response): Promise<void> {
  try {
    const upstream = await fetch(url, { headers: BROWSER_LIKE_HEADERS });
    if (!upstream.ok) {
      // WAF 擋 Vite proxy 時回的是 200 的假維護頁，不會走到這裡；會走到這裡的是雲端機房 IP 被拒（403）
      // 或上游真的故障。前者在正式環境是常態，所以用 warn 而不是 error。
      log.warn("台電上游回應異常", { status: upstream.status, url });
      res.status(502).json({ error: `台電上游回應異常 (${upstream.status})` });
      return;
    }
    // 必須用 Response.json()：001.json 開頭帶 UTF-8 BOM，json() 依規範會先剝掉 BOM 再解析，
    // 改成 text() + JSON.parse 就會在第一個字元炸掉。
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    log.error("無法連線至台電資料來源", { detail: String(err), url });
    res.status(502).json({ error: "無法連線至台電資料來源", detail: String(err) });
  }
}

export const taipowerRouter = Router();

taipowerRouter.get("/load-para", (_req, res) => forwardJson(TAIPOWER_LOAD_PARA_URL, res));
taipowerRouter.get("/generator-units", (_req, res) => forwardJson(TAIPOWER_GENERATOR_UNITS_URL, res));
