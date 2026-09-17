/**
 * Cloud Run 把容器 stdout 的每一行當成一筆 log entry 送進 Cloud Logging。
 * 純文字會全部被歸成 severity=DEFAULT，在 Logs Explorer 沒辦法按嚴重性篩選；
 * 印成「單行 JSON」才會被解析成結構化欄位（severity 與其餘欄位進 jsonPayload）。
 * 換行會被切成多筆 entry，所以絕對不能用 JSON.stringify 的縮排參數。
 *
 * 參考：https://cloud.google.com/logging/docs/structured-logging
 */

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

// 本機開發印結構化 JSON 只會難讀，且沒有 Cloud Logging 會去解析它
const structured = process.env.NODE_ENV === "production";

function write(severity: Severity, message: string, fields?: Record<string, unknown>): void {
  if (structured) {
    console.log(JSON.stringify({ severity, message, ...fields }));
  } else if (fields) {
    console.log(`[${severity}] ${message}`, fields);
  } else {
    console.log(`[${severity}] ${message}`);
  }
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>) => write("INFO", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("WARNING", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("ERROR", message, fields),
};
