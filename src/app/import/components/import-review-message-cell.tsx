import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MESSAGE_SOURCE_CLEANED,
  type ResolvedRowMessage,
} from "../message-cleanup/resolve-row-message";

type ImportReviewMessageCellProps = {
  rowId: string;
  rowNumber: number;
  resolvedMessage: ResolvedRowMessage;
  onToggleMessageSource: (rowId: string) => void;
};

export function ImportReviewMessageCell({
  rowId,
  rowNumber,
  resolvedMessage,
  onToggleMessageSource,
}: ImportReviewMessageCellProps) {
  const {
    source,
    display,
    originalMessage,
    hasCleanedAlternative,
    cleanedText,
    isPending,
  } = resolvedMessage;

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[20ch] truncate text-sm">{display}</span>
      {isPending ? (
        <Sparkles
          className="h-3.5 w-3.5 shrink-0 animate-pulse text-muted-foreground"
          aria-label={`Cleaning message for row ${rowNumber}`}
        />
      ) : hasCleanedAlternative ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Toggle message source for row ${rowNumber}`}
                  onClick={() => onToggleMessageSource(rowId)}
                  className={cn(
                    "shrink-0 rounded p-0.5 transition-colors hover:bg-accent",
                    source === MESSAGE_SOURCE_CLEANED
                      ? "text-violet-500"
                      : "text-muted-foreground",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent
              side="top"
              className="max-w-xs space-y-1 p-3 text-xs"
            >
              <p>
                <span className="font-medium">Original:</span> {originalMessage}
              </p>
              <p>
                <span className="font-medium">AI-cleaned:</span> {cleanedText}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
