# Second Ark — Bark hArk refresh and arkoor

Bark boards BTC into a user–server output with an absolute expiry and obtains a signed exit to an ordinary VTXO. An arkoor payment cosigns a checkpoint that splits payment and change, followed by a separate signed transaction for each recipient. Checkpoint outputs can be swept by S at the inherited expiry height; recipients must publish their continuations before expiry. Off-chain recipients rely on the server not colluding with earlier owners to create conflicting spends until refresh.

For hArk refresh, S funds a cosigned tree first; its new leaf needs a preimage p. After verifying the funded tree, Bob signs a forfeit of his old VTXO. S reveals p, enabling both the new leaf and S’s claim on the forfeit output. If p is withheld, Bob can exit the old funds or recover the forfeit after Delta; an on-chain server claim reveals p and activates the replacement. Cooperative offboarding separately uses a funded payout plus connector-bound forfeit. S is the server; H0/H1 are absolute expiry heights and Delta is a relative exit delay. Self-signed refresh is shown; delegated cosigners add trust. Amounts are illustrative BTC; fees, anchors, and repeated tree branches are omitted. Competing spends are alternatives, not a sequence.

Sources (snapshot reviewed 2026-09-27): [Bark 1c48750](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/board.rs); [hArk policies](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/vtxo/policy/mod.rs); [forfeits](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/forfeit.rs); [arkoor](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/arkoor/mod.rs); [offboarding](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/offboard.rs).

Primitives: hArk exchange, connector forfeit (in primitives/).

```bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  cooperative: green
  unilateral_exit: teal
  timeout: orange
  forfeit: red
  preimage: purple
```

## tx: board_funding

```bridgeflow
label: Board funding
inputs:
  - label: Alice on-chain funds
outputs:
  - amount: "0.01000000"
    label: Board output
    spending_paths:
      - id: presigned
        label: |-
          Alice + S
          presigned exit
      - id: sweep
        label: S + CLTV(H0)
```

## tx: board_expiry

```bridgeflow
label: Board expiry sweep
inputs:
  - tx: board_funding
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CLTV(H0)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
```

## tx: board_exit

```bridgeflow
label: Presigned board exit
inputs:
  - tx: board_funding
    output: 0
    spending_path: presigned
    color: setup_signature
outputs:
  - amount: "0.01000000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(Delta)
```

## tx: alice_exit

```bridgeflow
label: Alice unilateral claim
inputs:
  - tx: board_exit
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(Delta)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: arkoor_checkpoint

```bridgeflow
label: Arkoor checkpoint / split
inputs:
  - tx: board_exit
    output: 0
    spending_path: cooperate
    color: cooperative
outputs:
  - amount: "0.00600000"
    label: Bob branch checkpoint
    spending_paths:
      - id: continue
        label: |-
          Alice + S
          presigned continuation
      - id: sweep
        label: S + CLTV(H0)
  - amount: "0.00400000"
    label: Alice branch checkpoint
    spending_paths:
      - id: continue
        label: |-
          Alice + S
          presigned continuation
      - id: sweep
        label: S + CLTV(H0)
```

## tx: checkpoint_sweep

```bridgeflow
label: Unspent checkpoint sweep
inputs:
  - tx: arkoor_checkpoint
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CLTV(H0)
  - tx: arkoor_checkpoint
    output: 1
    spending_path: sweep
    color: timeout
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
```

## tx: arkoor_bob

```bridgeflow
label: Arkoor recipient leaf
inputs:
  - tx: arkoor_checkpoint
    output: 0
    spending_path: continue
    color: setup_signature
outputs:
  - amount: "0.00600000"
    label: Bob VTXO
    spending_paths:
      - id: cooperate
        label: Bob + S
      - id: exit
        label: Bob + CSV(Delta)
```

## tx: bob_exit

```bridgeflow
label: Bob unilateral claim
inputs:
  - tx: arkoor_bob
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(Delta)
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: arkoor_alice

```bridgeflow
label: Arkoor change leaf
inputs:
  - tx: arkoor_checkpoint
    output: 1
    spending_path: continue
    color: setup_signature
outputs:
  - amount: "0.00400000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(Delta)
```

## tx: change_exit

```bridgeflow
label: Change unilateral claim
inputs:
  - tx: arkoor_alice
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(Delta)
outputs:
  - amount: "0.00400000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: round_funding

```bridgeflow
label: hArk round funding
inputs:
  - label: |-
      Server liquidity
      0.006 BTC
