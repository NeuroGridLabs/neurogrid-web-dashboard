export function Footer() {
  return (
    <footer
      className="border-t border-border px-4 py-4"
      style={{ backgroundColor: "rgba(5,5,5,0.95)" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/images/neurogrid-logo.png"
            alt="NeuroGrid"
            width={20}
            height={20}
            className="object-contain opacity-50"
          />
          <span className="text-xs" style={{ color: "rgba(0,255,65,0.3)" }}>
            NeuroGrid Protocol -- Community-Driven Decentralized GPU Exchange
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
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
