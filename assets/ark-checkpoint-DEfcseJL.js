const n=`# Ark checkpoint primitive — relative recovery

An off-chain spend first consumes a VTXO into a jointly signed checkpoint. Its output replaces the user’s unilateral exit with an operator timeout path, while retaining the sender–operator cooperative path for a presigned payment continuation. A recipient must obtain the complete signed chain and publish that continuation before checkpoint recovery matures. This lets the operator respond to a partial exit without publishing every later payment. The continuation’s new VTXOs regain user exit paths and can be spent, refreshed, or claimed after their own delays. This is the relative-timeout construction in Arkade and Wavelength; Second’s arkoor checkpoints use an absolute expiry and separate recipient branches. Amounts are illustrative BTC; fees, anchors, and repeated tree branches are omitted. Competing spends are alternatives, not a sequence.

Sources (snapshot reviewed 2026-09-27): [Arkade checkpoint](https://github.com/arkade-os/arkd/blob/f863e484719344edbe4a8d10cf5fe994b123f2c0/pkg/ark-lib/offchain/tx.go); [Wavelength checkpoint](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/lib/arkscript/checkpoint.go); [Second variant](https://codeberg.org/ark-bitcoin/bark/src/commit/1c487508a3092dfba3c167ef7f45639599f9cc59/lib/src/arkoor/mod.rs).

\`\`\`bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  unilateral_exit: teal
  timeout: orange
\`\`\`

## tx: old_leaf

\`\`\`bridgeflow
label: Input VTXO
inputs:
  - label: Signed batch ancestry
outputs:
  - amount: "0.01000000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(D)
\`\`\`

## tx: checkpoint

\`\`\`bridgeflow
label: Presigned checkpoint
inputs:
  - tx: old_leaf
    output: 0
    spending_path: cooperate
    color: setup_signature
outputs:
  - amount: "0.01000000"
    label: Checkpoint
    spending_paths:
      - id: continue
        label: |-
          Alice + S
          signed continuation
      - id: reclaim
        label: S + CSV(C)
\`\`\`

## tx: payment

\`\`\`bridgeflow
label: Presigned payment
inputs:
  - tx: checkpoint
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
        label: Bob + CSV(D)
  - amount: "0.00400000"
    label: Alice VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(D)
\`\`\`

## tx: old_exit

\`\`\`bridgeflow
label: Original user exit
inputs:
  - tx: old_leaf
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(D); competes with checkpoint
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
\`\`\`

## tx: recovery

\`\`\`bridgeflow
label: Operator checkpoint recovery
inputs:
  - tx: checkpoint
    output: 0
    spending_path: reclaim
    color: timeout
    arrow_label: CSV(C)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
\`\`\`

## tx: bob_claim

\`\`\`bridgeflow
label: Recipient claim
inputs:
  - tx: payment
    output: 0
    spending_path: exit
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: Bob
\`\`\`

<!-- bridgeflow:layout
txs:
  old_leaf:
    x: 120
    y: 420
  checkpoint:
    x: 820
    y: 420
  payment:
    x: 1520
    y: 420
  old_exit:
    x: 820
    y: 120
  recovery:
    x: 1520
    y: 970
  bob_claim:
    x: 2220
    y: 420
-->
`;export{n as default};
