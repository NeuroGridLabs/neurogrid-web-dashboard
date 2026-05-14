-- Seed 3 non-Genesis test nodes owned by M-004 devnet keypair.
-- Used for UI e2e testing: tenant (browser wallet) rents these nodes via create_escrow.
-- Idempotent via ON CONFLICT DO NOTHING.

INSERT INTO nodes (id, name, gpu, vram, status, lifecycle_status, owner_wallet, is_genesis, price_per_hour, bandwidth, latency_ms)
VALUES
  (
    'test-rtx3090-01',
    'TestNode-RTX3090',
    '1x RTX 3090',
    '24GB',
    'ACTIVE',
    'IDLE',
    'LBQGzJ6y4tJYxMWRox8QiNCSc1AznkNN9j6eiFYCCUT',
    FALSE,
    0.42,
    '1 Gbps',
    18
  ),
  (
    'test-a100-01',
    'TestNode-A100',
    '1x A100',
    '40GB',
    'ACTIVE',
    'IDLE',
    'LBQGzJ6y4tJYxMWRox8QiNCSc1AznkNN9j6eiFYCCUT',
    FALSE,
    1.20,
    '10 Gbps',
    12
  ),
  (
    'test-h100-01',
    'TestNode-H100',
    '1x H100',
    '80GB',
    'ACTIVE',
    'IDLE',
    'LBQGzJ6y4tJYxMWRox8QiNCSc1AznkNN9j6eiFYCCUT',
    FALSE,
    2.50,
    '25 Gbps',
    8
  )
ON CONFLICT (id) DO NOTHING;
