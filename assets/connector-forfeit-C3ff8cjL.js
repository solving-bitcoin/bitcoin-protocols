const n=`# Connector-bound forfeit primitive

An operator funds a replacement batch and a connector in the same on-chain transaction. After verifying the presigned replacement exit, the user signs a forfeit consuming both the old VTXO and that connector. The forfeit cannot confirm without the replacement funding, and its user signature must bind both inputs. If the old VTXO is published, the operator can enforce the forfeit before the user’s delayed claim. The operator must retain the connector unspent until protection is no longer needed. For cooperative offboarding, replace the new batch output with a direct on-chain user payout; the connector dependency is unchanged. Amounts are illustrative BTC; fees, anchors, and repeated tree branches are omitted. Competing spends are alternatives, not a sequence.

Sources (snapshot reviewed 2026-09-27): [Arkade forfeit verification](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/internal/infrastructure/tx-builder/covenantless/builder.go); [Wavelength forfeit](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/lib/tx/forfeit.go); [Second offboard swap](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/offboard.rs).

\`\`\`bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  unilateral_exit: teal
  forfeit: red
\`\`\`

## tx: old_leaf

\`\`\`bridgeflow
label: Old signed leaf
inputs:
  - label: Old batch ancestry
outputs:
  - amount: "0.01000000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(D)
\`\`\`

## tx: replacement

\`\`\`bridgeflow
label: Replacement funding
inputs:
  - label: |-
      Operator fronts
      0.01000330 BTC
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
  - amount: "0.00000330"
    label: Connector (one slot)
    spending_paths:
      - id: operator
        label: S
\`\`\`

## tx: replacement_leaf

\`\`\`bridgeflow
label: New signed leaf
inputs:
  - tx: replacement
    output: 0
    spending_path: presigned
    color: setup_signature
outputs:
  - amount: "0.01000000"
    label: Replacement VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(D)
\`\`\`

## tx: forfeit

\`\`\`bridgeflow
label: Conditional forfeit
inputs:
  - tx: old_leaf
    output: 0
    spending_path: cooperate
    color: forfeit
    arrow_label: Alice presigns both inputs
    sighash_flag: sighash_default
  - tx: replacement
    output: 1
    spending_path: operator
    color: forfeit
outputs:
  - amount: "0.01000330"
    spending_paths:
      - id: owner
        label: S
\`\`\`

## tx: old_claim

\`\`\`bridgeflow
label: Old unilateral claim
inputs:
  - tx: old_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(D); conflicts with forfeit
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
\`\`\`

## tx: new_claim

\`\`\`bridgeflow
label: Replacement claim
inputs:
  - tx: replacement_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
\`\`\`

<!-- bridgeflow:layout
txs:
  old_leaf:
    x: 120
    y: 120
  replacement:
    x: 120
    y: 720
  replacement_leaf:
    x: 820
    y: 1220
  forfeit:
    x: 1520
    y: 370
  old_claim:
    x: 820
    y: 120
  new_claim:
    x: 1520
    y: 1220
-->
`;export{n as default};
