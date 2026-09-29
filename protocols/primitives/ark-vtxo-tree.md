# Ark VTXO tree primitive

A funded batch commits to a tree of presigned transactions. Each subtree’s participants cosign its branch, so a holder can publish the branch and leaf transactions without fresh cooperation. The leaf produces a VTXO that supports cooperative spending or a delayed unilateral user claim. Internal outputs also allow the operator to sweep after expiry; publishing only part of the tree leaves the remaining unspent internal outputs exposed to their own sweep paths. Holders must refresh or publish their exit ancestry before those deadlines. This reduced two-leaf example uses Arkade/Wavelength-style relative tree delays; Second’s tree instead uses absolute expiry heights. Amounts are illustrative BTC; fees, anchors, and repeated tree branches are omitted. Competing spends are alternatives, not a sequence.

Sources (snapshot reviewed 2026-09-27): [Arkade tree](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/pkg/ark-lib/tree/builder.go); [Wavelength tree](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/lib/tree/btc_tree_assembler.go); [Second absolute expiry](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/tree/signed.rs).

```bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  unilateral_exit: teal
  timeout: orange
```

## tx: batch

```bridgeflow
label: Batch funding
inputs:
  - label: Operator / boarding funds
outputs:
  - amount: "0.02000000"
    label: Batch / subtree
    spending_paths:
      - id: presigned
        label: |-
          Branch cosigners
          MuSig2 presignature
      - id: sweep
        label: S + CSV(T)
```

## tx: branch

```bridgeflow
label: Presigned branch
inputs:
  - tx: batch
    output: 0
    spending_path: presigned
    color: setup_signature
outputs:
  - amount: "0.01000000"
    label: Batch / subtree
    spending_paths:
      - id: presigned
        label: |-
          Branch cosigners
          MuSig2 presignature
      - id: sweep
        label: S + CSV(T)
  - amount: "0.01000000"
    label: Batch / subtree
    spending_paths:
      - id: presigned
        label: |-
          Branch cosigners
          MuSig2 presignature
      - id: sweep
        label: S + CSV(T)
```

## tx: alice_leaf

```bridgeflow
label: Alice leaf
inputs:
  - tx: branch
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
        label: Alice + CSV(D)
```

## tx: bob_leaf

```bridgeflow
label: Bob leaf
inputs:
  - tx: branch
    output: 1
    spending_path: presigned
    color: setup_signature
outputs:
  - amount: "0.01000000"
    label: Bob VTXO
    spending_paths:
      - id: cooperate
        label: Bob + S
      - id: exit
        label: Bob + CSV(D)
```

## tx: root_sweep

```bridgeflow
label: Root expiry sweep
inputs:
  - tx: batch
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CSV(T) from Batch
outputs:
  - amount: "0.02000000"
    spending_paths:
      - id: owner
        label: S
```

## tx: branch_sweep

```bridgeflow
label: Unspent branch sweep
inputs:
  - tx: branch
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CSV(T) from Branch
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
```

## tx: alice_claim

```bridgeflow
label: Alice on-chain claim
inputs:
  - tx: alice_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: bob_claim

```bridgeflow
label: Bob on-chain claim
inputs:
  - tx: bob_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Bob
```

<!-- bridgeflow:layout
txs:
  alice_claim:
    x: 2220
    y: 400
  alice_leaf:
    x: 1520
    y: 400
  batch:
    x: 120
    y: 520
  bob_claim:
    x: 2220
    y: 970
  bob_leaf:
    x: 1520
    y: 970
  branch:
    x: 820
    y: 520
  branch_sweep:
    x: 1520
    y: 120
  root_sweep:
    x: 820
    y: 120
-->
