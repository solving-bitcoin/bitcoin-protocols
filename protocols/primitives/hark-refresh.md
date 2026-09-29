# hArk hash-locked refresh primitive

The server funds a replacement tree whose final presigned leaf transaction needs preimage p. After verifying that funded exit path, the user signs a forfeit moving the old VTXO into an output that the server can claim only by revealing p, or the user can recover after Delta. Revealing p completes the exchange: the user can activate the replacement and the server can enforce the old VTXO’s forfeiture. If the server withholds p, the user retains recovery of the old value; an on-chain server claim exposes p for the replacement. The two legs share a hash, not a Bitcoin input edge. Absolute expiry still limits the replacement exit window. Amounts are illustrative BTC; fees, anchors, and repeated tree branches are omitted. Competing spends are alternatives, not a sequence.

Sources (snapshot reviewed 2026-09-27): [Bark hArk tree](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/tree/signed.rs); [forfeit](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/forfeit.rs); [spending policies](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/vtxo/policy/mod.rs).

```bridgeflow
tx_width: 480
color_groups:
  unilateral_exit: teal
  timeout: orange
  forfeit: red
  preimage: purple
```

## tx: old_leaf

```bridgeflow
label: Old VTXO
inputs:
  - label: Old signed ancestry
outputs:
  - amount: "0.01000000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(Delta)
```

## tx: forfeit

```bridgeflow
label: Presigned hArk forfeit
inputs:
  - tx: old_leaf
    output: 0
    spending_path: cooperate
    color: forfeit
outputs:
  - amount: "0.01000000"
    label: Conditional forfeit
    spending_paths:
      - id: claim
        label: S + p; H(p) = h
      - id: refund
        label: Alice + CSV(Delta)
      - id: cooperate
        label: |-
          Alice + S
          live key-path cooperation
```

## tx: server_claim

```bridgeflow
label: Server claim reveals p
inputs:
  - tx: forfeit
    output: 0
    spending_path: claim
    color: preimage
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
```

## tx: forfeit_refund

```bridgeflow
label: Forfeit timeout refund
inputs:
  - tx: forfeit
    output: 0
    spending_path: refund
    color: timeout
    arrow_label: CSV(Delta)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: replacement

```bridgeflow
label: Funded replacement branch
inputs:
  - label: New funded tree ancestry
outputs:
  - amount: "0.01000000"
    label: hArk locked leaf
    spending_paths:
      - id: unlock
        label: |-
          p + Alice/S aggregate sig
          H(p) = h
      - id: sweep
        label: S + CLTV(H1)
      - id: cooperate
        label: |-
          Alice + S
          live key-path cooperation
```

## tx: unlock

```bridgeflow
label: Presigned leaf + p
inputs:
  - tx: replacement
    output: 0
    spending_path: unlock
    color: preimage
    arrow_label: same p as Server claim
outputs:
  - amount: "0.01000000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(Delta)
```

## tx: new_claim

```bridgeflow
label: New unilateral claim
inputs:
  - tx: unlock
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

## tx: expiry

```bridgeflow
label: Replacement expiry sweep
inputs:
  - tx: replacement
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CLTV(H1)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
```

## tx: old_claim

```bridgeflow
label: Old unilateral claim
inputs:
  - tx: old_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(Delta); conflicts with forfeit
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
```

<!-- bridgeflow:layout
txs:
  expiry:
    x: 820
    y: 1620
  forfeit:
    x: 820
    y: 120
  forfeit_refund:
    x: 1520
    y: 570
  new_claim:
    x: 1520
    y: 1120
  old_claim:
    x: 820
    y: 720
  old_leaf:
    x: 120
    y: 120
  replacement:
    x: 120
    y: 1120
  server_claim:
    x: 1520
    y: 120
  unlock:
    x: 920
    y: 1120
-->
