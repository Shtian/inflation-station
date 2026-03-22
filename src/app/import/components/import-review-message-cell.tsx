import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MessageSource = "original" | "cleaned";

const MESSAGE_SOURCE_CLEANED: MessageSource = "cleaned";

type ImportReviewMessageCellProps = {
  rowId: string;
  rowNumber: number;
  name?: string;
  title?: string;
  cleanedMessage?: string | null;
  selectedMessageSource: MessageSource;
  onToggleMessageSource: (rowId: string) => void;
};

export function ImportReviewMessageCell({
  rowId,
  rowNumber,
  name,
  title,
  cleanedMessage,
  selectedMessageSource,
  onToggleMessageSource,
}: ImportReviewMessageCellProps) {
  const originalMessage =
    typeof title === "string" && title.trim().length > 0
      ? title
      : typeof name === "string" && name.trim().length > 0
        ? name
        : "No original message";
  const hasCleanedMessage =
    typeof cleanedMessage === "string" && cleanedMessage.trim().length > 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm truncate max-w-[20ch]">
        {selectedMessageSource === MESSAGE_SOURCE_CLEANED
          ? cleanedMessage
          : originalMessage}
      </span>
      {hasCleanedMessage ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Toggle message source for row ${rowNumber}`}
                onClick={() => onToggleMessageSource(rowId)}
                className={cn(
                  "shrink-0 rounded p-0.5 transition-colors hover:bg-accent",
                  selectedMessageSource === MESSAGE_SOURCE_CLEANED
                    ? "text-violet-500"
                    : "text-muted-foreground",
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs space-y-1 p-3 text-xs"
            >
              <p>
                <span className="font-medium">Original:</span> {originalMessage}
              </p>
              <p>
                <span className="font-medium">AI-cleaned:</span>{" "}
                {cleanedMessage}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
