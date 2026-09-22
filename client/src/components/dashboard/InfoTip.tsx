import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTipProps {
  /** 同時作為按鈕的 aria-label，讓螢幕閱讀器知道這是哪個指標的說明 */
  label: string;
  children: ReactNode;
}

export function InfoTip({ label, children }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // 用 button 而非 span：觸控裝置沒有 hover，要能點；鍵盤也要能 focus 到
          <button
            type="button"
            aria-label={`${label}說明`}
            className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        <div className="flex flex-col gap-1 py-0.5 text-left leading-relaxed">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}
