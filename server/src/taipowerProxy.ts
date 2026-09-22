import { Router, type Response } from "express";
import { log } from "./logger.js";

/**
 * 電力供需摘要。用政府資料開放平台 dataset 162595 登記的官方下載網址，不要換回
 * www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.json——兩者內容完全相同，但 www 那支是官網
 * 「今日電力資訊」頁面自用的資料檔，前面有 CloudFront／AWS WAF 擋雲端機房 IP，Cloud Run 打過去固定 403。
 * 上游沒有回 CORS 標頭，所以仍需後端代抓。詳見 client/CLAUDE.md。
 */
const TAIPOWER_LOAD_PARA_URL = "https://service.taipower.com.tw/data/opendata/apply/file/d006020/001.json";

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
      log.error("台電上游回應異常", { status: upstream.status, url });
      res.status(502).json({ error: `台電上游回應異常 (${upstream.status})` });
      return;
    }
    // 必須用 Response.json()：d006001/001.json 開頭帶 UTF-8 BOM，json() 依規範會先剝掉 BOM 再解析，
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
