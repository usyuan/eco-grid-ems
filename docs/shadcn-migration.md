# 導入 shadcn/ui 取代手刻元件

> 開發歷程紀錄。當時的決策背景與前後差異，供日後回顧；**日常開發要查的規範在 [client/CLAUDE.md](../client/CLAUDE.md)**。

## 背景

專案初期的 `Card` / `Badge` / `Modal` 等元件是自己手刻的簡化版，可以動但缺無障礙處理。後來改用官方 `shadcn` skill（`pnpm dlx skills add shadcn/ui`）搭配 CLI（`npx shadcn@latest`）重新產生，`style` 選 `base`（底層是 `@base-ui/react`，**不是 Radix**）+ `nova`。

## 前後差異

| 項目 | 使用前（手刻） | 使用後（shadcn skill + CLI） |
|---|---|---|
| 元件實作 | 自己寫的簡化版 `Card`/`Badge`/`Modal`，約 20-50 行陽春版 | 官方 CLI 生成、以 `@base-ui/react` 為底層 primitive 的正式元件，含完整無障礙屬性、鍵盤操作、focus 管理 |
| Dialog | 手刻 `Modal.tsx`：`fixed inset-0` + 手動點外部關閉，沒有 focus trap、沒有 `role="dialog"` | 官方 `Dialog`（base-ui）：內建 focus trap、Esc 關閉、`DialogTitle`/`aria-*` 完整、Portal 渲染 |
| 側邊欄／手機導覽 | 手刻 drawer：自己管 `useState` 開關、手動 `-translate-x-full` transform、手動遮罩 | 官方 `Sidebar` 元件系統（`SidebarProvider`/`Sidebar`/`SidebarTrigger`）：內建收合、手機自動切成 `Sheet` 抽屜 |
| 篩選 chips | `<button>` 迴圈 + 手動判斷 active class | `ToggleGroup`/`ToggleGroupItem`，語意正確（`role="group"`、方向鍵可切換） |
| 色彩變數 | 自訂 `--color-background`/`--color-surface`/`--color-primary`，命名隨意 | shadcn 語意化 token（`--background`/`--card`/`--primary`/`--muted-foreground`…），元件間一致套用；EcoGrid 品牌色（深色 + 綠色）已整合進 `.dark` 區塊 |
| 圖示/間距慣例 | 無規範，`gap-2`/`space-x-2` 混用 | Skill 強制規範：一律 `gap-*`、等寬高用 `size-*`、按鈕內圖示用 `data-icon` |
| 依賴 | — | 新增 `@base-ui/react`、`cn`、`tw-animate-css`、`@fontsource-variable/geist` |

## 導入過程遇到的問題

### CLI 報 `Could not load the workspace config`

`npx shadcn@latest init` / `add` 在這個專案直接失敗，報 `Could not load the workspace config in .../client`。

排查過程：先懷疑是 monorepo 偵測誤判，試過暫時移開根目錄的 `pnpm-workspace.yaml` / `package.json` / `pnpm-lock.yaml`，全部無效。真正原因是 `client/tsconfig.json` 採 Vite 新版的 project references 寫法（本體只有 `"files": []` + `references`，實際的 `baseUrl` / `paths` 定義在 `tsconfig.app.json`），而 CLI 的 workspace loader 只讀 `client/tsconfig.json` 本身，不會跟著 `references` 找下去。

解法與後續注意事項見 [client/CLAUDE.md](../client/CLAUDE.md)。

### 非互動環境卡在確認提示

CLI 偵測到 `src/components/ui` 已有檔案時，會問「Would you like to re-install existing UI components?」，無 TTY 時不會自動繼續。用 `printf 'n\n' | npx shadcn@latest ...` 餵答案。
