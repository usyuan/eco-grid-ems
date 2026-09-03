import { useQuery } from "@tanstack/react-query";
import type { AqiResponse } from "@/types/aqi";

const API_KEY = import.meta.env.VITE_MOENV_API_KEY;

export function useAirQuality() {
  return useQuery({
    queryKey: ["airQuality"],
    queryFn: async () => {
      const res = await fetch(`/api/moenv/api/v2/aqx_p_432?language=zh&api_key=${API_KEY}`);
      if (!res.ok) throw new Error(`空氣品質資料請求失敗 (${res.status})`);
      return res.json() as Promise<AqiResponse>;
    },
    enabled: Boolean(API_KEY),
    refetchInterval: 300_000,
  });
}
