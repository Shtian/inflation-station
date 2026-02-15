import { CategoriesManager } from "./categories-manager";

export default function CategoriesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Manage categories and deterministic category rules used in imports and
        review.
      </p>
      <section className="mt-6">
        <CategoriesManager />
      </section>
    </main>
  );
}
