import { Loader2 } from "lucide-react";

type RouteLoadingStateProps = {
  label: string;
};

export function RouteLoadingState({ label }: RouteLoadingStateProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-16 md:px-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{label}</span>
      </div>
    </main>
  );
}
