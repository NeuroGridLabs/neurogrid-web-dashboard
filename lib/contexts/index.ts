/**
 * React contexts barrel. Use for layout/provider composition:
 * import { WalletProvider, AuthProvider, RoleProvider, MinerRegistryProvider } from '@/lib/contexts'
 * Or import hooks from specific modules: import { useAuth } from '@/lib/contexts/auth-context'
 */

export { AuthProvider, useAuth, type AuthMethod } from "./auth-context"
export { WalletProvider, useWallet } from "./wallet-context"
export { RoleProvider, useRole, type DashboardRole } from "./role-context"
export {
  MinerRegistryProvider,
  useMinerRegistry,
  MINER_REGISTRY_STORAGE_KEYS,
  REGISTRABLE_NODE_IDS,
  NODE_DISPLAY_NAMES,
  NODE_GPU_MAP,
  NODE_VRAM_MAP,
} from "./miner-registry-context"
