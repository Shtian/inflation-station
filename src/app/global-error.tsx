"use client";

import "./globals.css";
import { RouteErrorState } from "@/components/route-error-state";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Replaces the root layout when it fails, so it renders its own document.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="nb" className="dark">
      <body className="font-sans antialiased">
        <RouteErrorState
          error={error}
          title="Noe gikk galt"
          message="Det oppstod en uventet feil i appen."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
