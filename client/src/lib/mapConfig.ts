/**
 * Google Maps 相關設定。金鑰與 Map ID 都會被打包進前端 bundle（這是 Maps
 * JavaScript API 的必然），因此保護方式不是藏起來，而是在 Google Cloud Console
 * 對金鑰設定 HTTP referrer 限制 + 只啟用 Maps JavaScript API + 設每日配額上限。
 * 設定步驟見 client/README.md。
 */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Advanced Marker 只在「向量地圖」上支援，而向量地圖必須綁一個在 Cloud Console
 * 建立的 Map ID。沒設定時退回 Google 提供的展示用 ID，功能正常但會有使用限制。
 */
export const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

/** 台灣本島加離島大致的視覺中心 */
export const TAIWAN_CENTER = { lat: 23.75, lng: 120.95 };

/** 初始縮放：全台測站分布一次看完 */
export const DEFAULT_ZOOM = 7.4;

/** 從清單或定位聚焦到單一測站時的縮放 */
export const FOCUS_ZOOM = 11;

/**
 * 低於這個縮放層級時，測站改依縣市聚合成單一 marker。
 * 全台視野下 86 個數值徽章會互相遮蔽，聚合後才看得出各縣市的整體狀況。
 */
export const CLUSTER_ZOOM_THRESHOLD = 9;
