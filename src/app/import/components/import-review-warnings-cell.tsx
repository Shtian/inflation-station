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
        <TooltipTrigger
          render={
            <TriangleAlert
              className="h-4 w-4 text-warning"
              aria-label="Potential duplicate"
            />
          }
        />
        <TooltipContent side="top">Potential duplicate</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
