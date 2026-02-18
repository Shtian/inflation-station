"use client";

import { ProviderMappingsManager } from "./provider-mappings-manager";

export function ProviderMappingsRouteRoot() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <ProviderMappingsManager />
    </main>
  );
}
