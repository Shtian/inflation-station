import { createFileRoute } from "@tanstack/react-router";
import { CategoriesManager } from "@/app/categories/categories-manager";
import {
  CategoriesError,
  CategoriesPending,
} from "./-components/categories-route-states";

export const Route = createFileRoute("/categories/")({
  head: () => ({ meta: [{ title: "Kategorier · Inflation Station" }] }),
  pendingComponent: CategoriesPending,
  errorComponent: CategoriesError,
  component: CategoriesPage,
});

function CategoriesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <CategoriesManager />
    </main>
  );
}
