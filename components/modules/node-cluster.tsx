"use client"

import { useEffect, useState, useCallback } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import {
  PublicKey,
  Transaction,
  TransactionExpiredBlockheightExceededError,
} from "@solana/web3.js"
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { StatusBadge, type BadgeStatus } from "@/components/atoms/status-badge"
import { GpuBar } from "@/components/atoms/gpu-bar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Rocket, Circle, X, ArrowRight, TrendingUp, CheckCircle2, Lock, LockKeyhole, ChevronDown, ChevronUp } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  TREASURY_WALLET_ADDRESS,
  USDT_MINT_ADDRESS,
  USDT_DECIMALS,
} from "@/lib/solana-constants"
import type { Node, NodeLifecycleStatus, LockMetadata } from "@/lib/types/node"
import {
  useMinerRegistry,
  NODE_DISPLAY_NAMES,
  NODE_GPU_MAP,
  NODE_VRAM_MAP,
} from "@/lib/contexts"
import { FOUNDATION_GENESIS_NODE_ID, isGenesisNode, ALPHA01_DESCRIPTION } from "@/lib/genesis-node"
import { getCurrentPeriodEnd } from "@/lib/lifecycle/escrow"

const DEPLOY_DURATION_MS = 2500
const UNDEPLOY_DURATION_MS = 1800
const ALLOCATE_MS = 600
const NODES_FETCH_INTERVAL_MS = 30_000

type ActionModalType = "deploy" | "undeploy"
type ModalPhase = "confirm" | "in_progress" | "done"
type ProgressStep = "allocating" | "syncing" | "ready" | "unbinding" | "unbound"

/** Snapshot passed to parent when deploy completes; used by My Rented Nodes */
export interface RentedNodeSnapshot {
  id: string
  name: string
  gpus: string
  vram: string
  status: BadgeStatus
  utilization: number
  gateway: string
  port: number
  /** Secure session key for NeuroClient (no raw IP/port exposed). e.g. ng_sess_9a8b7c6d... */
  session_key?: string
  /** Session end (ISO); tenant can Redeploy until then without paying again */
  expires_at?: string
  /** True when tenant undeployed but session still valid (show Redeploy) */
  disconnected?: boolean
}

interface NodeClusterProps {
  isConnected?: boolean
  walletAddress?: string | null
  /** Optional: open global auth (Email / Social / Wallet) when user tries to rent without being connected. */
  onRequireAuth?: () => void
  onDeployComplete?: (node: RentedNodeSnapshot) => void
  onUndeployComplete?: (nodeId: string, options?: { keepSession?: boolean; expires_at?: string }) => void
  triggerUndeployNodeId?: string | null
  onUndeployModalOpen?: () => void
  /** When set, open deploy modal for this node (e.g. Redeploy from My Rented Nodes) */
  redeployNodeId?: string | null
  onRedeployConsumed?: () => void
}

