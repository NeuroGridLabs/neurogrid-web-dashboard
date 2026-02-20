# 项目重命名重构 — 更改清单

**目标**：将项目名称从 `neurogrid-ai-protocol` 统一为 `neurogrid-web-dashboard`。

**执行时间**：2025-02-21

---

## 1. 扫描结果摘要

- **全库搜索**：在整个项目（含源码、配置、文档）中搜索了以下内容：
  - `neurogrid-ai-protocol`（文件名、目录名、文件内容）
  - `neurogrid_ai_protocol`、`NEUROGRID_AI_PROTOCOL`（含大小写不敏感）
- **结论**：**未发现任何 “neurogrid-ai-protocol” 的引用。**  
  仓库/工作区名称已为 `neurogrid-web-dashboard`，代码与配置中从未出现旧项目名。

- **占位名称**：发现 `package.json` 与 `package-lock.json` 中使用的是占位名称 **`my-project`**，已按新项目名更新。

---

## 2. 已执行的修改

| 文件 | 修改内容 |
|------|----------|
| **package.json** | `"name": "my-project"` → `"name": "neurogrid-web-dashboard"`；新增 `"description": "NeuroGrid protocol web dashboard for miners and tenants"` |
| **package-lock.json** | 两处 `"name": "my-project"` → `"name": "neurogrid-web-dashboard"`（根级与 `packages."".name`） |

---

## 3. 已检查且无需修改的位置

| 位置 | 说明 |
|------|------|
| **vercel.json** | 仅有 `installCommand`，无 `name` 或项目标识，无需改。 |
| **next.config.mjs** | 无项目名或路径别名与项目名绑定，无需改。 |
| **tsconfig.json** | 路径别名为 `@/*` → `./*`，与项目名无关，无需改。 |
| **env.example / .env*** | 无 `NEUROGRID_AI_PROTOCOL_*` 或类似前缀；现有变量为通用名（如 `NEXT_PUBLIC_*`、`TREASURY_*`），无需改。 |
| **README** | 项目根目录未发现 README.md；仅存在 `docs/whitepaper-technical-revision-v1.1.md`，其中无旧项目名或 `my-project`。 |
| **目录/文件名** | 未发现包含 `neurogrid-ai-protocol` 的目录或文件名，无需 `git mv`。 |

---

## 4. 刻意保留、未改动的引用（产品/品牌/存储键）

以下内容属于 **产品名 “NeuroGrid”** 或 **本地存储/会话键**，与仓库名 “neurogrid-ai-protocol” 无关，**未做替换**，以避免破坏现有用户数据或品牌一致性：

- **Cookie / Storage 键**  
  `neurogrid_auth_method`、`neurogrid-auth-method`、`neurogrid-miner-registry`、`neurogrid-miner-rentals`、`neurogrid-dashboard-role`、`neurogrid-rented-snapshots` 等（见 `lib/api-auth.ts`、`lib/contexts/`、`app/nodes/page.tsx`）。
- **下载文件名**  
  `neurogrid-genesis-alpha01-tunnel.toml`、`neurogrid-miner-tunnel.toml`（`app/miner/page.tsx`）。
- **资源与链接**  
  `/images/neurogrid-logo.png`、`https://docs.neurogridprotocol.io`（navbar、footer、header、layout）。
- **终端提示等 UI 文案**  
  `neurogrid@alpha-01:~`（smart-terminal）。

若将来希望将上述键名或文件名也统一为 “neurogrid-web-dashboard” 前缀，需注意：**修改 storage/cookie 键会清空或失效已有用户本地数据**，建议带数据迁移或版本兼容逻辑。

---

## 5. 功能与部署注意事项

- **动态路由 / API 路径**：未发现基于 `neurogrid-ai-protocol` 或 `my-project` 的路由或 API 路径，无需变更，也无需额外回归。
- **构建与安装**：仅修改了 package 的 `name` 和 `description`，未改动 scripts、依赖或构建配置；`npm install` / `pnpm install` 及 `next build` 行为不变。
- **版本控制**：建议在确认无误后提交本次修改；若有备份或分支，可随时回滚。

---

## 6. 建议的后续操作（可选）

1. **README**：若新增根目录 `README.md`，标题与描述可使用 “NeuroGrid Web Dashboard” 或 “neurogrid-web-dashboard”。  
2. **CI / 部署**：若 CI 或部署脚本中有写死 `my-project` 或仓库名，可一并改为 `neurogrid-web-dashboard`。  
3. **本清单**：已移入 `docs/` 归档，便于与 `REFACTOR-ENGINEERING.md` 一起查阅。

---

**变更文件列表（便于 review）**  
- `package.json`  
- `package-lock.json`  
- `docs/REFACTOR-CHANGELOG.md`（本文件）
