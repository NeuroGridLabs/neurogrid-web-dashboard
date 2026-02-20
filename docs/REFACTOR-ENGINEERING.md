# 工程化重构说明

在不改变业务逻辑与 UI 的前提下，对仓库做了以下规整，便于后续维护与协作。

## 1. 已完成的变更

### 1.1 删除冗余与未使用代码

| 变更 | 说明 |
|------|------|
| **删除 `styles/globals.css`** | 项目仅使用 `app/globals.css`，该文件未被引用，避免两套全局样式混淆。 |
| **删除 `components/modules/header.tsx`** | 全项目未引用；统一使用 `components/layout/navbar.tsx` 作为顶栏。 |
| **统一 Toast 实现** | `components/ui/use-toast.ts` 改为从 `@/hooks/use-toast` 的 re-export，逻辑仅保留在 `hooks/use-toast.ts`，避免重复实现。 |

### 1.2 命名与路径规范

| 变更 | 说明 |
|------|------|
| **`app/miner/MinerRouteGuard.tsx` → `app/miner/miner-route-guard.tsx`** | 与项目内 kebab-case 文件命名一致；`app/miner/layout.tsx` 已改为从 `./miner-route-guard` 导入。 |

### 1.3 类型与目录结构

| 变更 | 说明 |
|------|------|
| **新增 `lib/types/index.ts`** | 统一导出 `node`、`escrow` 类型及生命周期常量，支持 `import type { Node, RentalSession } from '@/lib/types'`；原有 `@/lib/types/node`、`@/lib/types/escrow` 仍可使用。 |
| **新增 `lib/README.md`** | 说明 `lib` 下各文件/目录职责与推荐导入方式。 |

## 2. 未改动的部分（保持逻辑与 UI 一致）

- **API 路由**：`app/api/*` 路径与实现未改。
- **页面与布局**：`app/**/page.tsx`、`app/layout.tsx`、`app/miner/layout.tsx` 仅做上述导入路径调整，无逻辑与 UI 变更。
- **组件**：除删除未使用的 `header.tsx` 与 `use-toast` 收敛外，其余组件未改。
- **样式**：仍以 `app/globals.css` + Tailwind + 内联 style 为主，未引入 CSS Modules 或新体系。
- **Context / Provider**：未移动文件，未改导出路径；仅补充了 `lib` 的说明文档。

## 3. 建议本地自检

1. **安装与构建**：`npm install && npm run build`
2. **开发**：`npm run dev`，逐页点击：首页、Nodes、Miner、Billing、Auth 等，确认无报错、UI 与行为与重构前一致。
3. **Toast**：任意触发 toaster 的流程（如 Miner 控制台权限提示），确认 toaster 仍正常。

## 4. 第二阶段工程化（本次续做）

- **Tailwind 主题**：在 `tailwind.config.ts` 中扩展了 NeuroGrid 语义色：`page`、`terminal`、`neon`、`neon-cyan`、`neon-amber`，与 `app/globals.css` 中的 CSS 变量一致。落地页与 Admin 页的整页背景已改为 `bg-page`。
- **lib/contexts/**：将 `auth-context`、`wallet-context`、`role-context`、`miner-registry-context` 迁入 `lib/contexts/`，并新增 `lib/contexts/index.ts` barrel，统一从 `@/lib/contexts` 导入。
- **lib/providers/**：将 `solana-providers`、`dedupe-wallet-provider` 迁入 `lib/providers/`，并新增 `lib/providers/index.ts`，布局从 `@/lib/providers` 导入。
- 已删除原 `lib/` 根目录下的上述 6 个文件，并更新所有引用。

## 5. 清理与根目录规整（最新）

- **删除未使用组件**：`components/modules/protocol-metrics.tsx`、`components/modules/transparency-log.tsx`（无引用）。
- **删除重复 hook**：`components/ui/use-mobile.tsx` 与 `hooks/use-mobile.tsx` 内容一致，仅保留 `hooks/use-mobile.tsx`（`components/ui/sidebar.tsx` 已使用 `@/hooks/use-mobile`）。
- **文档归档**：根目录 `REFACTOR-CHANGELOG.md` 移入 `docs/REFACTOR-CHANGELOG.md`，与 `docs/REFACTOR-ENGINEERING.md` 一起便于查阅。
- **环境变量模板**：`env.example` 重命名为 `.env.example`（通用约定；`.gitignore` 已用 `!.env.example` 放行）。
- **文档索引**：新增 `docs/README.md`，列出 `docs/` 下各文档说明。

## 6. 后续可选的工程化方向

- 将其余重复的 inline style（如 `#00FF41`、`var(--terminal-bg)`）逐步替换为 Tailwind 类（如 `text-neon`、`bg-terminal`）。
- 在 `next.config` 中关闭 `ignoreBuildErrors`，逐步修复 TypeScript 错误，让构建强类型化。