async function fetchNodes(): Promise<Node[]> {
  const res = await fetch("/api/nodes", { cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json()) as { nodes?: Node[] }
  return Array.isArray(data.nodes) ? data.nodes : []
}

/** USDT raw amount (6 decimals). No careless rounding. */
function usdtToRaw(humanAmount: number): bigint {
  const scaled = humanAmount * 10 ** USDT_DECIMALS
  return BigInt(Math.floor(scaled))
}

/** Build Node[] from miner registry when /api/nodes returns empty (e.g. fetch failed). */
function buildNodesFromRegistry(
  nodeToMiner: Record<string, string>,
  nodeRentals: Record<string, string | null>,
  nodePrices: Record<string, string>,
  nodeBandwidth: Record<string, string>,
  nodeLifecycle: Record<string, NodeLifecycleStatus>,
  nodeLockMetadata: Record<string, LockMetadata | null>,
): Node[] {
  return Object.keys(nodeToMiner).map((id): Node => {
    const lifecycle = nodeLifecycle[id] ?? "IDLE"
    const lockMeta = nodeLockMetadata[id] ?? null
    const isLocked = lifecycle === "LOCKED" && lockMeta != null
    const priceInUSDT = isLocked
      ? lockMeta.locked_price
      : (() => {
          const priceStr = nodePrices[id] ?? "$0.59/hr"
          const match = priceStr.match(/\$?([\d.]+)/)
          return match ? parseFloat(match[1]) : 0.59
        })()
    const pricePerHour = `$${Number(priceInUSDT).toFixed(2)}/hr`
    const minerWallet = nodeToMiner[id]
    const isFoundationSeed = isGenesisNode(minerWallet)
    const rentedBy = nodeRentals[id] ?? null
    return {
      id,
      name: NODE_DISPLAY_NAMES[id] ?? id,
      gpus: NODE_GPU_MAP[id] ?? "—",
      vram: NODE_VRAM_MAP[id] ?? "24GB",
      status: (isLocked ? "LOCKED" : rentedBy ? "OCCUPIED" : "PENDING") as BadgeStatus,
      utilization: 0,
      bandwidth: nodeBandwidth[id] ?? "1 Gbps",
      latencyMs: 0,
      isGenesis: isFoundationSeed,
      isFoundationSeed,
      rentedBy,
      minerWalletAddress: minerWallet,
      priceInUSDT: Number.isFinite(priceInUSDT) ? priceInUSDT : 0.59,
      pricePerHour,
      lifecycleStatus: lifecycle,
      lock_metadata: lockMeta,
    }
  })
}

export function NodeCluster({
  isConnected = false,
  walletAddress = null,
  onRequireAuth,
  onDeployComplete,
  onUndeployComplete,
  triggerUndeployNodeId = null,
  onUndeployModalOpen,
  redeployNodeId = null,
  onRedeployConsumed,
}: NodeClusterProps) {
  const {
    setNodeRental,
    setNodeSessionExpiresAt,
    setNodeSessionDisconnected,
    getLockMetadata,
    nodeToMiner,
    nodeRentals,
    nodePrices,
    nodeBandwidth,
    nodeLifecycle,
    nodeLockMetadata,
    genesisIgnited,
    setGenesisIgnited,
    getDisplayEarnedNrg,
    getNodeSessionDisconnected,
    getNodeSessionExpiresAt,
  } = useMinerRegistry()
  const [nodes, setNodes] = useState<Node[]>([])
  const [nodesLoading, setNodesLoading] = useState(true)
  const [hoverUndeployId, setHoverUndeployId] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<{
    type: ActionModalType
    node: Node
  } | null>(null)
  const [modalPhase, setModalPhase] = useState<ModalPhase>("confirm")
  const [progressStep, setProgressStep] = useState<ProgressStep | null>(null)
  const [lastTriggerUndeployId, setLastTriggerUndeployId] = useState<string | null>(null)
  const [deployTxPending, setDeployTxPending] = useState(false)
  const [genesisComingSoonOpen, setGenesisComingSoonOpen] = useState(false)
  const [showSpecsIds, setShowSpecsIds] = useState<Set<string>>(new Set())
  const toggleSpecs = useCallback((nodeId: string) => {
    setShowSpecsIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const usdtMint = USDT_MINT_ADDRESS
  const treasuryPubkey = TREASURY_WALLET_ADDRESS

  function mergeWithPersisted(list: Node[]): Node[] {
    return list.map((n) => {
      const renter = nodeRentals[n.id] ?? n.rentedBy
      const lifecycle = nodeLifecycle[n.id] ?? "IDLE"
      const lockMeta = nodeLockMetadata[n.id]
      const isLocked = lifecycle === "LOCKED" && lockMeta != null
      const priceStr = nodePrices[n.id]
      const priceNum = priceStr ? (() => { const m = priceStr.match(/\$?([\d.]+)/); return m ? parseFloat(m[1]) : n.priceInUSDT })() : n.priceInUSDT
      const applyPrice = isLocked && lockMeta
        ? { priceInUSDT: lockMeta.locked_price, pricePerHour: `$${lockMeta.locked_price.toFixed(2)}/hr` }
        : { priceInUSDT: Number.isFinite(priceNum) ? priceNum : n.priceInUSDT, pricePerHour: priceStr ?? n.pricePerHour }
      if (n.id === FOUNDATION_GENESIS_NODE_ID) {
        if (genesisIgnited && !renter)
          return { ...n, ...applyPrice, status: "ONLINE_IDLE" as BadgeStatus, rentedBy: null }
        if (genesisIgnited && renter)
          return {
            ...n,
            ...applyPrice,
            status: (isLocked ? "LOCKED" : "OCCUPIED") as BadgeStatus,
            rentedBy: renter,
            ...(isLocked && lockMeta
              ? { lifecycleStatus: "LOCKED" as NodeLifecycleStatus, lock_metadata: lockMeta }
              : {}),
          }
        if (!genesisIgnited)
          return { ...n, ...applyPrice, status: "STANDBY" as BadgeStatus, rentedBy: null }
      }
      if (renter) {
        return {
          ...n,
          ...applyPrice,
          rentedBy: renter,
          status: (isLocked ? "LOCKED" : "OCCUPIED") as BadgeStatus,
          ...(isLocked && lockMeta
            ? { lifecycleStatus: "LOCKED" as NodeLifecycleStatus, lock_metadata: lockMeta }
            : {}),
        }
      }
      return { ...n, ...applyPrice, rentedBy: renter ?? n.rentedBy }
    })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setNodesLoading(true)
      try {
        const list = await fetchNodes()
        if (!cancelled) {
          const raw = list.length > 0 ? list : buildNodesFromRegistry(nodeToMiner, nodeRentals, nodePrices, nodeBandwidth, nodeLifecycle, nodeLockMetadata)
          setNodes(mergeWithPersisted(raw))
        }
      } catch {
        if (!cancelled) {
          const fromRegistry = buildNodesFromRegistry(nodeToMiner, nodeRentals, nodePrices, nodeBandwidth, nodeLifecycle, nodeLockMetadata)
          setNodes(mergeWithPersisted(fromRegistry))
        }
      } finally {
        if (!cancelled) setNodesLoading(false)
      }
    }
    load()
    const t = setInterval(load, NODES_FETCH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [nodeToMiner, nodeRentals, nodePrices, nodeBandwidth, nodeLifecycle, nodeLockMetadata, genesisIgnited])

  const closeModal = useCallback(() => {
    setActionModal(null)
    setModalPhase("confirm")
    setProgressStep(null)
  }, [])

  const runDeploySequence = useCallback(
    (node: Node, gateway: string, port: number, expiresAt?: string, sessionKey?: string) => {
      const nodeId = node.id
      const address = walletAddress ?? ""
      setProgressStep("allocating")
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, status: "PENDING" as BadgeStatus } : n
        )
      )
      const t1 = setTimeout(() => {
        setProgressStep("syncing")
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId ? { ...n, status: "SYNCING" as BadgeStatus } : n
          )
        )
      }, ALLOCATE_MS)
      const t2 = setTimeout(() => {
        const isGenesis = nodeId === FOUNDATION_GENESIS_NODE_ID
        const utilization = isGenesis ? 18 : node.utilization
        setProgressStep("ready")
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  status: (isGenesis ? "OCCUPIED" : "ACTIVE") as BadgeStatus,
                  rentedBy: address,
                  gateway,
                  port,
                  utilization,
                }
              : n
          )
        )
        setModalPhase("done")
        setNodeRental(nodeId, address, expiresAt)
        onDeployComplete?.({
          id: nodeId,
          name: node.name,
          gpus: node.gpus,
          vram: node.vram,
          status: (isGenesis ? "OCCUPIED" : "ACTIVE") as BadgeStatus,
          utilization,
          gateway,
          port,
          session_key: sessionKey,
          expires_at: expiresAt,
          disconnected: false,
        })
      }, DEPLOY_DURATION_MS)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    },
    [walletAddress, onDeployComplete, setNodeRental]
  )

  const runUndeploySequence = useCallback(
    (nodeId: string, options?: { skipModal?: boolean; keepSession?: boolean }) => {
      const keepSession = options?.keepSession ?? false
      const skipModal = options?.skipModal ?? false
      const address = walletAddress ?? null
      setProgressStep("unbinding")
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, status: "SYNCING" as BadgeStatus } : n
        )
      )
      const t = setTimeout(() => {
        setProgressStep("unbound")
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  status: "ACTIVE" as BadgeStatus,
                  rentedBy: keepSession ? address : null,
                  gateway: undefined,
                  port: undefined,
                }
              : n
          )
        )
        if (!skipModal) setModalPhase("done")
        if (keepSession) {
          const lock = getLockMetadata(nodeId)
          const lockedAt = lock?.locked_at ?? new Date().toISOString()
          const periodEndIso = getCurrentPeriodEnd(lockedAt)
          setNodeSessionExpiresAt(nodeId, periodEndIso)
          setNodeSessionDisconnected(nodeId, true)
          onUndeployComplete?.(nodeId, { keepSession: true, expires_at: periodEndIso })
        } else {
          setNodeRental(nodeId, null)
          onUndeployComplete?.(nodeId)
        }
      }, UNDEPLOY_DURATION_MS)
      return () => clearTimeout(t)
    },
    [walletAddress, onUndeployComplete, setNodeRental, setNodeSessionExpiresAt, setNodeSessionDisconnected, getLockMetadata]
  )

  useEffect(() => {
    if (!triggerUndeployNodeId) {
      setLastTriggerUndeployId(null)
      return
    }
    if (triggerUndeployNodeId === lastTriggerUndeployId) return
    const node = nodes.find((n) => n.id === triggerUndeployNodeId)
    if (!node) return
    setLastTriggerUndeployId(triggerUndeployNodeId)
    setActionModal({ type: "undeploy", node })
    setModalPhase("confirm")
    setProgressStep(null)
    onUndeployModalOpen?.()
  }, [triggerUndeployNodeId, lastTriggerUndeployId, nodes, onUndeployModalOpen])


  const onConfirmDeploy = useCallback(async () => {
    if (!actionModal || actionModal.type !== "deploy") return
    const node = actionModal.node
    if (!publicKey) {
      toast.error("Wallet not connected")
      onRequireAuth?.()
      return
    }
    const walletAddr = publicKey.toBase58()
    const isAlpha01Admin = node.id === FOUNDATION_GENESIS_NODE_ID && isGenesisNode(walletAddr)

    if (isAlpha01Admin) {
      setDeployTxPending(true)
      const toastId = toast.loading("Igniting Alpha-01…")
      try {
        const assignRes = await fetch("/api/deploy/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: node.id,
            renterWalletAddress: walletAddr,
            transactionSignature: "genesis-ignite",
          }),
        })
        const data = await assignRes.json().catch(() => ({})) as { error?: string; code?: string; gateway?: string; port?: number; session_key?: string }
        if (assignRes.status === 409) {
          setGenesisIgnited(true)
          toast.success("Alpha-01 is already ignited.")
          closeModal()
          toast.dismiss(toastId)
          setDeployTxPending(false)
          return
        }
        if (!assignRes.ok) {
          throw new Error(data.error || "Ignition failed")
        }
        setGenesisIgnited(true)
        const gateway = data.gateway ?? "alpha01.ngrid.xyz"
        const port = typeof data.port === "number" ? data.port : 7890
        const genesisExpiresAt = data.expires_at ?? new Date(Date.now() + 3600000).toISOString()
        setModalPhase("in_progress")
        runDeploySequence(node, gateway, port, genesisExpiresAt, data.session_key)
      toast.success("Alpha-01 ignited. Deploying…")
        toast.dismiss(toastId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ignition failed"
        toast.error(msg)
        toast.dismiss(toastId)
      } finally {
        setDeployTxPending(false)
      }
      return
    }

    const X = node.priceInUSDT
    if (!Number.isFinite(X) || X <= 0) {
      toast.error("Invalid node price")
      return
    }

    setDeployTxPending(true)
    const toastId = toast.loading("Processing Web3 Payment...")

    try {
      // 95/5 split: minerAmount = X * 0.95, treasuryAmount = X * 0.05 (raw = X * 10^6, Math.floor)
      const totalRaw = usdtToRaw(X)
      const minerRaw = BigInt(Math.floor(Number(totalRaw) * 0.95))
      const treasuryRaw = totalRaw - minerRaw

      const payerATA = getAssociatedTokenAddressSync(
        usdtMint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
      const minerATA = getAssociatedTokenAddressSync(
        usdtMint,
        new PublicKey(node.minerWalletAddress),
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
      const treasuryATA = getAssociatedTokenAddressSync(
        usdtMint,
        treasuryPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      let balance = BigInt(0)
      try {
        const r = await connection.getTokenAccountBalance(payerATA)
        balance = BigInt(r.value.amount)
      } catch {
        toast.error("No USDT token account. Please add USDT to your wallet first.")
        toast.dismiss(toastId)
        setDeployTxPending(false)
        return
      }
      if (balance < totalRaw) {
        toast.error("Insufficient USDT balance")
        toast.dismiss(toastId)
        setDeployTxPending(false)
        return
      }

      const tx = new Transaction()

      const minerAccountInfo = await connection.getAccountInfo(minerATA)
      if (!minerAccountInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            minerATA,
            new PublicKey(node.minerWalletAddress),
            usdtMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }
      const treasuryAccountInfo = await connection.getAccountInfo(treasuryATA)
      if (!treasuryAccountInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            treasuryATA,
            treasuryPubkey,
            usdtMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }

      tx.add(
        createTransferInstruction(
          payerATA,
          minerATA,
          publicKey,
          minerRaw,
          [],
          TOKEN_PROGRAM_ID
        ),
        createTransferInstruction(
          payerATA,
          treasuryATA,
          publicKey,
          treasuryRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      )

      const sig = await sendTransaction(tx, connection, { skipPreflight: false })
      await connection.confirmTransaction(sig, "confirmed")

      const expectedHours = 1
      const hourlyPriceUsd = node.priceInUSDT ?? 0.59
      const assignRes = await fetch("/api/deploy/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          renterWalletAddress: publicKey.toBase58(),
          transactionSignature: sig,
          expected_hours: expectedHours,
          hourly_price_usd: hourlyPriceUsd,
        }),
      })
      if (!assignRes.ok) {
        const errBody = await assignRes.text()
        throw new Error(errBody || "Assign failed")
      }
      const assignData = (await assignRes.json()) as { gateway: string; port: number; session_key?: string; escrow_breakdown?: { expires_at: string }; expires_at?: string }
      const { gateway, port, session_key } = assignData
      const isRedeploy = getNodeSessionDisconnected(node.id)
      const expiresAt = isRedeploy
        ? (getNodeSessionExpiresAt(node.id) ?? assignData.expires_at ?? assignData.escrow_breakdown?.expires_at)
        : (assignData.expires_at ?? assignData.escrow_breakdown?.expires_at)

      setModalPhase("in_progress")
      runDeploySequence(node, gateway, port, expiresAt, session_key)
      toast.success("Deployment Successful! 5% fee routed to NeuroGrid Treasury.")
    } catch (e: unknown) {
      if (e instanceof TransactionExpiredBlockheightExceededError) {
        toast.error("Transaction expired. Please try again.")
      } else {
        const msg =
          e instanceof Error ? e.message : "Payment failed"
        toast.error(msg)
      }
      // Do not reveal connection details or move node to My Rented Nodes on failure
    } finally {
      toast.dismiss(toastId)
      setDeployTxPending(false)
    }
  }, [
    actionModal,
    publicKey,
    sendTransaction,
    connection,
    onRequireAuth,
    runDeploySequence,
    setGenesisIgnited,
    treasuryPubkey,
    usdtMint,
  ])

  const onConfirmUndeploy = useCallback(() => {
    if (!actionModal || actionModal.type !== "undeploy") return
    setModalPhase("in_progress")
    runUndeploySequence(actionModal.node.id, { keepSession: true })
  }, [actionModal, runUndeploySequence])

  const openDeployModal = useCallback(
    (node: Node) => {
      if (!isConnected) {
        onRequireAuth?.()
        return
      }
      setActionModal({ type: "deploy", node })
      setModalPhase("confirm")
      setProgressStep(null)
    },
    [isConnected, onRequireAuth]
  )

  useEffect(() => {
    if (!redeployNodeId || !onRedeployConsumed) return
    const node = nodes.find((n) => n.id === redeployNodeId)
    const isRedeploy = node && getNodeSessionDisconnected(redeployNodeId)
    if (node && (node.rentedBy === walletAddress || isRedeploy)) {
      openDeployModal(node)
      if (isRedeploy) toast.info("Redeploy — reconnect before session ends (no extra charge).")
      // Defer clear so parent re-render doesn't race with modal open
      const t = setTimeout(() => onRedeployConsumed(), 0)
      return () => clearTimeout(t)
    }
  }, [redeployNodeId, nodes, walletAddress, getNodeSessionDisconnected, onRedeployConsumed, openDeployModal])

  const openUndeployModal = useCallback((node: Node) => {
    setActionModal({ type: "undeploy", node })
    setModalPhase("confirm")
    setProgressStep(null)
  }, [])

  const onActionClick = useCallback(
    (node: Node) => {
      if (!isConnected) {
        onRequireAuth?.()
        return
      }
      if (node.status === "SYNCING" || node.status === "PENDING") return
      const isMyNode = walletAddress && node.rentedBy === walletAddress
      const isSessionDisconnected = getNodeSessionDisconnected(node.id)
      const isOthersNode = node.rentedBy !== null && !isMyNode
      if (isOthersNode) return
      if (isMyNode && isSessionDisconnected) {
        openDeployModal(node)
        return
      }
      if (isMyNode && hoverUndeployId === node.id) {
        openUndeployModal(node)
      } else if (node.rentedBy === null) {
        if (node.id === FOUNDATION_GENESIS_NODE_ID) {
          if (genesisIgnited) {
            openDeployModal(node)
          } else if (isGenesisNode(walletAddress ?? undefined)) {
            openDeployModal(node)
          } else {
            setGenesisComingSoonOpen(true)
          }
          return
        }
        openDeployModal(node)
      }
    },
    [isConnected, walletAddress, hoverUndeployId, genesisIgnited, getNodeSessionDisconnected, onRequireAuth, openDeployModal, openUndeployModal]
  )

  const activeCount = nodes.filter((n) => n.status === "ACTIVE").length

  return (
    <div
      className="flex flex-col overflow-hidden border border-border"
      style={{ backgroundColor: "var(--terminal-bg)" }}
    >
      <div
        className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2"
        style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
      >
        <span className="text-xs uppercase tracking-wider" style={{ color: "#00cc33" }}>
          Node Command Center
        </span>
        <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
          {nodesLoading ? "Loading…" : `${activeCount}/${nodes.length} running`}
        </span>
      </div>

      <div
        className="overflow-y-auto overflow-x-hidden p-3"
        style={{ height: "400px" }}
      >
        {nodesLoading ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 py-12"
            style={{ color: "rgba(0,255,65,0.5)" }}
          >
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs">Loading nodes…</p>
          </div>
        ) : nodes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center"
            style={{ color: "rgba(0,255,65,0.5)" }}
          >
            <p className="text-xs">
              No nodes on sale. Miners register GPUs via Miner Portal → Node Onboarding; registered nodes appear here when the backend lists them.
            </p>
          </div>
        ) : (
        <div
          className="flex flex-col gap-3"
          style={{ borderColor: "rgba(0,255,65,0.08)" }}
        >
          {nodes.map((node, index) => {
            const rank = index + 1
            const isElite30 = rank <= 30
            const isFoundationNode = node.id === FOUNDATION_GENESIS_NODE_ID && (node.isFoundationSeed ?? isGenesisNode(node.minerWalletAddress))
            const isLockedByOther = node.rentedBy != null && node.rentedBy !== walletAddress
            return (
            <div
              key={node.id}
              className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto] items-start gap-x-4 gap-y-1 rounded border px-4 py-3 relative"
              style={{
                minHeight: "72px",
                borderColor: isElite30 ? "rgba(255,200,0,0.5)" : "rgba(0,255,65,0.2)",
                backgroundColor: isElite30 ? "rgba(255,200,0,0.04)" : "rgba(0,255,65,0.02)",
                boxShadow: isElite30 ? "0 0 20px rgba(255,200,0,0.15), inset 0 0 0 1px rgba(255,200,0,0.12)" : undefined,
              }}
            >
              {isElite30 && (
                <span
                  className={rank === 1 ? "ranked-1-badge" : ""}
                  style={{
                    position: "absolute",
                    top: "-0.375rem",
                    right: "0.75rem",
                    padding: "0.125rem 0.5rem",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    backgroundColor: "rgba(255,200,0,0.25)",
                    color: "#ffc800",
                    border: "1px solid rgba(255,200,0,0.6)",
                    boxShadow: rank === 1 ? "0 0 16px rgba(255,200,0,0.6), 0 0 24px rgba(255,200,0,0.3)" : "0 0 10px rgba(255,200,0,0.3)",
                  }}
                  title="Genesis 100 Elite — Top 30 get Lifetime 2% Fee status"
                >
                  Ranked #{rank}
                </span>
              )}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className="text-base font-semibold"
                  style={{ color: node.isGenesis ? "#00FFFF" : "#00FF41" }}
                >
                  {node.name}
                </span>
                {node.isGenesis && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: "rgba(0,255,255,0.1)",
                      color: "#00FFFF",
                      border: "1px solid rgba(0,255,255,0.3)",
                    }}
                  >
                    GENESIS
                  </span>
                )}
                {(node.isFoundationSeed ?? isGenesisNode(node.minerWalletAddress)) && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: "rgba(0,255,65,0.12)",
                      color: "#00FF41",
                      border: "1px solid rgba(0,255,65,0.4)",
                    }}
                    title="Official Foundation Seed Node"
                  >
                    [FOUNDATION GENESIS]
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  {(node.status === "LOCKED" || node.lifecycleStatus === "LOCKED") && (
                    <LockKeyhole
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "#ffa500" }}
                      aria-label="Locked"
                      title="Node locked — tenant pays locked price until undeploy"
                    />
                  )}
                  <StatusBadge status={node.status} />
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-3 font-mono text-xs" style={{ color: "rgba(0,255,65,0.8)" }}>
                <span className="w-8 shrink-0 text-right font-medium" style={{ color: node.isGenesis ? "#00FFFF" : "#00FF41" }}>
                  {node.utilization}%
                </span>
                <div className="min-w-0 flex-1" style={{ maxWidth: "80px" }}>
                  <GpuBar value={node.utilization} color={node.isGenesis ? "#00FFFF" : "#00FF41"} hideLabel pulseWhenIdle={node.status === "ONLINE_IDLE" && node.utilization === 0} />
                </div>
                <span className="text-[10px]" style={{ color: "rgba(0,255,65,0.65)" }}>
                  • {node.gpus} {node.vram} • {node.pricePerHour} • Earned {getDisplayEarnedNrg(node.id).toFixed(1)} NRG
                </span>
              </div>
              <div className="row-span-2 flex items-start pt-0.5">
                {node.status === "PENDING" ? (
                  <span
                    className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded opacity-80"
                    style={{ color: "#ffc800" }}
                    title="Pending tunnel verification — not rentable until backend confirms physical link and tunnel"
                    aria-label="Pending verification"
                  >
                    <Lock className="h-5 w-5" />
                  </span>
                ) : node.status === "SYNCING" ? (
                  <button
                    type="button"
                    disabled
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded transition-opacity"
                    style={{ color: "#ffc800" }}
                    aria-label="In progress"
                    title="In progress..."
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="h-5 w-5" />
                    </motion.div>
                  </button>
                ) : !isConnected ? (
                  <button
                    type="button"
                    onClick={() => onActionClick(node)}
                    className="flex h-9 shrink-0 items-center justify-center rounded px-3 text-[10px] font-bold uppercase tracking-wider transition-all hover:opacity-90"
                    style={{ backgroundColor: "rgba(0,255,65,0.1)", color: "#00FF41", border: "1px solid rgba(0,255,65,0.4)" }}
                    aria-label="Connect to rent"
                    title="Connect to rent this worker"
                  >
                    Rent Now
                  </button>
                ) : node.rentedBy !== null && node.rentedBy !== walletAddress ? (
                  <span
                    className="flex h-9 shrink-0 items-center justify-center rounded px-2 text-[10px] font-bold uppercase tracking-wider opacity-80"
                    style={{ color: "rgba(255,165,0,0.9)" }}
                    title="Node in use — monitoring only"
                  >
                    MONITORING
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onActionClick(node)}
                    onMouseEnter={() =>
                      node.rentedBy === walletAddress && !getNodeSessionDisconnected(node.id) && setHoverUndeployId(node.id)
                    }
                    onMouseLeave={() => setHoverUndeployId(null)}
                    className="flex h-9 shrink-0 items-center justify-center rounded px-2 transition-all hover:opacity-90"
                    style={{
                      color:
                        node.rentedBy === walletAddress
                          ? getNodeSessionDisconnected(node.id)
                            ? "#00FFFF"
                            : hoverUndeployId === node.id
                              ? "#ff4444"
                              : "#00FF41"
                          : node.id === FOUNDATION_GENESIS_NODE_ID
                            ? "#00FFFF"
                            : node.isGenesis
                              ? "#00FFFF"
                              : "rgba(0,255,65,0.8)",
                    }}
                    aria-label={
                      node.rentedBy === walletAddress
                        ? getNodeSessionDisconnected(node.id)
                          ? "Redeploy"
                          : hoverUndeployId === node.id
                            ? "Undeploy"
                            : "Active"
                        : node.id === FOUNDATION_GENESIS_NODE_ID && !genesisIgnited
                          ? isGenesisNode(walletAddress ?? undefined)
                            ? "COMMAND: IGNITE"
                            : "Request Genesis access"
                          : "Rent"
                    }
                    title={
                      node.rentedBy === walletAddress
                        ? getNodeSessionDisconnected(node.id)
                          ? "Redeploy (session active until expiry)"
                          : hoverUndeployId === node.id
                            ? "Undeploy"
                            : "Active — hover to undeploy"
                        : node.id === FOUNDATION_GENESIS_NODE_ID && !genesisIgnited
                          ? isGenesisNode(walletAddress ?? undefined)
                            ? "Ignite Alpha-01 (Foundation)"
                            : "Request Genesis access (whitelist)"
                          : "Rent node"
                    }
                  >
                    {node.rentedBy === walletAddress ? (
                      getNodeSessionDisconnected(node.id) ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider">Redeploy</span>
                      ) : hoverUndeployId === node.id ? (
                        <X className="h-5 w-5" />
                      ) : (
                        <motion.span
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Circle className="h-3 w-3 fill-current" />
                        </motion.span>
                      )
                    ) : node.id === FOUNDATION_GENESIS_NODE_ID && !genesisIgnited ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {isGenesisNode(walletAddress ?? undefined) ? "COMMAND: IGNITE" : "REQUEST GENESIS ACCESS"}
                      </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider">Rent Now</span>
                )}
                  </button>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSpecs(node.id)}
                  className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px]"
                  style={{ borderColor: "rgba(0,255,65,0.18)", color: "rgba(0,255,65,0.6)" }}
                >
                  {showSpecsIds.has(node.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showSpecsIds.has(node.id) ? "Details" : "Details"}
                </button>
              </div>
              {showSpecsIds.has(node.id) && (
                <div
                  className="col-span-full mt-2 min-w-0 rounded border px-3 py-2 font-mono text-xs"
                  style={{
                    borderColor: "rgba(0,255,65,0.2)",
                    backgroundColor: "rgba(0,255,65,0.04)",
                    color: "rgba(0,255,65,0.75)",
                  }}
                >
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {(node.isFoundationSeed ?? isGenesisNode(node.minerWalletAddress)) && (
                      <>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>Provider</span>
                        <span style={{ color: "rgba(0,255,65,0.9)" }}>NeuroGrid Foundation</span>
                      </>
                    )}
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>Bandwidth</span>
                    <span>{node.bandwidth}</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>Tunnel</span>
                    <span>[Encrypted Tunnel Ready]</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>Status</span>
                    <span>Idle</span>
                  </div>
                  {(node.isFoundationSeed ?? isGenesisNode(node.minerWalletAddress)) && node.id === FOUNDATION_GENESIS_NODE_ID && (
                    <p className="mt-2 border-t pt-2 text-[10px] leading-snug" style={{ borderColor: "rgba(0,255,65,0.15)", color: "rgba(0,255,65,0.5)" }}>
                      {ALPHA01_DESCRIPTION}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
          })}
        </div>
        )}
      </div>

      {/* Deploy / Undeploy confirmation & progress modal */}
      <Dialog
        open={!!actionModal}
        onOpenChange={(open) => {
          if (!open && (modalPhase === "confirm" || modalPhase === "done")) closeModal()
        }}
      >
        <DialogContent
          className="border"
          style={{
            backgroundColor: "var(--terminal-bg)",
            borderColor: "rgba(0,255,65,0.3)",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
              {actionModal?.type === "deploy"
                ? "Confirm Deploy"
                : "Confirm Undeploy"}
              {actionModal?.node && (
                <span className="ml-2 font-mono" style={{ color: "rgba(0,255,65,0.7)" }}>
                  {actionModal.node.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {modalPhase === "confirm" && actionModal && (
            <div className="space-y-4">
              {actionModal.type === "deploy" ? (
                <>
                  <div
                    className="flex items-center gap-2 rounded border px-3 py-2"
                    style={{ borderColor: "rgba(0,255,65,0.35)", backgroundColor: "rgba(0,255,65,0.06)" }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
                      Epoch 0 Tester: Earn 2x $NRG Points for this session.
                    </span>
                  </div>
                  {(actionModal.node.isFoundationSeed ?? isGenesisNode(actionModal.node.minerWalletAddress)) && (
                    <p className="text-xs" style={{ color: "#00FF41" }}>
                      Provider: NeuroGrid Foundation · <span style={{ fontWeight: 700 }}>[FOUNDATION GENESIS]</span>
                    </p>
                  )}
                  {(actionModal.node.isFoundationSeed ?? isGenesisNode(actionModal.node.minerWalletAddress)) && actionModal.node.id === FOUNDATION_GENESIS_NODE_ID && (
                    <p className="text-[10px]" style={{ color: "rgba(0,255,65,0.6)" }}>
                      {ALPHA01_DESCRIPTION}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: "rgba(0,255,65,0.6)" }}>
                    Confirm you want to deploy to this node. Payment in USDT: 95% to miner, 5% to protocol treasury.
                  </p>
                  <div
                    className="flex flex-col items-center gap-2 border p-4"
                    style={{
                      borderColor: "rgba(0,255,65,0.2)",
                      backgroundColor: "rgba(0,255,65,0.03)",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs" style={{ color: "#00FF41" }}>
                      <span className="flex items-center gap-1">Usage <TrendingUp className="h-3.5 w-3.5" /></span>
                      <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "rgba(0,255,65,0.5)" }} />
                      <span className="flex items-center gap-1">Buyback <TrendingUp className="h-3.5 w-3.5" /></span>
                      <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "rgba(0,255,65,0.5)" }} />
                      <span className="flex items-center gap-1">Floor Price <TrendingUp className="h-3.5 w-3.5" /></span>
                    </div>
                    <p className="text-[10px]" style={{ color: "rgba(0,255,65,0.5)" }}>
                      100% of Protocol Fees (5%) → Buyback Engine → $NRG Floor Price Appreciation
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onConfirmDeploy()}
                      disabled={deployTxPending}
                      className="flex-1 border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ borderColor: "#00FF41", color: "#00FF41" }}
                    >
                      {deployTxPending ? (
                        <>
                          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                          {(actionModal.node.id === FOUNDATION_GENESIS_NODE_ID && isGenesisNode(actionModal.node.minerWalletAddress)) ? "Igniting…" : "Paying…"}
                        </>
                      ) : (
                        (actionModal.node.id === FOUNDATION_GENESIS_NODE_ID && isGenesisNode(actionModal.node.minerWalletAddress)) ? "COMMAND: IGNITE" : "Confirm Deploy"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-xs uppercase tracking-wider"
                      style={{ color: "rgba(0,255,65,0.5)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs" style={{ color: "rgba(0,255,65,0.6)" }}>
                    After disconnect, status becomes Disconnected and reclaim time aligns to the current billing period. Unrenewed sessions are reclaimed automatically. You can Redeploy anytime before expiry at no extra charge.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onConfirmUndeploy}
                      className="flex-1 border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
                      style={{ borderColor: "#ff4444", color: "#ff4444" }}
                    >
                      Confirm Undeploy
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-xs uppercase tracking-wider"
                      style={{ color: "rgba(0,255,65,0.5)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {modalPhase === "in_progress" && actionModal && (
            <div className="flex flex-col items-center gap-4 py-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-10 w-10" style={{ color: "#ffc800" }} />
              </motion.div>
              <p className="text-sm font-medium uppercase tracking-wider" style={{ color: "#00FF41" }}>
                {actionModal.type === "deploy"
                  ? progressStep === "allocating"
                    ? "Allocating tunnel..."
                    : progressStep === "syncing"
                      ? (actionModal.node.id === FOUNDATION_GENESIS_NODE_ID ? "Booting..." : "Syncing node...")
                      : "Preparing..."
                  : "Unbinding..."}
              </p>
              <p className="text-xs" style={{ color: "rgba(0,255,65,0.5)" }}>
                {actionModal.node.name} — please wait
              </p>
            </div>
          )}

          {modalPhase === "done" && actionModal && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-12 w-12" style={{ color: "#00FF41" }} />
              <p className="text-sm font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
                {actionModal.type === "deploy"
                  ? (actionModal.node.id === FOUNDATION_GENESIS_NODE_ID ? "Live" : "Ready")
                  : "Unbind complete"}
              </p>
              <p className="text-xs" style={{ color: "rgba(0,255,65,0.5)" }}>
                {actionModal.type === "deploy"
                  ? (actionModal.node.id === FOUNDATION_GENESIS_NODE_ID
                      ? "Alpha-01 is live. Utilization bar active. You can close this dialog."
                      : "Node is ready. You can close this dialog.")
                  : "Access released. You can close this dialog."}
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
                style={{ borderColor: "#00FF41", color: "#00FF41" }}
              >
                Close
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Coming Soon: Genesis Ignition — when non-Admin clicks Alpha-01 */}
      <Dialog open={genesisComingSoonOpen} onOpenChange={setGenesisComingSoonOpen}>
        <DialogContent
          className="border"
          style={{
            backgroundColor: "var(--terminal-bg)",
            borderColor: "rgba(0,255,255,0.3)",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider" style={{ color: "#00FFFF" }}>
              Coming Soon: Genesis Ignition
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs" style={{ color: "rgba(0,255,255,0.7)" }}>
            Alpha-01 is the Foundation Seed Node. Access is whitelist-only until Genesis ignition. Join the waitlist to be notified.
          </p>
          <a
            href={process.env.NEXT_PUBLIC_GENESIS_WAITLIST_URL || "https://discord.gg"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
            style={{ borderColor: "#00FFFF", color: "#00FFFF" }}
          >
            Join Genesis Waitlist
          </a>
          <button
            type="button"
            onClick={() => setGenesisComingSoonOpen(false)}
            className="text-xs uppercase tracking-wider"
            style={{ color: "rgba(0,255,255,0.5)" }}
          >
            Close
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
