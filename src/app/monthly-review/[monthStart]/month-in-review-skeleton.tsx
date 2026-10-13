import { DECK_WORLDS } from "./month-in-review.worlds";

export function MonthInReviewSkeleton() {
  const world = DECK_WORLDS.base;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: world.background, color: world.foreground }}
    >
      <output className="sr-only">Laster inn måneden som gikk…</output>
      <div className="flex gap-1.5 px-4 pt-5 md:px-8" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((segment) => (
          <span
            key={segment}
            className="h-1 flex-1 rounded-full opacity-20"
            style={{ backgroundColor: world.accent }}
          />
        ))}
      </div>
      <div
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 md:px-12"
        aria-hidden
      >
        <span
          className="block h-[clamp(5rem,22vw,11rem)] w-3/4 animate-pulse rounded-lg opacity-15"
          style={{ backgroundColor: world.accent }}
        />
        <span
          className="block h-6 w-1/2 animate-pulse rounded-md opacity-10"
          style={{ backgroundColor: world.foreground }}
        />
      </div>
      <div className="h-20" aria-hidden />
    </div>
  );
}
