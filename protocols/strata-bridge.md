# Strata bridge

Users submit a deposit request containing destination and recovery data; N-of-N signers accept it into the reserve, or the user reclaims it after 1008 blocks. A staked operator pays the withdrawing user from its own wallet, then seeks reimbursement. Signers can authorize a cooperative payout, or the operator posts Claim and waits 144 blocks for an uncontested payout.

A watchtower's Contest requires an operator bridge proof and creates separate payout, slashing, and per-watchtower counterproof connectors. The operator can reject a counterproof through its fault-key NACK path; a counterproof that survives its response window is acknowledged by consuming the payout connector. A missing bridge proof also consumes that connector, blocking reimbursement. If no counterproof survives, ContestedPayout consumes the reserve and remaining control connectors. Otherwise the surviving slash connector can consume the operator's stake after 1008 blocks and pay watchtowers. Admin and unstaking-secret burns can separately disable a claim. Proof verification and fault-key derivation are abstracted by the graph's spending conditions.

Source: [alpenlabs/strata-bridge](https://github.com/alpenlabs/strata-bridge)

```bridgeflow
color_groups:
  nofn_signature: blue
  watchtower_path: green
  operator_fault: red
  admin_path: purple
```

## tx: deposit_request_tx

```bridgeflow
label: Deposit Request TX
inputs:
  - label: user
outputs:
  - amount: "10.00001000"
    spending_paths:
      - id: nofn_drt_spend
        label: |-
          DRT
          N-of-N
      - id: user_takeback_1008
        label: user in 1008 blocks
  - amount: "0.00000000"
    spending_paths:
      - id: drt_metadata
        label: |-
          OP_RETURN
          recovery_pk + destination
```

## tx: deposit_tx

```bridgeflow
label: Deposit TX
inputs:
  - tx: deposit_request_tx
    output: 0
    spending_path: nofn_drt_spend
    color: nofn_signature
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: deposit_header
        label: |-
          OP_RETURN
          deposit_idx
  - amount: "10.00000000"
    spending_paths:
      - id: deposit_nofn
        label: N-of-N
```

## tx: user_takeback_tx

```bridgeflow
label: User takeback
inputs:
  - tx: deposit_request_tx
    output: 0
    spending_path: user_takeback_1008
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: user
        label: user
```

## tx: stake_tx

```bridgeflow
label: Stake TX
inputs:
  - label: |-
      1 BTC
      operator
outputs:
  - amount: "0.00000330"
    spending_paths:
      - id: unstaking_intent
        label: |-
          unstaking intent
          operator
  - amount: "1.00000000"
    spending_paths:
      - id: stake_nofn
        label: |-
          operator stake
          N-of-N
  - amount: "0.00000330"
    spending_paths:
      - id: operator_anchor
        label: operator CPFP anchor
```

## tx: withdrawal_fulfillment_tx

```bridgeflow
label: Withdrawal fulfillment TX
inputs:
  - label: operator wallet
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: fulfillment_header
        label: |-
          OP_RETURN
          deposit_idx
  - amount: "9.90000000"
    spending_paths:
      - id: user_withdrawal
        label: user
  - amount: "0.00000000"
    spending_paths:
      - id: operator_change
        label: operator change
```

## tx: cooperative_payout_tx

```bridgeflow
label: Cooperative payout TX
inputs:
  - tx: deposit_tx
    output: 1
    spending_path: deposit_nofn
    color: nofn_signature
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: operator_payout
        label: operator
```

## tx: claim_tx

```bridgeflow
label: Claim TX
inputs:
  - label: |-
      claim funding UTXO
      operator
outputs:
  - amount: "0.00010000"
    spending_paths:
      - id: watchtower_contest
        label: |-
          N-of-N
          +
          watchtower_i
      - id: uncontested_after_144
        label: N-of-N in 144 blocks
  - amount: "0.00000330"
    spending_paths:
      - id: claim_payout_nofn
        label: N-of-N payout
      - id: admin_burn
        label: admin burn
      - id: unstaking_burn
        label: unstaking preimage
  - amount: "0.00000330"
    spending_paths:
      - id: operator_anchor
        label: operator CPFP anchor
```

## tx: uncontested_payout_tx

```bridgeflow
label: Uncontested payout TX
inputs:
  - tx: deposit_tx
    output: 1
    spending_path: deposit_nofn
    color: nofn_signature
  - tx: claim_tx
    output: 0
    spending_path: uncontested_after_144
    color: nofn_signature
  - tx: claim_tx
    output: 1
    spending_path: claim_payout_nofn
    color: nofn_signature
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: operator_payout
        label: operator
```

## tx: admin_burn_tx

```bridgeflow
label: Admin burn
inputs:
  - tx: claim_tx
    output: 1
    spending_path: admin_burn
    color: admin_path
outputs: []
```

## tx: unstaking_burn_tx

```bridgeflow
label: Unstaking burn
inputs:
  - tx: claim_tx
    output: 1
    spending_path: unstaking_burn
outputs: []
```

## tx: contest_tx

```bridgeflow
label: Contest TX
inputs:
  - tx: claim_tx
    output: 0
    spending_path: watchtower_contest
    color: nofn_signature
outputs:
  - amount: "0.00001000"
    spending_paths:
      - id: operator_bridge_proof
        label: |-
          operator proof key
          +tweak(game_index)
      - id: proof_timeout_144
        label: N-of-N in 144 blocks
  - amount: "0.00000330"
    spending_paths:
      - id: contest_payout_normal
        label: N-of-N
      - id: contest_payout_timeout_144
        label: N-of-N in 144 blocks
  - amount: "0.00000330"
    spending_paths:
      - id: contest_slash_normal
        label: N-of-N
      - id: contest_slash_timeout_1008
        label: N-of-N in 1008 blocks
  - amount: "0.00002000"
    spending_paths:
      - id: counterproof_w0
        label: |-
          N-of-N
          +
          operator adaptor sigs
          for watchtower_0
  - amount: "0.00002000"
    spending_paths:
      - id: counterproof_per_watchtower
        label: |-
          same output
          per watchtower
  - amount: "0.00000330"
    spending_paths:
      - id: watchtower_anchor
        label: watchtower CPFP anchor
```

## tx: bridge_proof_tx

```bridgeflow
label: Bridge proof TX
inputs:
  - tx: contest_tx
    output: 0
    spending_path: operator_bridge_proof
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: bridge_proof_data
        label: |-
          OP_RETURN
          bridge proof
```

## tx: bridge_proof_timeout_tx

```bridgeflow
label: Bridge proof timeout TX
inputs:
  - tx: contest_tx
    output: 0
    spending_path: proof_timeout_144
    color: nofn_signature
  - tx: contest_tx
    output: 1
    spending_path: contest_payout_normal
    color: nofn_signature
outputs:
  - amount: "0.00001330"
    spending_paths:
      - id: watchtower_anchor
        label: watchtower CPFP anchor
```

## tx: counterproof_w0_tx

```bridgeflow
label: Counterproof W0 TX
inputs:
  - tx: contest_tx
    output: 3
    spending_path: counterproof_w0
    color: nofn_signature
    label: invalid bridge proof
outputs:
  - amount: "0.00001000"
    spending_paths:
      - id: counterproof_nack
        label: |-
          wt_fault key
          NACK
      - id: counterproof_ack_144
        label: |-
          N-of-N in 144 blocks
          ACK
  - amount: "0.00000330"
    spending_paths:
      - id: watchtower_anchor
        label: watchtower CPFP anchor
```

## tx: counterproof_nack_w0_tx

```bridgeflow
label: Counterproof NACK W0 TX
inputs:
  - tx: counterproof_w0_tx
    output: 0
    spending_path: counterproof_nack
    color: operator_fault
outputs:
  - amount: "0.00000670"
    spending_paths:
      - id: operator
        label: operator
```

## tx: counterproof_ack_w0_tx

```bridgeflow
label: Counterproof ACK W0 TX
inputs:
  - tx: counterproof_w0_tx
    output: 0
    spending_path: counterproof_ack_144
    color: nofn_signature
  - tx: contest_tx
    output: 1
    spending_path: contest_payout_normal
    color: nofn_signature
outputs:
  - amount: "0.00001330"
    spending_paths:
      - id: watchtower_anchor
        label: watchtower CPFP anchor
```

## tx: contested_payout_tx

```bridgeflow
label: Contested payout TX
inputs:
  - tx: deposit_tx
    output: 1
    spending_path: deposit_nofn
    color: nofn_signature
  - tx: claim_tx
    output: 1
    spending_path: claim_payout_nofn
    color: nofn_signature
  - tx: contest_tx
    output: 1
    spending_path: contest_payout_timeout_144
    color: nofn_signature
    label: no ACK / all NACKed
  - tx: contest_tx
    output: 2
    spending_path: contest_slash_normal
    color: nofn_signature
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: operator_payout
        label: operator
```

## tx: slash_tx

```bridgeflow
label: Slash TX
inputs:
  - tx: contest_tx
    output: 2
    spending_path: contest_slash_timeout_1008
    color: nofn_signature
  - tx: stake_tx
    output: 1
    spending_path: stake_nofn
    color: nofn_signature
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: slash_header
        label: |-
          OP_RETURN
          slash(operator_idx)
  - amount: "1.00000000"
    spending_paths:
      - id: watchtowers
        label: watchtower descriptors
```

<!-- bridgeflow:layout
txs:
  admin_burn_tx:
    x: 1320
    y: 910
  bridge_proof_timeout_tx:
    x: 2193
    y: 1270
  bridge_proof_tx:
    x: 2170
    y: 441
  claim_tx:
    x: 774
    y: 618
  contest_tx:
    x: 1600
    y: 520
  contested_payout_tx:
    x: 2900
    y: 420
  cooperative_payout_tx:
    x: 920
    y: 0
  counterproof_ack_w0_tx:
    x: 2890
    y: 970
  counterproof_nack_w0_tx:
    x: 3118
    y: 598
  counterproof_w0_tx:
    x: 2364
    y: 746
  deposit_request_tx:
    x: 80
    y: 120
  deposit_tx:
    x: 520
    y: 120
  slash_tx:
    x: 3500
    y: 760
  stake_tx:
    x: 2317
    y: 1624
  uncontested_payout_tx:
    x: 1600
    y: 120
  unstaking_burn_tx:
    x: 1320
    y: 1040
  user_takeback_tx:
    x: 520
    y: 360
  withdrawal_fulfillment_tx:
    x: 1278
    y: -199
-->
