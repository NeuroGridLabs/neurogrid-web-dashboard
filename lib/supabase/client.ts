import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./types"

/**
 * Browser-side Supabase client — singleton per tab.
 * Uses NEXT_PUBLIC_* env vars exposed to the client bundle.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
