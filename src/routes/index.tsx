import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-2 px-5 py-8 md:px-10">
      <h1 className="font-semibold text-2xl text-foreground tracking-tight">
        Inflation Station
      </h1>
      <p className="text-muted-foreground text-sm">
        Denne serveren viser foreløpig bare Turer.
      </p>
    </main>
  );
}
