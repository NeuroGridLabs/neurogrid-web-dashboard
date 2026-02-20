# lib — 共享逻辑与类型

工程化约定：业务无关的工具、类型、上下文和 API 封装集中在此目录。

## 目录说明

| 路径 | 用途 |
|------|------|
| **contexts/** | React 上下文与 Provider：认证、钱包、角色、矿机注册。入口：`contexts/index.ts`。 |
| **providers/** | Solana / 钱包 Provider 封装（ConnectionProvider、DedupeWalletProvider 等）。入口：`providers/index.ts`。 |
| **types/** | 共享 TypeScript 类型与生命周期常量。`types/index.ts` 为 barrel，可从 `@/lib/types` 统一导入。 |
| **lifecycle/** | 预付费托管、结算、双池收益等协议逻辑。入口：`lifecycle/index.ts`。 |
| **utils.ts** | 通用工具（如 `cn`）。 |
| **api-auth.ts** | 服务端请求鉴权（Cookie 等）。 |
| **solana-constants.ts** | Solana 网络、国库、USDT 等常量。 |
| **genesis-node.ts** | Genesis 节点 ID 等常量。 |
| **treasury-api.ts** | 国库余额等 API 调用。 |

## 导入建议

- 上下文：`import { useAuth, useWallet, WalletProvider, ... } from '@/lib/contexts'`
- Provider：`import { SolanaProviders } from '@/lib/providers'`
- 类型：`import type { Node } from '@/lib/types'` 或 `import type { Node } from '@/lib/types/node'`
- 工具：`import { cn } from '@/lib/utils'`
- 生命周期：`import { ... } from '@/lib/lifecycle'`
