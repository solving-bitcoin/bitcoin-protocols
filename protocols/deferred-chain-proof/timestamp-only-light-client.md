# Timestamp-only Bitcoin light client — epoch fan-out

An operator publishes signed timestamps along one transaction chain. Each epoch also funds a Fanout with independent garbled-circuit outputs; the graph shows two epochs and two circuits per fan-out. Spending a circuit output requires its own Lamport signature verification and creates Assert, revealing that circuit's proof-input labels. The proof covers **all previous signed timestamps** from bootstrap through that epoch, their header-chain correspondence, publication timing, and the claim. A watchtower evaluates the Argo/BitVM3-style garbled verifier off-chain. If the proof is invalid, Disprove slashes the slot's funds; otherwise the operator can Withdraw after Delta from Assert.

Signing a different timestamp for an already signed epoch exposes conflicting Lamport openings under that epoch's registered key. SlashTimestamp spends the same Assert output, so it also blocks Withdraw. Signing a new epoch with its own key is allowed. The illustrated funds are operator collateral; each circuit slot is independent and is slashed or withdrawn separately. The design assumes sound proofs, verified garbling, fresh circuit keys, an authenticated timestamp history, timely watchtowers, and setup signatures binding the graph. Concrete history/transaction binding and resource limits remain unspecified; amounts omit fees.

