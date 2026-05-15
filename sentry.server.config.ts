import * as Sentry from "@sentry/nextjs"

// `||` not `??` — Sensitive env may pull as "" (see feedback_vercel_cli_quirks.md, pitfall 3).
const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || "development",
    enabled: process.env.NODE_ENV === "production",
  })
} else if (process.env.NODE_ENV === "development") {
  console.info("[sentry] DSN not set — error monitoring disabled (set SENTRY_DSN in .env.local to enable)")
}
