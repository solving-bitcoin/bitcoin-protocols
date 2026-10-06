# Timestamp-only Bitcoin light client — deferred withdrawal proof

Users fund a reserve, and an operator publishes signed epoch-end timestamps without header hashes or chain proofs. Anyone can disable a stalled timestamp stream through its timeout spend. After paying a withdrawing user, the operator requests reimbursement and supplies a header chain and withdrawal evidence matching the published timestamps. An assumed verifier checks the chain, publication deadlines, claim, and payout, then binds reimbursement to the matching reserve and withdrawal gate.

The design requires an agreed Bitcoin checkpoint, independently authenticated publication observations, explicit timing bounds, and sound proof enforcement with transaction binding. The Bitcoin implementation and its resource requirements remain unspecified; canonical-chain security is unproved. Disabling the stream blocks this withdrawal route, while reserve recovery is outside the graph.

References: Bitcoin Core v29.0 [difficulty adjustment](https://github.com/bitcoin/bitcoin/blob/v29.0/src/pow.cpp), [network parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp), [header validation](https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp), and [median-time calculation](https://github.com/bitcoin/bitcoin/blob/v29.0/src/chain.h); [BIP 65](https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki) and [BIP 113](https://github.com/bitcoin/bips/blob/master/bip-0113.mediawiki).

```bridgeflow
color_groups:
  timestamp_signature: green
  deferred_proof: purple
  payout_binding: blue
  deadline: orange
```

## tx: setup

```bridgeflow
label: Setup reserve and agreed bootstrap
inputs:
  - label: User reserve funds + operator control funds
outputs:
  - amount: "1.00000000"
    label: Reserve — proof-enforcement adapter assumed
    spending_paths:
      - id: bound_withdrawal
        label: |-
          Adapter binds this reserve to
          matching verified withdrawal gate
          and exact authorized payout
  - amount: "0.00000330"
    label: Timestamp stream seed
    spending_paths:
      - id: operator_record
        label: Operator transaction signature
      - id: missed_record
        label: Anyone + CLTV(H_i)
```

## tx: timestamp_i

```bridgeflow
label: Timestamp i — sign and publish T_i
inputs:
  - tx: setup
    output: 1
    spending_path: operator_record
    sighash_flag: sighash_all
    color: timestamp_signature
    arrow_label: nLockTime = T_i - delta_future; non-final sequence
outputs:
  - amount: "0.00000330"
    label: Timestamp chain control
    spending_paths:
      - id: operator_record
        label: Operator transaction signature
      - id: missed_record
        label: Anyone + CLTV(H_(i+1))
  - amount: "0.00000000"
    label: |-
      OP_RETURN(domain, network, reserve, i, h_i, T_i)
      No header hash; no chain proof
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: timestamp_next

```bridgeflow
label: Timestamp i+1 — sign and publish T_(i+1)
inputs:
  - tx: timestamp_i
    output: 0
    spending_path: operator_record
    sighash_flag: sighash_all
    color: timestamp_signature
    arrow_label: nLockTime = T_(i+1) - delta_future; non-final sequence
outputs:
  - amount: "0.00000330"
    label: Latest timestamp control
    spending_paths:
      - id: operator_continue_or_claim
        label: Operator — next timestamp or withdrawal request
      - id: missed_record
        label: Anyone + CLTV(H_(i+2))
  - amount: "0.00000000"
    label: |-
      OP_RETURN(domain, network, reserve, i+1, h_(i+1), T_(i+1))
      No header hash; no chain proof
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: timeout_first_record

```bridgeflow
label: Disable stream after missing first timestamp
inputs:
  - tx: setup
    output: 1
    spending_path: missed_record
    color: deadline
    arrow_label: CLTV(H_i); conflicts with Timestamp i
outputs:
  - amount: "0.00000000"
    label: Disabled timestamp stream
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: timeout_next_record

```bridgeflow
label: Disable stream after missing next timestamp
inputs:
  - tx: timestamp_i
    output: 0
    spending_path: missed_record
    color: deadline
    arrow_label: CLTV(H_(i+1)); conflicts with Timestamp i+1
outputs:
  - amount: "0.00000000"
    label: Disabled timestamp stream
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: timeout_latest_record

```bridgeflow
label: Disable stream after missing continuation
inputs:
  - tx: timestamp_next
    output: 0
    spending_path: missed_record
    color: deadline
    arrow_label: CLTV(H_(i+2)); conflicts with withdrawal request
outputs:
  - amount: "0.00000000"
    label: Disabled timestamp stream
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: user_payout

```bridgeflow
label: Operator pays withdrawing user
inputs:
  - label: Operator liquidity + application withdrawal authorization
outputs:
  - amount: "1.00000000"
    label: User receives BTC
    spending_paths:
      - id: user
        label: User signature
```

## tx: request_withdrawal

```bridgeflow
label: Freeze timestamp transcript for withdrawal
inputs:
  - tx: timestamp_next
    output: 0
    spending_path: operator_continue_or_claim
    sighash_flag: sighash_all
    color: timestamp_signature
    arrow_label: Deadline and transcript checked by adapter
outputs:
  - amount: "0.00000330"
    label: Withdrawal gate — adapter assumed
    spending_paths:
      - id: deferred_chain_proof
        label: |-
          Operator + VerifyDeferredChain(P)
          Agreed bootstrap + authenticated transcript
          Every signed T_j matches header at h_j
          PoW + retargets + MTP + timing + confirmations
          Claim + user payout + exact reserve binding
```

## tx: withdraw

```bridgeflow
label: Withdraw — prove chain using earlier signed timestamps
inputs:
  - tx: setup
    output: 0
    spending_path: bound_withdrawal
    color: payout_binding
    arrow_label: Adapter enforces joint spend and payout
  - tx: request_withdrawal
    output: 0
    spending_path: deferred_chain_proof
    color: deferred_proof
    label: |-
      Supply complete chain and claim witness
      or sound proof of the same predicate
      Invalid proof cannot spend this gate
outputs:
  - amount: "1.00000000"
    label: Operator reimbursement
    spending_paths:
      - id: operator
        label: Operator signature
  - amount: "0.00000330"
    label: Operator control change
    spending_paths:
      - id: operator
        label: Operator signature
```

<!-- bridgeflow:layout
txs:
  request_withdrawal:
    x: 2092
    y: 160
  setup:
    x: 89
    y: 92
  timeout_first_record:
    x: 819
    y: 410
  timeout_latest_record:
    x: 2366
    y: -252
  timeout_next_record:
    x: 1624
    y: 420
  timestamp_i:
    x: 757
    y: -60
  timestamp_next:
    x: 1401
    y: -136
  user_payout:
    x: 491
    y: 746
  withdraw:
    x: 2941
    y: 475
-->
