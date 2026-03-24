import { Loader2 } from "lucide-react";

type RouteLoadingStateProps = {
  label: string;
};

export function RouteLoadingState({ label }: RouteLoadingStateProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl items-center justify-center px-5 py-16 md:px-10">
      <output className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{label}</span>
      </output>
    </main>
  );
}
