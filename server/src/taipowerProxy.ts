import { Router } from "express";
import { log } from "./logger.js";

const TAIPOWER_LOAD_PARA_URL = "https://www.taipower.com.tw/d006/loadGraph/loadGraph/data/loadpara.json";

/**
 * www.taipower.com.tw 的 WAF 會擋掉 Vite dev proxy（底層是 Node http-proxy／核心 https 模組）發出的請求，
 * 回傳一個帶 SecurityTeam_FakeCookie 的假「網站維護中」頁面；但 Node 原生 fetch（undici）搭配一般瀏覽器
 * User-Agent 打就正常，跟 curl／真實瀏覽器行為一致。因此改由後端用原生 fetch 代抓，不透過 Vite proxy。
 * 詳見 client/CLAUDE.md。
 */
const BROWSER_LIKE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

export const taipowerRouter = Router();

taipowerRouter.get("/load-para", async (_req, res) => {
  try {
    const upstream = await fetch(TAIPOWER_LOAD_PARA_URL, { headers: BROWSER_LIKE_HEADERS });
    if (!upstream.ok) {
      // 被 WAF 擋掉時回的是 200 的假維護頁而不是錯誤碼，所以這裡記到的是「其他」異常；
      // 真正要靠 Cloud Logging 察覺假維護頁，得看下游 parseLoadPara 解析失敗的紀錄。
      log.warn("台電上游回應異常", { status: upstream.status, url: TAIPOWER_LOAD_PARA_URL });
      res.status(502).json({ error: `台電上游回應異常 (${upstream.status})` });
      return;
    }
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    log.error("無法連線至台電資料來源", { detail: String(err), url: TAIPOWER_LOAD_PARA_URL });
    res.status(502).json({ error: "無法連線至台電資料來源", detail: String(err) });
  }
});