The intended **20% hashrate threshold is conditional**. A malicious operator could mine a private fork and manipulate its retarget timestamps to lower difficulty, producing more blocks per unit of hashpower. If authenticated timestamp commitments keep its difficulty at least one quarter of the honest chain's throughout the race, an attacker with fraction q of total hashpower has relative block-production rate at most 4q/(1−q). Staying slower requires 4q < 1−q, hence q < 1/5 = 20%; equality provides no security margin. Bitcoin's [factor-four retarget limit](https://github.com/bitcoin/bitcoin/blob/v29.0/src/pow.cpp) bounds each adjustment, not the difficulty ratio of arbitrary forks across many epochs. This timestamp-only construction still needs a proof of that global bound and assumptions on initial lead, timing, and confirmations; the calculation is a block-rate argument, not a guarantee of canonical chainwork.

References: [Argo MAC](https://eprint.iacr.org/2026/049); [BitVM3](https://bitvm.org/bitvm3.pdf), Sections 3.4–4; [Bitcoin Core v29.0 retarget calculation](https://github.com/bitcoin/bitcoin/blob/v29.0/src/pow.cpp).

```bridgeflow
tx_width: 480
color_groups:
  timestamp_signature: green
  setup_signature: blue
  garbled_inputs: purple
  timeout_path: orange
  disprove: red
  timestamp_equivocation: pink
```

## tx: setup

```bridgeflow
label: Setup
width: 480
inputs:
  - label: |-
      Operator funds: 0.04000330 BTC
      Agreed bootstrap + registered timestamp keys
outputs:
  - amount: "0.04000330"
    label: Epoch chain funding
    spending_paths:
      - id: operator_record
        label: Operator + prepared epoch transaction
```

## tx: timestamp_i

```bridgeflow
label: Timestamp i
width: 480
inputs:
  - tx: setup
    output: 0
    spending_path: operator_record
    color: timestamp_signature
    label: |-
      LamportSign(pk_T,i, T_i)
      Authenticated epoch-end record; no header hash
    sighash_flag: sighash_all
outputs:
  - amount: "0.02000330"
    label: Continue epoch chain
    spending_paths:
      - id: operator_record
        label: Operator — next epoch timestamp
  - amount: "0.02000000"
    label: Epoch i fan-out funds
    spending_paths:
      - id: fanout
        label: "Operator + setup signature: Fanout"
  - amount: "0.00000000"
    label: "Timestamp record: epoch i, T_i"
    spending_paths:
      - id: unspendable
        label: OP_RETURN(domain, operator, epoch, height, T)
```

## tx: fanout_i

```bridgeflow
label: Fanout i
width: 480
inputs:
  - tx: timestamp_i
    output: 1
    spending_path: fanout
    color: setup_signature
    label: |-
      Full authenticated history: T_0,...,T_i
      Same epoch keys reused in every circuit statement
outputs:
  - amount: "0.01000000"
    label: Garbled circuit GC_i,0
    spending_paths:
      - id: assert
        label: |-
          LamportVerify(pk_GC_i,0)
          Operator signs pi + statement
          Reveal this circuit's input labels
          Setup signature: this slot's Assert
  - amount: "0.01000000"
    label: Garbled circuit GC_i,1
    spending_paths:
      - id: assert
        label: |-
          LamportVerify(pk_GC_i,1)
          Operator signs pi + statement
          Reveal this circuit's input labels
          Setup signature: this slot's Assert
```

## tx: assert_i_0

```bridgeflow
label: Assert (i, 0)
width: 480
inputs:
  - tx: fanout_i
    output: 0
    spending_path: assert
    color: garbled_inputs
    label: |-
      Lamport proof signature for GC_i,0
      pi covers every timestamp T_0,...,T_i
      Header validity, publication timing and claim
outputs:
  - amount: "0.01000000"
    label: Asserted funds
    spending_paths:
      - id: withdraw
        label: |-
          Operator + CSV(Delta) from this Assert
          Setup signature: Withdraw
      - id: disprove
        label: |-
          Watchtower + false-output preimage
          from evaluating GC_i,0
      - id: timestamp_equivocation
        label: |-
          Watchtower + conflicting openings
          T_j != T'_j under the same pk_T,j
          Epoch j is in this signed history
```

## tx: withdraw_i_0

```bridgeflow
label: Withdraw (i, 0)
width: 480
inputs:
  - tx: assert_i_0
    output: 0
    spending_path: withdraw
    color: timeout_path
    arrow_label: Delta after Assert
outputs:
  - amount: "0.01000000"
    label: Operator withdraws slot funds
    spending_paths:
      - id: operator
        label: Operator signature
```

## tx: disprove_i_0

```bridgeflow
label: Disprove / Slash (i, 0)
width: 480
inputs:
  - tx: assert_i_0
    output: 0
    spending_path: disprove
    color: disprove
    label: False-output key from GC_i,0
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: slash_timestamp_i_0

```bridgeflow
label: SlashTimestamp (i, 0)
width: 480
inputs:
  - tx: assert_i_0
    output: 0
    spending_path: timestamp_equivocation
    color: timestamp_equivocation
    label: |-
      Two openings for a differing timestamp bit
      Same operator, domain and epoch key
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: assert_i_1

```bridgeflow
label: Assert (i, 1)
width: 480
inputs:
  - tx: fanout_i
    output: 1
    spending_path: assert
    color: garbled_inputs
    label: |-
      Lamport proof signature for GC_i,1
      pi covers every timestamp T_0,...,T_i
      Header validity, publication timing and claim
outputs:
  - amount: "0.01000000"
    label: Asserted funds
    spending_paths:
      - id: withdraw
        label: |-
          Operator + CSV(Delta) from this Assert
          Setup signature: Withdraw
      - id: disprove
        label: |-
          Watchtower + false-output preimage
          from evaluating GC_i,1
      - id: timestamp_equivocation
        label: |-
          Watchtower + conflicting openings
          T_j != T'_j under the same pk_T,j
          Epoch j is in this signed history
```

## tx: withdraw_i_1

```bridgeflow
label: Withdraw (i, 1)
width: 480
inputs:
  - tx: assert_i_1
    output: 0
    spending_path: withdraw
    color: timeout_path
    arrow_label: Delta after Assert
outputs:
  - amount: "0.01000000"
    label: Operator withdraws slot funds
    spending_paths:
      - id: operator
        label: Operator signature
```

## tx: disprove_i_1

```bridgeflow
label: Disprove / Slash (i, 1)
width: 480
inputs:
  - tx: assert_i_1
    output: 0
    spending_path: disprove
    color: disprove
    label: False-output key from GC_i,1
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: slash_timestamp_i_1

```bridgeflow
label: SlashTimestamp (i, 1)
width: 480
inputs:
  - tx: assert_i_1
    output: 0
    spending_path: timestamp_equivocation
    color: timestamp_equivocation
    label: |-
      Two openings for a differing timestamp bit
      Same operator, domain and epoch key
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: timestamp_next

```bridgeflow
label: Timestamp i+1
width: 480
inputs:
  - tx: timestamp_i
    output: 0
    spending_path: operator_record
    color: timestamp_signature
    label: |-
      LamportSign(pk_T,i+1, T_i+1)
      Authenticated epoch-end record; no header hash
    sighash_flag: sighash_all
outputs:
  - amount: "0.00000330"
    label: Continue epoch chain
    spending_paths:
      - id: operator_record
        label: Operator — next epoch timestamp
  - amount: "0.02000000"
    label: Epoch i+1 fan-out funds
    spending_paths:
      - id: fanout
        label: "Operator + setup signature: Fanout"
  - amount: "0.00000000"
    label: "Timestamp record: epoch i+1, T_i+1"
    spending_paths:
      - id: unspendable
        label: OP_RETURN(domain, operator, epoch, height, T)
```

## tx: fanout_next

```bridgeflow
label: Fanout i+1
width: 480
inputs:
  - tx: timestamp_next
    output: 1
    spending_path: fanout
    color: setup_signature
    label: |-
      Full authenticated history: T_0,...,T_i+1
      Same epoch keys reused in every circuit statement
outputs:
  - amount: "0.01000000"
    label: Garbled circuit GC_i+1,0
    spending_paths:
      - id: assert
        label: |-
          LamportVerify(pk_GC_i+1,0)
          Operator signs pi + statement
          Reveal this circuit's input labels
          Setup signature: this slot's Assert
  - amount: "0.01000000"
    label: Garbled circuit GC_i+1,1
    spending_paths:
      - id: assert
        label: |-
          LamportVerify(pk_GC_i+1,1)
          Operator signs pi + statement
          Reveal this circuit's input labels
          Setup signature: this slot's Assert
```

## tx: assert_next_0

```bridgeflow
label: Assert (i+1, 0)
width: 480
inputs:
  - tx: fanout_next
    output: 0
    spending_path: assert
    color: garbled_inputs
    label: |-
      Lamport proof signature for GC_i+1,0
      pi covers every timestamp T_0,...,T_i+1
      Header validity, publication timing and claim
outputs:
  - amount: "0.01000000"
    label: Asserted funds
    spending_paths:
      - id: withdraw
        label: |-
          Operator + CSV(Delta) from this Assert
          Setup signature: Withdraw
      - id: disprove
        label: |-
          Watchtower + false-output preimage
          from evaluating GC_i+1,0
      - id: timestamp_equivocation
        label: |-
          Watchtower + conflicting openings
          T_j != T'_j under the same pk_T,j
          Epoch j is in this signed history
```

## tx: withdraw

```bridgeflow
label: Withdraw (i+1, 0)
width: 480
inputs:
  - tx: assert_next_0
    output: 0
    spending_path: withdraw
    color: timeout_path
    arrow_label: Delta after Assert
outputs:
  - amount: "0.01000000"
    label: Operator withdraws slot funds
    spending_paths:
      - id: operator
        label: Operator signature
```

## tx: disprove_next_0

```bridgeflow
label: Disprove / Slash (i+1, 0)
width: 480
inputs:
  - tx: assert_next_0
    output: 0
    spending_path: disprove
    color: disprove
    label: False-output key from GC_i+1,0
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: slash_timestamp_next_0

```bridgeflow
label: SlashTimestamp (i+1, 0)
width: 480
inputs:
  - tx: assert_next_0
    output: 0
    spending_path: timestamp_equivocation
    color: timestamp_equivocation
    label: |-
      Two openings for a differing timestamp bit
      Same operator, domain and epoch key
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: assert_next_1

```bridgeflow
label: Assert (i+1, 1)
width: 480
inputs:
  - tx: fanout_next
    output: 1
    spending_path: assert
    color: garbled_inputs
    label: |-
      Lamport proof signature for GC_i+1,1
      pi covers every timestamp T_0,...,T_i+1
      Header validity, publication timing and claim
outputs:
  - amount: "0.01000000"
    label: Asserted funds
    spending_paths:
      - id: withdraw
        label: |-
          Operator + CSV(Delta) from this Assert
          Setup signature: Withdraw
      - id: disprove
        label: |-
          Watchtower + false-output preimage
          from evaluating GC_i+1,1
      - id: timestamp_equivocation
        label: |-
          Watchtower + conflicting openings
          T_j != T'_j under the same pk_T,j
          Epoch j is in this signed history
```

## tx: withdraw_next_1

```bridgeflow
label: Withdraw (i+1, 1)
width: 480
inputs:
  - tx: assert_next_1
    output: 0
    spending_path: withdraw
    color: timeout_path
    arrow_label: Delta after Assert
outputs:
  - amount: "0.01000000"
    label: Operator withdraws slot funds
    spending_paths:
      - id: operator
        label: Operator signature
```

## tx: disprove_next_1

```bridgeflow
label: Disprove / Slash (i+1, 1)
width: 480
inputs:
  - tx: assert_next_1
    output: 0
    spending_path: disprove
    color: disprove
    label: False-output key from GC_i+1,1
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

## tx: slash_timestamp_next_1

```bridgeflow
label: SlashTimestamp (i+1, 1)
width: 480
inputs:
  - tx: assert_next_1
    output: 0
    spending_path: timestamp_equivocation
    color: timestamp_equivocation
    label: |-
      Two openings for a differing timestamp bit
      Same operator, domain and epoch key
outputs:
  - amount: "0.01000000"
    label: Slashed operator funds
    spending_paths:
      - id: unspendable
        label: OP_RETURN — unspendable
```

<!-- bridgeflow:layout
txs:
  assert_i_0:
    x: 1500
    y: 470
  assert_i_1:
    x: 1500
    y: 1290
  assert_next_0:
    x: 1500
    y: 2420
  assert_next_1:
    x: 1500
    y: 3240
  disprove_i_0:
    x: 2220
    y: 680
  disprove_i_1:
    x: 2220
    y: 1500
  disprove_next_0:
    x: 2220
    y: 2630
  disprove_next_1:
    x: 2220
    y: 3450
  fanout_i:
    x: 800
    y: 650
  fanout_next:
    x: 800
    y: 2600
  setup:
    x: -555
    y: 619
  slash_timestamp_i_0:
    x: 2220
    y: 950
  slash_timestamp_i_1:
    x: 2220
    y: 1770
  slash_timestamp_next_0:
    x: 2220
    y: 2900
  slash_timestamp_next_1:
    x: 2220
    y: 3720
  timestamp_i:
    x: 100
    y: 650
  timestamp_next:
    x: 100
    y: 2600
  withdraw:
    x: 2220
    y: 2360
  withdraw_i_0:
    x: 2220
    y: 410
  withdraw_i_1:
    x: 2220
    y: 1230
  withdraw_next_1:
    x: 2220
    y: 3180
-->
