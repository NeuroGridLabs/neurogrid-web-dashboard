import { MinerRouteGuard } from "./miner-route-guard"

export default function MinerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MinerRouteGuard>{children}</MinerRouteGuard>
}
