# NeuroGrid Whitepaper V1.1 — Technical Revision Draft

**Purpose:** Technical chapter revisions for Claude integration. Aligns narrative with implementation and provides paste-ready copy plus a technical data sheet.

**Deadline reference:** 2025-02-21 10:00.

---

## 1. Technical Chapter Revision (Paste-Ready Copy)

### 1.1 Proprietary Tunnel Protocol — Technical Overview (100–150 words)

Use the following paragraph in Chapter 5 (or equivalent “Infrastructure / Network” section) where the private tunnel protocol is described:

---

**NeuroGrid Proprietary Zero-Trust Tunneling Protocol**

NeuroGrid uses a self-developed, zero-trust tunneling protocol to connect tenant workloads to miner hardware without exposing public IPs or ports. The protocol provides an enterprise-grade reverse-connection framework: miners run a lightweight client that establishes outbound, authenticated tunnels to the network core, reducing attack surface and improving NAT/firewall penetration. Design goals include low latency for interactive workloads, high connection success rate under diverse network conditions, and automatic reconnection with session continuity. Performance targets (based on Alpha testnet and internal benchmarks) include a tunnel establishment success rate of ≥99.5%, median RTT to gateway &lt;50 ms in typical regions, and support for thousands of concurrent tunnels per relay tier. The protocol is proprietary; implementation details are not disclosed. The system is designed to undergo periodic third-party security and penetration testing.

---

### 1.2 Terminology Consistency

- **Recommended canonical phrase:** “NeuroGrid proprietary zero-trust tunneling protocol” (or “NeuroGrid tunnel protocol” in short).
- **Avoid in public docs:** Naming of underlying OSS or third-party implementations; keep description at “self-developed,” “proprietary,” “enterprise reverse-connection framework.”

### 1.3 Section 5.4 — Miner Client: Hardware Fingerprint (Insert)

Add the following sentence in Section 5.4 (Miner Client / Node Onboarding), after describing the miner client and registration flow:

- **Insert:**  
  *“The miner client collects a hardware fingerprint from the host machine. This fingerprint is used to generate a unique node identity and to prevent Sybil attacks (one operator claiming multiple distinct nodes without distinct hardware).”*

Optional short form for UI/glossary:

- *“Hardware fingerprint: used to generate unique node identity and prevent Sybil attacks.”*

---

### 1.4 Appendix — Proof-of-Inference (Terminology / Technical Explanation)

Use the following for the appendix (glossary or “Key Concepts”):

---

**Proof-of-Inference (PoI)**

Proof-of-Inference is the mechanism by which the protocol verifies that a tenant’s workload actually executed on the miner hardware that was allocated, rather than on a different machine or in a simulated environment. Verification can be achieved through a combination of (1) **trusted execution environment (TEE)** attestation, where the miner’s environment produces a signed quote binding the workload to the hardware; (2) **remote attestation** of the execution environment, so that tenants or the protocol can verify the integrity of the stack; and (3) **challenge–response** or proof tasks that only the claimed GPU can complete 
within expected time and power bounds. Successful verification is recorded on-chain or in protocol state, tying payouts and reputation to provable execution. PoI underpins the “physical hardware verified” guarantee advertised to tenants and ensures that mining rewards reflect real, verifiable compute.

---

---

## 2. Technical Data Sheet (Key Metrics & Sources)

Use this section to cross-check whitepaper numbers and to fill in “Performance” or “Metrics” subsections. **Action:** Compare every whitepaper metric below with current Alpha testnet dashboards and logs; update the whitepaper if testnet data diverges.

| Metric | Recommended value (or range) | Source / 依据 | Notes |
|--------|------------------------------|----------------|--------|
| **Tunnel establishment success rate** | ≥99.5% | Alpha testnet / staging metrics; goal for production | If testnet is lower, use “target” or “design goal” and cite current testnet value separately. |
| **Median RTT (miner ↔ gateway)** | &lt;50 ms (typical regions) | Internal benchmarks / testnet probes | Specify “typical regions” or list regions if needed. |
| **Max concurrent tunnels per relay tier** | Order of thousands (e.g. 2,000–10,000) | Architecture design; load-test extrapolation | Prefer a range until mainnet data exists. |
| **Platform fee (treasury)** | 5% of deploy payment | Code: `lib/types/escrow.ts` `PLATFORM_FEE_RATE = 0.05` | Matches 95/5 split (miner 95%, treasury 5%). |
| **Miner share of order** | 95% (before buffer deduction) | Code: `MINER_ORDER_SHARE = 0.95` | Unlocked from escrow per settled hour. |
| **Security buffer (miner)** | 10% of order profit until cap | Code: `SECURITY_BUFFER_RATE = 0.1` | Cap = 100 × hourly_price per node. |
| **Security buffer cap** | 100 × hourly_price (USD) per node | Code: `SECURITY_BUFFER_HOURS_MULTIPLIER = 100` | |
| **Buffer withdrawal cooldown** | 7 days after node unregister | Code: `SECURITY_BUFFER_COOLDOWN_DAYS = 7` | |
| **Force-release slash (miner)** | 50% of security buffer for that node | Code: `miner-registry-context.tsx` (force emergency release) | Economic model: align with contract if changed. |
| **POOL A (Free Balance) APY** | 0–30 d: 0.3%; 31–90 d: 0.8%; 90+ d: 1.5% | Code: `POOL_A_APY_TIERS` in `lib/types/escrow.ts` | |
| **POOL B (Security Buffer) APY** | 0–30 d: 0.3%; 31–90 d: 1.0%; 90+ d: 3.0% | Code: `POOL_B_APY_TIERS` | |
| **Anti-churn minimum charge** | 1 hour | Code: `EXPECTED_HOURS_MIN = 1`, `ANTI_CHURN_MIN_HOURS = 1` | Early cancel still charges at least 1 hour. |
| **Streaming settlement** | Per-hour unlock to miner (95% of hourly price) | Code: `lib/lifecycle/settlement.ts` `hourlyUnlockAmountUsd` | |

**Contract / economic model note for Claude:**  
If smart contracts or backend change treasury fee, buffer rate, slash rate, or APY tiers, the values above must be updated in the whitepaper from `lib/types/escrow.ts` and related lifecycle code.

---

## 3. Checklist for Claude Integration

- [ ] Replace or merge existing “tunnel / FRP” wording in Chapter 5 with **§1.1** (zero-trust tunneling overview).
- [ ] Insert **§1.3** (hardware fingerprint) into Section 5.4 (Miner Client).
- [ ] Add **§1.4** (Proof-of-Inference) to the appendix / glossary.
- [ ] Cross-check all numbers in the whitepaper against **§2** and current Alpha testnet; correct any mismatch and label “target” vs “current testnet” where appropriate.
- [ ] If treasury or miner economics change in code, sync **§2** and whitepaper economic model (e.g. fee %, buffer %, slash %, APY tiers).

---

## 4. Optional: One-Sentence FAQ (Unified Messaging)

For community questions such as “What is the tunnel based on?” or “What technology does the protocol use?”:

- **Unified answer (EN):**  
  *“NeuroGrid uses a self-developed, proprietary tunneling protocol. Details are not publicly disclosed, but the system is designed for high penetration rate, low latency, and automatic reconnection, and is intended to undergo periodic third-party security audits.”*

This can be adapted for FAQ or support docs.
