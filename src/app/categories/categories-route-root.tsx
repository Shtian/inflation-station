import { CategoriesManager } from "./categories-manager";

export function CategoriesRouteRoot() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <CategoriesManager />
    </main>
  );
}
