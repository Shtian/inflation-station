import { TriangleAlert } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ImportReviewWarningsCellProps = {
  potentialDuplicate: boolean;
};

export function ImportReviewWarningsCell({
  potentialDuplicate,
}: ImportReviewWarningsCellProps) {
  if (!potentialDuplicate) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <TriangleAlert
            className="h-4 w-4 text-amber-500"
            aria-label="Potential duplicate"
          />
        </TooltipTrigger>
        <TooltipContent side="top">Potential duplicate</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
