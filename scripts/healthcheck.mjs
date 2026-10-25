// Coolify's Command health check and the Dockerfile HEALTHCHECK both run this.
try {
  const res = await fetch(
    `http://localhost:${process.env.PORT ?? 3000}/api/health`,
    { signal: AbortSignal.timeout(4000) },
  );
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
