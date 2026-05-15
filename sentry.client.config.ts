import * as Sentry from "@sentry/nextjs"

// `||` not `??` — Sensitive env may pull as "" (see feedback_vercel_cli_quirks.md, pitfall 3).
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    enabled: process.env.NODE_ENV === "production",
  })
}
