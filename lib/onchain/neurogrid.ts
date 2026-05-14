/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/neurogrid.json`.
 */
export type Neurogrid = {
  "address": "CtqZMVcFxuQ6bsHi3xgaPPdopmEAgHRFivW3rCbCPse6",
  "metadata": {
    "name": "neurogrid",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "NeuroGrid Protocol — Escrow, Registry, Treasury on Solana"
  },
  "instructions": [
    {
      "name": "createEscrow",
      "docs": [
        "Create escrow: tenant locks USDT. 5% fee → treasury, 95% → escrow PDA."
      ],
      "discriminator": [
        253,
        215,
        165,
        116,
        36,
        108,
        68,
        80
      ],
      "accounts": [
        {
          "name": "tenant",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "docs": [
            "Escrow state account (PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "sessionId"
              }
            ]
          }
        },
        {
          "name": "escrowToken",
          "docs": [
            "Escrow token account (PDA-owned, holds the 95% USDT)"
          ],
          "writable": true
        },
        {
          "name": "tenantToken",
          "docs": [
            "Tenant's USDT token account (source of funds)"
          ],
          "writable": true
        },
        {
          "name": "treasuryToken",
          "docs": [
            "Treasury token account (receives 5% fee)"
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury state account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "miner"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sessionId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "expectedHours",
          "type": "u16"
        },
        {
          "name": "hourlyPrice",
          "type": "u64"
        },
        {
          "name": "nodeId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "depositFee",
      "docs": [
        "Reserved for future automated buyback."
      ],
      "discriminator": [
        11,
        51,
        105,
        140,
        198,
        229,
        7,
        77
      ],
      "accounts": [
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "devWarpEscrow",
      "docs": [
        "DEV ONLY: Backdate escrow timestamps for testing settlement.",
        "Remove before mainnet deployment."
      ],
      "discriminator": [
        137,
        99,
        66,
        132,
        115,
        235,
        136,
        115
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "hoursBack",
          "type": "i64"
        }
      ]
    },
    {
      "name": "dispute",
      "docs": [
        "Dispute: tenant reports miner offline. Refund unsettled escrow, slash buffer."
      ],
      "discriminator": [
        216,
        92,
        128,
        146,
        202,
        85,
        135,
        73
      ],
      "accounts": [
        {
          "name": "tenant",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "escrowToken",
          "writable": true
        },
        {
          "name": "tenantToken",
          "writable": true
        },
        {
          "name": "minerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "escrow.miner",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "initTreasury",
      "docs": [
        "Initialize protocol treasury (once)."
      ],
      "discriminator": [
        105,
        152,
        173,
        51,
        158,
        151,
        49,
        14
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "reclaim",
      "docs": [
        "Reclaim: session expired. Return unsettled escrow to tenant. Permissionless."
      ],
      "discriminator": [
        44,
        177,
        236,
        249,
        145,
        109,
        163,
        186
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "escrowToken",
          "writable": true
        },
        {
          "name": "tenantToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "registerMiner",
      "docs": [
        "Register miner node on-chain with hardware fingerprint."
      ],
      "discriminator": [
        101,
        185,
        46,
        223,
        72,
        27,
        180,
        14
      ],
      "accounts": [
        {
          "name": "miner",
          "writable": true,
          "signer": true
        },
        {
          "name": "minerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "miner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nodeId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "fingerprintHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "bufferCap",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleHour",
      "docs": [
        "Settle one hour: miner claims escrow_amount/expected_hours.",
        "Idempotent via bitmap. 10% → security buffer, rest → miner wallet."
      ],
      "discriminator": [
        150,
        190,
        130,
        169,
        39,
        215,
        160,
        133
      ],
      "accounts": [
        {
          "name": "minerSigner",
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true
        },
        {
          "name": "escrowToken",
          "writable": true
        },
        {
          "name": "minerToken",
          "writable": true
        },
        {
          "name": "minerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "minerSigner"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "hourIndex",
          "type": "u16"
        }
      ]
    },
    {
      "name": "slashMiner",
      "docs": [
        "Slash miner buffer on violation (authority only)."
      ],
      "discriminator": [
        172,
        78,
        219,
        55,
        54,
        231,
        130,
        236
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Only treasury authority can slash"
          ],
          "signer": true
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "minerAccount",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "slashAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unregisterMiner",
      "docs": [
        "Voluntary unregister — starts 7-day cooldown."
      ],
      "discriminator": [
        42,
        5,
        100,
        59,
        213,
        158,
        213,
        84
      ],
      "accounts": [
        {
          "name": "miner",
          "signer": true
        },
        {
          "name": "minerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "miner"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "withdrawBuffer",
      "docs": [
        "Withdraw security buffer after 7-day cooldown."
      ],
      "discriminator": [
        90,
        131,
        164,
        164,
        84,
        162,
        127,
        172
      ],
      "accounts": [
        {
          "name": "miner",
          "signer": true
        },
        {
          "name": "minerAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "miner"
              }
            ]
          }
        },
        {
          "name": "bufferToken",
          "writable": true
        },
        {
          "name": "minerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "escrowAccount",
      "discriminator": [
        36,
        69,
        48,
        18,
        128,
        225,
        125,
        135
      ]
    },
    {
      "name": "minerAccount",
      "discriminator": [
        232,
        196,
        79,
        139,
        222,
        213,
        161,
        99
      ]
    },
    {
      "name": "treasuryAccount",
      "discriminator": [
        204,
        140,
        18,
        173,
        90,
        152,
        134,
        123
      ]
    }
  ],
  "events": [
    {
      "name": "bufferWithdrawn",
      "discriminator": [
        75,
        118,
        177,
        214,
        183,
        17,
        158,
        228
      ]
    },
    {
      "name": "escrowCreated",
      "discriminator": [
        70,
        127,
        105,
        102,
        92,
        97,
        7,
        173
      ]
    },
    {
      "name": "hourSettled",
      "discriminator": [
        185,
        160,
        81,
        107,
        236,
        30,
        8,
        149
      ]
    },
    {
      "name": "minerRegistered",
      "discriminator": [
        40,
        91,
        92,
        195,
        9,
        137,
        86,
        194
      ]
    },
    {
      "name": "minerSlashed",
      "discriminator": [
        134,
        90,
        17,
        35,
        50,
        63,
        181,
        89
      ]
    },
    {
      "name": "minerUnregistered",
      "discriminator": [
        162,
        136,
        174,
        232,
        174,
        98,
        181,
        37
      ]
    },
    {
      "name": "sessionDisputed",
      "discriminator": [
        94,
        224,
        174,
        133,
        185,
        44,
        163,
        229
      ]
    },
    {
      "name": "sessionReclaimed",
      "discriminator": [
        19,
        188,
        249,
        118,
        22,
        226,
        186,
        67
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "sessionNotActive",
      "msg": "Session is not in ACTIVE phase"
    },
    {
      "code": 6001,
      "name": "hourAlreadySettled",
      "msg": "This hour has already been settled"
    },
    {
      "code": 6002,
      "name": "allHoursSettled",
      "msg": "All hours have been settled"
    },
    {
      "code": 6003,
      "name": "settlementTooEarly",
      "msg": "Not enough time has elapsed for this settlement"
    },
    {
      "code": 6004,
      "name": "sessionNotExpired",
      "msg": "Session has not expired yet"
    },
    {
      "code": 6005,
      "name": "disputeAlreadyFiled",
      "msg": "Dispute already filed for this session"
    },
    {
      "code": 6006,
      "name": "invalidEscrowAmount",
      "msg": "Invalid escrow amount"
    },
    {
      "code": 6007,
      "name": "invalidExpectedHours",
      "msg": "Expected hours must be between 1 and 256"
    },
    {
      "code": 6008,
      "name": "unauthorizedTenant",
      "msg": "Unauthorized: only tenant can perform this action"
    },
    {
      "code": 6009,
      "name": "unauthorizedMiner",
      "msg": "Unauthorized: only miner can perform this action"
    },
    {
      "code": 6010,
      "name": "unauthorizedAuthority",
      "msg": "Unauthorized: only treasury authority"
    },
    {
      "code": 6011,
      "name": "minerAlreadyRegistered",
      "msg": "Miner already registered"
    },
    {
      "code": 6012,
      "name": "minerNotFound",
      "msg": "Miner not found"
    },
    {
      "code": 6013,
      "name": "nodeHasActiveSession",
      "msg": "Cannot unregister: node has active session"
    },
    {
      "code": 6014,
      "name": "cooldownNotPassed",
      "msg": "Buffer withdrawal: cooldown not yet passed"
    },
    {
      "code": 6015,
      "name": "noBufferToWithdraw",
      "msg": "Buffer withdrawal: no buffer to withdraw"
    },
    {
      "code": 6016,
      "name": "invalidMinerStatus",
      "msg": "Miner status does not allow this action"
    },
    {
      "code": 6017,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "bufferWithdrawn",
      "docs": [
        "Emitted when a miner withdraws their security buffer."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowAccount",
      "docs": [
        "Escrow account — holds locked USDT for a rental session.",
        "PDA seeds: [\"escrow\", session_id]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sessionId",
            "docs": [
              "Unique session identifier"
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "tenant",
            "docs": [
              "Tenant who locked the escrow"
            ],
            "type": "pubkey"
          },
          {
            "name": "miner",
            "docs": [
              "Miner who receives settlement"
            ],
            "type": "pubkey"
          },
          {
            "name": "nodeId",
            "docs": [
              "Node being rented"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "escrowAmount",
            "docs": [
              "Total USDT locked (in base units, 6 decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "platformFee",
            "docs": [
              "Platform fee (5%) already deducted and sent to treasury"
            ],
            "type": "u64"
          },
          {
            "name": "hourlyPrice",
            "docs": [
              "Hourly price in base units"
            ],
            "type": "u64"
          },
          {
            "name": "expectedHours",
            "docs": [
              "Expected rental hours"
            ],
            "type": "u16"
          },
          {
            "name": "hoursSettled",
            "docs": [
              "Hours already settled (unlocked to miner)"
            ],
            "type": "u16"
          },
          {
            "name": "settledBitmap",
            "docs": [
              "Bitmap of settled hours (max 256 hours = 32 bytes). Bit N = hour N settled."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "phase",
            "docs": [
              "Session phase"
            ],
            "type": {
              "defined": {
                "name": "escrowPhase"
              }
            }
          },
          {
            "name": "startedAt",
            "docs": [
              "Timestamps (Unix epoch seconds)"
            ],
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "Escrow PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "escrowCreated",
      "docs": [
        "Emitted when a new escrow is created."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sessionId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "tenant",
            "type": "pubkey"
          },
          {
            "name": "miner",
            "type": "pubkey"
          },
          {
            "name": "escrowAmount",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          },
          {
            "name": "expectedHours",
            "type": "u16"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowPhase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "disputed"
          },
          {
            "name": "completed"
          }
        ]
      }
    },
    {
      "name": "hourSettled",
      "docs": [
        "Emitted when one hour is settled."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sessionId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "miner",
            "type": "pubkey"
          },
          {
            "name": "hourIndex",
            "type": "u16"
          },
          {
            "name": "toMiner",
            "type": "u64"
          },
          {
            "name": "toBuffer",
            "type": "u64"
          },
          {
            "name": "totalSettled",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "minerAccount",
      "docs": [
        "Miner registration account — one per miner wallet.",
        "PDA seeds: [\"miner\", wallet_address]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "docs": [
              "Miner's Solana wallet"
            ],
            "type": "pubkey"
          },
          {
            "name": "nodeId",
            "docs": [
              "Assigned node ID (set by Control Plane)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fingerprintHash",
            "docs": [
              "Hardware fingerprint hash (SHA256 from NeuroClient)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "securityBuffer",
            "docs": [
              "Security Buffer: staked USDT for slashing on disputes"
            ],
            "type": "u64"
          },
          {
            "name": "bufferCap",
            "docs": [
              "Buffer cap: 100 * hourly_price (in base units)"
            ],
            "type": "u64"
          },
          {
            "name": "optInBufferRouting",
            "docs": [
              "Whether miner opts in to route extra profits to buffer"
            ],
            "type": "bool"
          },
          {
            "name": "bufferLockedSince",
            "docs": [
              "When buffer was first locked (Unix epoch)"
            ],
            "type": "i64"
          },
          {
            "name": "registeredAt",
            "docs": [
              "Registration timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "unregisteredAt",
            "docs": [
              "Unregistration timestamp (0 if still active)"
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "Status"
            ],
            "type": {
              "defined": {
                "name": "minerStatus"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "minerRegistered",
      "docs": [
        "Emitted when a miner registers on-chain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "nodeId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bufferCap",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "minerSlashed",
      "docs": [
        "Emitted when a miner's buffer is slashed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "slashAmount",
            "type": "u64"
          },
          {
            "name": "remainingBuffer",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "minerStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "cooldown"
          },
          {
            "name": "violated"
          },
          {
            "name": "withdrawn"
          }
        ]
      }
    },
    {
      "name": "minerUnregistered",
      "docs": [
        "Emitted when a miner starts unregistration cooldown."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "cooldownUntil",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "sessionDisputed",
      "docs": [
        "Emitted when a tenant disputes a session."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sessionId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "tenant",
            "type": "pubkey"
          },
          {
            "name": "refundAmount",
            "type": "u64"
          },
          {
            "name": "slashAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sessionReclaimed",
      "docs": [
        "Emitted when an expired session is reclaimed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sessionId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "refundAmount",
            "type": "u64"
          },
          {
            "name": "hoursSettled",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "treasuryAccount",
      "docs": [
        "Protocol treasury account — receives 5% platform fee from every deployment.",
        "PDA seeds: [\"treasury\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Authority that can execute buybacks (multisig or admin)"
            ],
            "type": "pubkey"
          },
          {
            "name": "totalFeesCollected",
            "docs": [
              "Total USDT accumulated from platform fees"
            ],
            "type": "u64"
          },
          {
            "name": "totalBuybackSpent",
            "docs": [
              "Total USDT spent on $NRG buybacks"
            ],
            "type": "u64"
          },
          {
            "name": "sessionsCount",
            "docs": [
              "Number of escrow sessions that contributed fees"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
