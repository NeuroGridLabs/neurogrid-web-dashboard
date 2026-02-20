"use client"

import Link from "next/link"

export default function BillingPage() {
  return (
    <div className="min-h-screen px-4 py-12" style={{ backgroundColor: "#050505" }}>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-2 text-lg font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
          Billing
        </h1>
        <p className="mb-6 text-sm" style={{ color: "rgba(0,255,65,0.6)" }}>
          Manage your compute spend and payment methods. (Coming soon.)
        </p>
        <Link
          href="/nodes"
          className="text-xs uppercase tracking-wider underline hover:no-underline"
          style={{ color: "rgba(0,255,65,0.7)" }}
        >
          ← Back to My Instances
        </Link>
      </div>
    </div>
  )
}
