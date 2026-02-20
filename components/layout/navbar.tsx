"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, HardHat, Laptop, ChevronDown, User, ArrowRight, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRole, useWallet, useAuth, useMinerRegistry } from "@/lib/contexts"
import { AuthModal, type AuthModalMode } from "@/components/auth/tenant-auth-modal"

function truncateAddress(addr: string) {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-2)}`
}

type NavItem = { label: string; href: string; external?: boolean }

const VISITOR_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/nodes" },
  { label: "Worker", href: "/miner" },
  { label: "Whitepaper", href: "https://docs.neurogridprotocol.io", external: true },
]

const TENANT_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Marketplace", href: "/nodes" },
  { label: "Whitepaper", href: "https://docs.neurogridprotocol.io", external: true },
]

const MINER_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Worker", href: "/miner" },
  { label: "Whitepaper", href: "https://docs.neurogridprotocol.io", external: true },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("tenant")
  const pathname = usePathname()
  const router = useRouter()
  const { role, setRole } = useRole()
  const { isConnected, address, disconnect } = useWallet()
  const { canSwitchRole } = useAuth()
  const { clearTenantSessionStateForWallet } = useMinerRegistry()

  const switchToMiner = () => {
    if (address) clearTenantSessionStateForWallet(address)
    setRole("miner")
  }
  const switchToTenant = () => setRole("tenant")

  useEffect(() => {
    if (pathname === "/miner") {
      if (address) clearTenantSessionStateForWallet(address)
      setRole("miner")
    } else if (pathname === "/nodes") setRole("tenant")
  }, [pathname, setRole, address, clearTenantSessionStateForWallet])

  const openAuthAs = (mode: AuthModalMode) => {
    setAuthModalMode(mode)
    setRole(mode === "miner" ? "miner" : "tenant")
    setAuthModalOpen(true)
  }

  const handleRoleSwitch = (next: "miner" | "tenant") => {
    if (next === "miner") switchToMiner()
    else switchToTenant()
    setMobileOpen(false)
    if (next === "miner") router.push("/miner")
    else router.push("/nodes")
  }

  const setRoleOnNav = (href: string) => {
    if (href === "/nodes") switchToTenant()
    if (href === "/miner") switchToMiner()
  }

  const navLinks: NavItem[] = !isConnected
    ? VISITOR_NAV
    : role === "tenant" || !canSwitchRole
      ? TENANT_NAV
      : MINER_NAV

  return (
    <header
      className="sticky top-0 z-40 border-b border-border"
      style={{ backgroundColor: "rgba(5,5,5,0.95)", backdropFilter: "blur(8px)" }}
    >
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} mode={authModalMode} />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Left: Logo + primary nav (aligned as a block, slightly right-shifted) */}
        <div className="flex items-center gap-32">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Home">
            <img
              src="/images/neurogrid-logo.png"
              alt="NeuroGrid Protocol logo"
              width={36}
              height={36}
              className="object-contain"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wider" style={{ color: "#00FF41" }}>
                NEUROGRID
              </span>
              <span className="text-xs tracking-widest" style={{ color: "rgba(0,255,65,0.4)" }}>
                PROTOCOL
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-14 md:flex" aria-label="Main navigation">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs uppercase tracking-wider transition-colors hover:opacity-80"
                  style={{ color: "rgba(0,255,65,0.5)" }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs uppercase tracking-wider transition-colors hover:opacity-80"
                  style={{
                    color: pathname === link.href ? "#00FF41" : "rgba(0,255,65,0.5)",
                    textShadow: pathname === link.href ? "0 0 8px rgba(0,255,65,0.4)" : "none",
                  }}
                  onClick={() => setRoleOnNav(link.href)}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Right: auth / identity + genesis badge */}
        <div className="hidden items-center gap-3 md:flex">
          {!isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-90 flex items-center gap-1.5"
                style={{ borderColor: "#00FF41", color: "#00FF41", backgroundColor: "transparent" }}
              >
                Connect <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-[200px] border"
                style={{ backgroundColor: "rgba(10,10,10,0.98)", borderColor: "rgba(0,255,65,0.35)" }}
                align="end"
              >
                <DropdownMenuItem
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "#00FF41" }}
                  onSelect={() => openAuthAs("miner")}
                >
                  <HardHat className="mr-2 h-3.5 w-3.5" />
                  Connect as Miner
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "#00FFFF" }}
                  onSelect={() => openAuthAs("tenant")}
                >
                  <Laptop className="mr-2 h-3.5 w-3.5" />
                  Login as Tenant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 border px-2 py-1.5 text-xs transition-colors hover:opacity-90"
                style={{ borderColor: "#00FF41", color: "#00FF41", backgroundColor: "rgba(0,255,65,0.06)" }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: "rgba(0,255,65,0.2)", color: "#00FF41" }}
                >
                  {address ? address.slice(0, 1).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </span>
                <span className="font-mono">{address ? truncateAddress(address) : "—"}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-[200px] border"
                style={{ backgroundColor: "rgba(10,10,10,0.98)", borderColor: "rgba(0,255,65,0.35)" }}
                align="end"
              >
                <DropdownMenuItem
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "#00FFFF" }}
                  onSelect={() => {
                    switchToTenant()
                    router.push("/nodes")
                  }}
                >
                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                  Go to Marketplace
                </DropdownMenuItem>
                {canSwitchRole && (
                  <DropdownMenuItem
                    className="text-xs uppercase tracking-wider"
                    style={{ color: "#00FF41" }}
                    onSelect={() => {
                      switchToMiner()
                      router.push("/miner")
                    }}
                  >
                    <ArrowRight className="mr-2 h-3.5 w-3.5" />
                    Go to Worker Console
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator style={{ backgroundColor: "rgba(0,255,65,0.2)" }} />
                <DropdownMenuItem
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "#ff6666" }}
                  onSelect={() => disconnect()}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div
            className="flex items-center gap-2 border px-3 py-1.5 text-xs"
            style={{ borderColor: "#00FF41", color: "#00FF41" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#00FF41", boxShadow: "0 0 6px #00FF41" }}
            />
            GENESIS BOOTSTRAPPING
          </div>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          {!isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                style={{ borderColor: "#00FF41", color: "#00FF41", backgroundColor: "transparent" }}
              >
                Connect <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-[180px] border"
                style={{ backgroundColor: "rgba(10,10,10,0.98)", borderColor: "rgba(0,255,65,0.35)" }}
                align="end"
              >
                <DropdownMenuItem className="text-xs" style={{ color: "#00FF41" }} onSelect={() => openAuthAs("miner")}>
                  <HardHat className="mr-2 h-3.5 w-3.5" />
                  Connect as Miner
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" style={{ color: "#00FFFF" }} onSelect={() => openAuthAs("tenant")}>
                  <Laptop className="mr-2 h-3.5 w-3.5" />
                  Login as Tenant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1.5 border px-2 py-1 text-[10px]"
                style={{ borderColor: "#00FF41", color: "#00FF41", backgroundColor: "rgba(0,255,65,0.06)" }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ backgroundColor: "rgba(0,255,65,0.2)", color: "#00FF41" }}
                >
                  {address ? address.slice(0, 1).toUpperCase() : <User className="h-3 w-3" />}
                </span>
                <span className="font-mono">{address ? truncateAddress(address) : "—"}</span>
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-[180px] border"
                style={{ backgroundColor: "rgba(10,10,10,0.98)", borderColor: "rgba(0,255,65,0.35)" }}
                align="end"
              >
                <DropdownMenuItem
                  className="text-xs"
                  style={{ color: "#00FFFF" }}
                  onSelect={() => {
                    switchToTenant()
                    router.push("/nodes")
                  }}
                >
                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                  Go to Marketplace
                </DropdownMenuItem>
                {canSwitchRole && (
                  <DropdownMenuItem
                    className="text-xs"
                    style={{ color: "#00FF41" }}
                    onSelect={() => {
                      switchToMiner()
                      router.push("/miner")
                    }}
                  >
                    <ArrowRight className="mr-2 h-3.5 w-3.5" />
                    Go to Worker Console
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator style={{ backgroundColor: "rgba(0,255,65,0.2)" }} />
                <DropdownMenuItem className="text-xs" style={{ color: "#ff6666" }} onSelect={() => disconnect()}>
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" style={{ color: "#00FF41" }} />
            ) : (
              <Menu className="h-5 w-5" style={{ color: "#00FF41" }} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          className="flex flex-col gap-3 border-t border-border px-4 py-4 md:hidden"
          style={{ backgroundColor: "rgba(5,5,5,0.98)" }}
          aria-label="Mobile navigation"
        >
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm uppercase tracking-wider"
                style={{ color: "rgba(0,255,65,0.6)" }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm uppercase tracking-wider"
                style={{
                  color: pathname === link.href ? "#00FF41" : "rgba(0,255,65,0.6)",
                }}
                onClick={() => {
                  setMobileOpen(false)
                  setRoleOnNav(link.href)
                }}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>
      )}
    </header>
  )
}
