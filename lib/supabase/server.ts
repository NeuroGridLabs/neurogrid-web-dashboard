import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type {
  MinerRow,
  NodeRow,
  RentalSessionRow,
  SettlementLogRow,
  MinerFinancialsRow,
  DisputeRow,
  SettlementErrorRow,
  MinerInsert,
  RentalSessionInsert,
  SettlementLogInsert,
  MinerFinancialsInsert,
  DisputeInsert,
  SettlementErrorInsert,
} from "./types"

/**
 * Server-side Supabase client for API routes and Server Components.
 * Reads/writes cookies for Supabase Auth session management.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll can throw in Server Components (read-only context).
          }
        },
      },
    },
  )
}

/**
 * Typed admin DB client — bypasses RLS with service_role key.
 * Only use in trusted server-side contexts (API routes, cron jobs).
 *
 * Returns a lightweight wrapper around Supabase client with typed table helpers.
 */
export function createAdminClient() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  return {
    /** Raw supabase client for custom queries */
    raw: client,
    from: <T extends keyof TableMap>(table: T) => client.from(table) as unknown as TypedTable<TableMap[T]>,
  }
}

/* ── Typed table helpers ─────────────────────────────────── */

interface TableDef<Row, Ins> {
  Row: Row
  Insert: Ins
}

interface TableMap {
  miners: TableDef<MinerRow, MinerInsert>
  nodes: TableDef<NodeRow, never>
  rental_sessions: TableDef<RentalSessionRow, RentalSessionInsert>
  settlement_logs: TableDef<SettlementLogRow, SettlementLogInsert>
  miner_financials: TableDef<MinerFinancialsRow, MinerFinancialsInsert>
  disputes: TableDef<DisputeRow, DisputeInsert>
  settlement_errors: TableDef<SettlementErrorRow, SettlementErrorInsert>
}

/**
 * Minimal typed interface matching Supabase PostgREST query builder.
 * We only type the methods we actually use to avoid fighting the SDK generics.
 */
interface TypedTable<T extends TableDef<unknown, unknown>> {
  select(columns: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): TypedSelectBuilder<T["Row"]>
  insert(values: T["Insert"] | T["Insert"][], options?: Record<string, unknown>): TypedSelectBuilder<T["Row"]>
  update(values: Partial<T["Row"]>): TypedFilterBuilder<T["Row"]>
  delete(): TypedFilterBuilder<T["Row"]>
}

interface TypedSelectBuilder<Row> {
  select(columns?: string): TypedSelectBuilder<Row>
  eq(column: string, value: unknown): TypedSelectBuilder<Row>
  neq(column: string, value: unknown): TypedSelectBuilder<Row>
  lt(column: string, value: unknown): TypedSelectBuilder<Row>
  lte(column: string, value: unknown): TypedSelectBuilder<Row>
  gt(column: string, value: unknown): TypedSelectBuilder<Row>
  gte(column: string, value: unknown): TypedSelectBuilder<Row>
  in(column: string, values: readonly unknown[]): TypedSelectBuilder<Row>
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): TypedSelectBuilder<Row>
  limit(count: number): TypedSelectBuilder<Row>
  single(): Promise<{ data: Row | null; error: PostgrestError | null }>
  maybeSingle(): Promise<{ data: Row | null; error: PostgrestError | null }>
  then: Promise<{ data: Row[] | null; error: PostgrestError | null; count: number | null }>["then"]
}

interface TypedFilterBuilder<Row> {
  eq(column: string, value: unknown): TypedFilterBuilder<Row>
  neq(column: string, value: unknown): TypedFilterBuilder<Row>
  select(columns?: string): TypedSelectBuilder<Row>
  single(): Promise<{ data: Row | null; error: PostgrestError | null }>
  then: Promise<{ data: Row[] | null; error: PostgrestError | null }>["then"]
}

interface PostgrestError {
  message: string
  details: string
  hint: string
  code: string
}

/* Re-export types for convenience */
export type {
  MinerRow,
  NodeRow,
  RentalSessionRow,
  SettlementLogRow,
  MinerFinancialsRow,
  DisputeRow,
} from "./types"
