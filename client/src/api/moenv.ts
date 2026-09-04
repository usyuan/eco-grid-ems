import { useQuery } from "@tanstack/react-query";
import type { AqiResponse } from "@/types/aqi";

const API_KEY = import.meta.env.VITE_MOENV_API_KEY;
// 開發環境走 Vite proxy（見 vite.config.ts）；正式環境沒有 proxy，改直接打
// data.moenv.gov.tw——這支 API 有開放 CORS（Access-Control-Allow-Origin: *），
// 瀏覽器可以直接呼叫，見 .env.production。
const MOENV_BASE_URL = import.meta.env.VITE_MOENV_BASE_URL ?? "/api/moenv";

export function useAirQuality() {
  return useQuery({
    queryKey: ["airQuality"],
    queryFn: async () => {
      const res = await fetch(`${MOENV_BASE_URL}/api/v2/aqx_p_432?language=zh&api_key=${API_KEY}`);
      if (!res.ok) throw new Error(`空氣品質資料請求失敗 (${res.status})`);
      return res.json() as Promise<AqiResponse>;
    },
    enabled: Boolean(API_KEY),
    refetchInterval: 300_000,
  });
}
