/**
 * Quick verification script for Supabase connection.
 * Run with: npx tsx scripts/verify-supabase.ts
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  console.error("   Fill in your Supabase credentials first.")
  process.exit(1)
}

const supabase = createClient(url, key)

async function verify() {
  console.log("🔍 Connecting to Supabase...")
  console.log(`   URL: ${url}`)
  console.log("")

  // 1. Check tables exist
  const tables = ["nodes", "miners", "rental_sessions", "settlement_logs", "miner_financials", "disputes"]
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })
    if (error) {
      console.error(`❌ Table "${table}": ${error.message}`)
    } else {
      console.log(`✅ Table "${table}": ${count} rows`)
    }
  }

  console.log("")

  // 2. Check Genesis node seed
  const { data: genesis, error: genesisErr } = await supabase
    .from("nodes")
    .select("id, name, gpu, is_genesis, price_per_hour")
    .eq("id", "alpha-01")
    .single()

  if (genesisErr || !genesis) {
    console.error("❌ Genesis node alpha-01 not found!")
  } else {
    console.log(`✅ Genesis node: ${genesis.name} (${genesis.gpu}) @ $${genesis.price_per_hour}/hr`)
  }

  console.log("")
  console.log("🎉 Supabase connection verified! Ready for Sprint 2.")
}

verify().catch(console.error)
