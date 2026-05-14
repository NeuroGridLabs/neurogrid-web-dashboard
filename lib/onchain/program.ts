import { AnchorProvider, Program } from "@coral-xyz/anchor"
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"
import type { Neurogrid } from "./neurogrid"
import idl from "./neurogrid.idl.json"

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com"

const connection = new Connection(RPC_URL, "confirmed")

const dummyKeypair = Keypair.generate()

const readOnlyWallet = {
  publicKey: dummyKeypair.publicKey as PublicKey,
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    throw new Error("readOnlyWallet cannot sign — server-side reads only")
  },
  async signAllTransactions<T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> {
    throw new Error("readOnlyWallet cannot sign — server-side reads only")
  },
}

const provider = new AnchorProvider(connection, readOnlyWallet, {
  commitment: "confirmed",
  skipPreflight: false,
})

export const program = new Program<Neurogrid>(idl as Neurogrid, provider)

export const PROGRAM_ID = program.programId

export { connection }
