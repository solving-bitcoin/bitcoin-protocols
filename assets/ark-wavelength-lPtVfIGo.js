const n=`# Wavelength Ark — rounds and checkpoint payments

Wavelength’s current Ark client boards a user–operator output into a cosigned transaction tree. The wallet verifies its branch and receives presigned transactions for unilateral exit. A payment first moves the sender’s VTXO into a checkpoint, then spends that checkpoint into recipient and change VTXOs. The checkpoint gives the operator a delayed recovery path; recipients must publish the signed continuation before that path matures. Off-chain acceptance still relies on the operator not signing conflicting transfers.

A new round fronts fresh liquidity for refreshed VTXOs or an on-chain cooperative leave. After verifying the signed replacement tree, users sign forfeits consuming their old VTXOs together with connectors from that same new round. The operator can enforce these forfeits if an old VTXO is published. Users exit by publishing their ancestry and waiting the VTXO delay, or refresh before the operator’s tree sweep becomes available. This BTC-only graph shows the client’s connector-based Ark construction, closely related to Arkade, rather than a separate consensus protocol. S is the operator; D, B, C, and T are configured block delays. Amounts are illustrative BTC; fees, anchors, and repeated tree branches are omitted. Competing spends are alternatives, not a sequence.

Sources (snapshot reviewed 2026-09-27): [Wavelength df5208b](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/ARCHITECTURE.md); [forfeits](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/lib/tx/forfeit.go); [checkpoint and VTXO policies](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/docs/arkscript_spec.md); [tree sweep](https://github.com/lightninglabs/wavelength/blob/df5208b673dd436c3b585e3f9a1ed00b6a4b3f92/round/sweep_policy.go).

Primitives: VTXO tree, checkpoint, connector forfeit (in primitives/).

\`\`\`bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  cooperative: green
  unilateral_exit: teal
  timeout: orange
  forfeit: red
\`\`\`

## tx: boarding

\`\`\`bridgeflow
label: Boarding
inputs:
  - label: Alice on-chain funds
outputs:
  - amount: "0.01000000"
    label: Boarding output
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(B)
\`\`\`

## tx: boarding_refund

\`\`\`bridgeflow
label: Boarding refund
inputs:
  - tx: boarding
    output: 0
    spending_path: exit
    color: timeout
    arrow_label: CSV(B)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
\`\`\`

## tx: commitment_0

\`\`\`bridgeflow
label: Round 0 funding
inputs:
  - tx: boarding
    output: 0
    spending_path: cooperate
    color: cooperative
outputs:
  - amount: "0.01000000"
    label: Batch / subtree
    spending_paths:
      - id: presigned
        label: |-
          Branch cosigners
          MuSig2 presignature
      - id: sweep
        label: S + CSV(T0)
\`\`\`

## tx: batch_expiry

\`\`\`bridgeflow
label: Expired batch sweep
inputs:
  - tx: commitment_0
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CSV(T0)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: S
\`\`\`

## tx: vtxo_leaf_0

\`\`\`bridgeflow
label: Presigned leaf (Alice)
inputs:
  - tx: commitment_0
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
\`\`\`

## tx: old_alice_exit

\`\`\`bridgeflow
label: Alice unilateral claim
inputs:
  - tx: vtxo_leaf_0
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

## tx: checkpoint

\`\`\`bridgeflow
label: Payment checkpoint
inputs:
  - tx: vtxo_leaf_0
    output: 0
    spending_path: cooperate
    color: cooperative
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

## tx: checkpoint_reclaim

\`\`\`bridgeflow
label: Checkpoint recovery
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

## tx: ark_payment

\`\`\`bridgeflow
label: Out-of-round payment
inputs:
  - tx: checkpoint
    output: 0
    spending_path: continue
    color: cooperative
outputs:
  - amount: "0.00600000"
    label: Bob VTXO
    spending_paths:
      - id: cooperate
        label: Bob + S
      - id: exit
        label: Bob + CSV(D)
  - amount: "0.00400000"
    label: Alice change VTXO
    spending_paths:
      - id: cooperate
        label: Alice + S
      - id: exit
        label: Alice + CSV(D)
\`\`\`

## tx: bob_exit

\`\`\`bridgeflow
label: Bob unilateral claim
inputs:
  - tx: ark_payment
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

## tx: commitment_1

\`\`\`bridgeflow
label: Round 1 (refresh / leave)
inputs:
  - label: |-
      Operator fronts
      0.01000660 BTC
outputs:
  - amount: "0.00600000"
    label: Batch / subtree
    spending_paths:
      - id: presigned
        label: |-
          Branch cosigners
          MuSig2 presignature
      - id: sweep
        label: S + CSV(T1)
  - amount: "0.00400000"
    label: Cooperative cash-out
    spending_paths:
      - id: owner
        label: Alice
  - amount: "0.00000660"
    label: Connector tree root
    spending_paths:
      - id: operator
        label: S
\`\`\`

## tx: connector_fanout

\`\`\`bridgeflow
label: Connector fanout
inputs:
  - tx: commitment_1
    output: 2
    spending_path: operator
    color: setup_signature
outputs:
  - amount: "0.00000330"
    label: Bob connector
    spending_paths:
      - id: operator
        label: S
  - amount: "0.00000330"
    label: Alice connector
    spending_paths:
      - id: operator
        label: S
\`\`\`

## tx: forfeit_bob

\`\`\`bridgeflow
label: Forfeit Bob old VTXO
inputs:
  - tx: ark_payment
    output: 0
    spending_path: cooperate
    color: forfeit
    arrow_label: Bob presigns
  - tx: connector_fanout
    output: 0
    spending_path: operator
    color: forfeit
outputs:
  - amount: "0.00600330"
    spending_paths:
      - id: owner
        label: S
\`\`\`

## tx: forfeit_alice

\`\`\`bridgeflow
label: Forfeit Alice change
inputs:
  - tx: ark_payment
    output: 1
    spending_path: cooperate
    color: forfeit
    arrow_label: Alice presigns
  - tx: connector_fanout
    output: 1
    spending_path: operator
    color: forfeit
outputs:
  - amount: "0.00400330"
    spending_paths:
      - id: owner
        label: S
\`\`\`

## tx: new_vtxo_leaf

\`\`\`bridgeflow
label: Presigned fresh leaf (Bob)
inputs:
  - tx: commitment_1
    output: 0
    spending_path: presigned
    color: setup_signature
outputs:
  - amount: "0.00600000"
    label: Refreshed Bob VTXO
    spending_paths:
      - id: cooperate
        label: Bob + S
      - id: exit
        label: Bob + CSV(D)
\`\`\`

## tx: new_bob_exit

\`\`\`bridgeflow
label: Fresh Bob unilateral claim
inputs:
  - tx: new_vtxo_leaf
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

## tx: new_batch_expiry

\`\`\`bridgeflow
label: New batch expiry sweep
inputs:
  - tx: commitment_1
    output: 0
    spending_path: sweep
    color: timeout
    arrow_label: CSV(T1)
outputs:
  - amount: "0.00600000"
    spending_paths:
      - id: owner
        label: S
\`\`\`

<!-- bridgeflow:layout
txs:
  boarding:
    x: 120
    y: 600
  boarding_refund:
    x: 820
    y: 120
  commitment_0:
    x: 820
    y: 600
  batch_expiry:
    x: 1520
    y: 120
  vtxo_leaf_0:
    x: 1520
    y: 600
  old_alice_exit:
    x: 2220
    y: 120
  checkpoint:
    x: 2220
    y: 600
  checkpoint_reclaim:
    x: 2920
    y: 120
  ark_payment:
    x: 2920
    y: 600
  bob_exit:
    x: 3620
    y: 600
  commitment_1:
    x: 820
    y: 1270
  connector_fanout:
    x: 1520
    y: 1270
  forfeit_bob:
    x: 3620
    y: 1220
  forfeit_alice:
    x: 3620
    y: 1670
  new_vtxo_leaf:
    x: 1520
    y: 1870
  new_bob_exit:
    x: 2220
    y: 1870
  new_batch_expiry:
    x: 1520
    y: 2320
-->
`;export{n as default};