outputs:
  - amount: "0.00600000"
    label: Batch / subtree
    spending_paths:
      - id: presigned
        label: |-
          Branch cosigners
          MuSig2 presignature
      - id: sweep
        label: S + CLTV(H1)
```

## tx: round_expiry

```bridgeflow
label: Round expiry sweep
inputs:
  - tx: round_funding
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CLTV(H1)
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: S
```

## tx: round_tree

```bridgeflow
label: Presigned tree branch
inputs:
  - tx: round_funding
    output: 0
    spending_path: presigned
    color: setup_signature
outputs:
  - amount: "0.00600000"
    label: Locked replacement leaf
    spending_paths:
      - id: unlock
        label: |-
          p + Bob/S aggregate sig
          H(p) = h
      - id: sweep
        label: S + CLTV(H1)
      - id: cooperate
        label: |-
          Bob + S
          live key-path cooperation
```

## tx: unlock_leaf

```bridgeflow
label: Activate new Bob VTXO
inputs:
  - tx: round_tree
    output: 0
    spending_path: unlock
    color: preimage
    arrow_label: same p as forfeit claim
outputs:
  - amount: "0.00600000"
    label: Bob VTXO
    spending_paths:
      - id: cooperate
        label: Bob + S
      - id: exit
        label: Bob + CSV(Delta)
```

## tx: fresh_exit

```bridgeflow
label: Refreshed Bob claim
inputs:
  - tx: unlock_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(Delta)
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: hark_forfeit

```bridgeflow
label: Hash-locked forfeit
inputs:
  - tx: arkoor_bob
    output: 0
    spending_path: cooperate
    color: forfeit
    arrow_label: Bob presigns after tree funding
outputs:
  - amount: "0.00600000"
    label: Conditional server claim
    spending_paths:
      - id: claim
        label: S + p; H(p) = h
      - id: refund
        label: Bob + CSV(Delta)
      - id: cooperate
        label: |-
          Bob + S
          live key-path cooperation
```

## tx: server_claim

```bridgeflow
label: Server claim (reveals p)
inputs:
  - tx: hark_forfeit
    output: 0
    spending_path: claim
    color: preimage
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: S
```

## tx: forfeit_refund

```bridgeflow
label: Forfeit timeout refund
inputs:
  - tx: hark_forfeit
    output: 0
    spending_path: refund
    color: timeout
    arrow_label: CSV(Delta)
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: offboard_payment

```bridgeflow
label: Cooperative offboard payout
inputs:
  - label: |-
      Server fronts
      0.00400330 BTC
outputs:
  - amount: "0.00400000"
    label: On-chain payout
    spending_paths:
      - id: owner
        label: Alice
  - amount: "0.00000330"
    label: Payout connector
    spending_paths:
      - id: operator
        label: S
```

## tx: offboard_forfeit

```bridgeflow
label: Connector offboard forfeit
inputs:
  - tx: arkoor_alice
    output: 0
    spending_path: cooperate
    color: forfeit
    arrow_label: Alice presigns
  - tx: offboard_payment
    output: 1
    spending_path: operator
    color: forfeit
outputs:
  - amount: "0.00400330"
    spending_paths:
      - id: owner
        label: S
```

<!-- bridgeflow:layout
txs:
  alice_exit:
    x: 1520
    y: 120
  arkoor_alice:
    x: 2220
    y: 1120
  arkoor_bob:
    x: 2220
    y: 620
  arkoor_checkpoint:
    x: 1520
    y: 520
  board_exit:
    x: 820
    y: 520
  board_expiry:
    x: 820
    y: 120
  board_funding:
    x: 120
    y: 520
  bob_exit:
    x: 2920
    y: 120
  change_exit:
    x: 2920
    y: 1120
  checkpoint_sweep:
    x: 2220
    y: 120
  forfeit_refund:
    x: 3820
    y: 1170
  fresh_exit:
    x: 2220
    y: 1870
  hark_forfeit:
    x: 3120
    y: 620
  offboard_forfeit:
    x: 3620
    y: 1870
  offboard_payment:
    x: 2920
    y: 1870
  round_expiry:
    x: 820
    y: 1470
  round_funding:
    x: 120
    y: 1870
  round_tree:
    x: 820
    y: 1870
  server_claim:
    x: 3820
    y: 620
  unlock_leaf:
    x: 1520
    y: 1870
-->
