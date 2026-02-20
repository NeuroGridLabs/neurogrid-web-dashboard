export function Footer() {
  return (
    <footer
      className="border-t border-border px-4 py-4"
      style={{ backgroundColor: "rgba(5,5,5,0.95)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 md:flex-row md:justify-between md:gap-6">
        <div className="flex items-start gap-3 text-center md:text-left">
          <img
            src="/images/neurogrid-logo.png"
            alt="NeuroGrid"
            width={20}
            height={20}
            className="mt-0.5 shrink-0 object-contain opacity-50"
          />
          <div className="min-w-0 space-y-1">
            <span className="block text-xs leading-snug" style={{ color: "rgba(0,255,65,0.35)" }}>
              NeuroGrid Protocol v3.5 — Community-Driven Decentralized GPU Exchange
            </span>
            <span className="block text-[11px] leading-snug" style={{ color: "rgba(0,255,65,0.28)" }}>
              Neuro for neural networks, Grid for global distribution—$NRG is the energy flowing through it.
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs">
          <a
            href="https://docs.neurogridprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-80"
            style={{ color: "rgba(0,255,65,0.4)" }}
          >
            Docs
          </a>
          <a
            href="https://twitter.com/NeuroGridLabs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-80"
            style={{ color: "rgba(0,255,65,0.4)" }}
          >
            Twitter
          </a>
          <a
            href="https://t.me/NeuroGridPortal"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-80"
            style={{ color: "rgba(0,255,65,0.4)" }}
          >
            Telegram
          </a>
        </div>
      </div>
    </footer>
  )
}
