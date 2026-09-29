# FLEX - Bob predeposit variant (Figure 2)

```bridgeflow
color_groups:
  setup_presignature: blue
  alice: purple
  bob: pink
  bond_funding: green
  timeout: orange
  other_asserters: yellow
```

## tx: peg_in

```bridgeflow
label: Peg-in
inputs:
  - label: Peg funds; side-system peg-in outside this graph
outputs:
  - amount: v
    label: Peg funds
    spending_paths:
      - id: direct
        label: |-
          Alice + Bob live signatures
          agreed direct payment to Carol
      - id: reimburse
        label: |-
          Setup presignatures: Reimbursement
          also consumes reimbursement enabler
      - id: fast_reimburse
        label: |-
          Setup presignatures: FastReimburse
          also consumes both Start enablers
```

## tx: direct_transfer

```bridgeflow
label: DirectTransfer (Section 6.3)
inputs:
  - tx: peg_in
    output: 0
    spending_path: direct
    color: alice
outputs:
  - amount: v
    label: Agreed direct payment
    spending_paths:
      - id: carol
        label: Carol signature
```

## tx: front_payment

```bridgeflow
label: Alice fronts Carol (Section 6.1)
inputs:
  - label: Alice liquidity; Carol burns wrapped BTC on the side-system
outputs:
  - amount: v
    label: Fronted payment; fees unspecified
    spending_paths:
      - id: carol
        label: Carol signature
```

## tx: start

```bridgeflow
label: Start
inputs:
  - label: Alice start funding; control amount unspecified
outputs:
  - amount: "*"
    label: Enable Dispute
    spending_paths:
      - id: dispute
        label: |-
          Setup presignatures: Dispute
          CSV(1 TL) from Start
      - id: fast
        label: "Setup presignatures: FastReimburse"
  - amount: "*"
    label: Enable Bob Pre-deposit
    spending_paths:
      - id: predeposit
        label: |-
          Setup presignatures: BobPreDeposit
          ANYONECANPAY; dynamic funding
      - id: fast
        label: |-
          Setup presignatures: FastReimburse
          CSV(1 TL) from Start
```

## tx: bob_predeposit

```bridgeflow
label: BobPreDeposit
inputs:
  - tx: start
    output: 1
    spending_path: predeposit
    color: setup_presignature
    sighash_flag: sighash_anyonecanpay
  - label: Bob adds c BTC for Alice input-publication cost; fee/change unspecified
outputs:
  - amount: c
    label: Prepayment for proof publication
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: fast_reimburse

```bridgeflow
label: FastReimburse
inputs:
  - tx: peg_in
    output: 0
    spending_path: fast_reimburse
    color: setup_presignature
  - tx: start
    output: 0
    spending_path: fast
    color: setup_presignature
  - tx: start
    output: 1
    spending_path: fast
    color: timeout
    arrow_label: 1 TL after Start; conflicts with BobPreDeposit
outputs:
  - amount: v
    label: Fast reimbursement
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: dispute

```bridgeflow
label: Dispute
inputs:
  - tx: start
    output: 0
    spending_path: dispute
    color: timeout
    arrow_label: 1 TL after Start; Alice or Bob can issue
outputs:
  - amount: "*"
    label: Reimburse Enabler
    spending_paths:
      - id: reimburse
        label: |-
          Setup presignatures: Reimbursement
          CSV(3 TL) from Dispute
      - id: alice_lost
        label: |-
          Setup presignatures: AliceLost
          reveal Pb; H(Pb) = Vb
      - id: missing_alice
        label: "Setup presignatures: MissingAliceDeposit"
  - amount: "*"
    label: Alice Deposit
    spending_paths:
      - id: deposit
        label: |-
          Setup presignatures: AliceDeposit
          Alice Lamport OTS of burn SNARK
          ANYONECANPAY; dynamic funding
      - id: missing
        label: |-
          Setup presignatures: MissingAliceDeposit
          CSV(1 TL) from Dispute
  - amount: "*"
    label: Bob Deposit
    spending_paths:
      - id: deposit
        label: |-
          Setup presignatures: BobDeposit
          Alice and Bob Lamport OTS of the same SNARK
          ANYONECANPAY; dynamic funding
      - id: missing
        label: |-
          Setup presignatures: MissingBobDeposit
          CSV(2 TL) from Dispute
```

## tx: alice_deposit

```bridgeflow
label: AliceDeposit
inputs:
  - tx: dispute
    output: 1
    spending_path: deposit
    color: setup_presignature
    sighash_flag: sighash_anyonecanpay
    label: Alice OTS publishes her circuit input labels
  - label: Alice adds bond funding; c prepayment funds publication; allocation/fee details unspecified
outputs:
  - amount: "*"
    label: potA (c adjustment unspecified; unspendable internal key)
    spending_paths:
      - id: bob_pb
        label: |-
          Bob signature + Pb
          H(Pb) = Vb
      - id: alice_pa
        label: |-
          Alice signature + Pa
          H(Pa) = Va
      - id: owner_timeout
        label: |-
          Alice signature + CSV(2 TL)
          from this deposit
```

## tx: bob_deposit

```bridgeflow
label: BobDeposit
inputs:
  - tx: dispute
    output: 2
    spending_path: deposit
    color: setup_presignature
    sighash_flag: sighash_anyonecanpay
    label: |-
      Witness: Alice OTS + Bob OTS
      Script checks both sign the same SNARK
      Bob labels feed Bob circuit
  - label: Bob adds bond funding adjusted for c prepayment; allocation/fee details unspecified
outputs:
  - amount: "*"
    label: potB (c adjustment unspecified; unspendable internal key)
    spending_paths:
      - id: bob_pb
        label: |-
          Bob signature + Pb
          H(Pb) = Vb
      - id: alice_pa
        label: |-
          Alice signature + Pa
          H(Pa) = Va
      - id: owner_timeout
        label: |-
          Bob signature + CSV(2 TL)
          from this deposit
```

## tx: missing_alice_deposit

```bridgeflow
label: MissingAliceDeposit
inputs:
  - tx: dispute
    output: 0
    spending_path: missing_alice
    color: setup_presignature
  - tx: dispute
    output: 1
    spending_path: missing
    color: timeout
    arrow_label: 1 TL after Dispute
outputs:
  - amount: "*"
    label: Bob wins; reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: missing_bob_deposit

```bridgeflow
label: MissingBobDeposit
inputs:
  - tx: dispute
    output: 2
    spending_path: missing
    color: timeout
    arrow_label: 2 TL after Dispute
outputs:
  - amount: "*"
    label: Alice wins; reimbursement still waits 3 TL
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: alice_lost

```bridgeflow
label: AliceLost
inputs:
  - tx: dispute
    output: 0
    spending_path: alice_lost
    color: bob
    arrow_label: Pb from off-chain evaluation of Alice circuit
outputs:
  - amount: "*"
    label: Bob wins; reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: reimbursement

```bridgeflow
label: Reimbursement
inputs:
  - tx: peg_in
    output: 0
    spending_path: reimburse
    color: setup_presignature
  - tx: dispute
    output: 0
    spending_path: reimburse
    color: timeout
    arrow_label: 3 TL after Dispute
outputs:
  - amount: v
    label: Alice reimbursement
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: alice_takes_alice_deposit

```bridgeflow
label: ATakesADeposit
inputs:
  - tx: alice_deposit
    output: 0
    spending_path: alice_pa
    color: alice
    arrow_label: reveal Pa
outputs:
  - amount: "*"
    label: Alice's bond claimed by Alice
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: bob_takes_alice_deposit

```bridgeflow
label: BTakesADeposit
inputs:
  - tx: alice_deposit
    output: 0
    spending_path: bob_pb
    color: bob
    arrow_label: reveal Pb
outputs:
  - amount: "*"
    label: Alice's bond claimed by Bob
    spending_paths:
      - id: bob
        label: Bob signature
```

## tx: alice_takes_deposit_by_timeout

```bridgeflow
label: ATakesADepositByTimeout
inputs:
  - tx: alice_deposit
    output: 0
    spending_path: owner_timeout
    color: timeout
    arrow_label: 2 TL after AliceDeposit
outputs:
  - amount: "*"
    label: Alice's bond returned
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: alice_takes_bob_deposit

```bridgeflow
label: ATakesBDeposit
inputs:
  - tx: bob_deposit
    output: 0
    spending_path: alice_pa
    color: alice
    arrow_label: reveal Pa
outputs:
  - amount: "*"
    label: Bob's bond claimed by Alice
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: bob_takes_bob_deposit

```bridgeflow
label: BTakesBDeposit
inputs:
  - tx: bob_deposit
    output: 0
    spending_path: bob_pb
    color: bob
    arrow_label: reveal Pb
outputs:
  - amount: "*"
    label: Bob's bond claimed by Bob
    spending_paths:
      - id: bob
        label: Bob signature
```

## tx: bob_takes_deposit_by_timeout

```bridgeflow
label: BTakesBDepositByTimeout
inputs:
  - tx: bob_deposit
    output: 0
    spending_path: owner_timeout
    color: timeout
    arrow_label: 2 TL after BobDeposit
outputs:
  - amount: "*"
    label: Bob's bond returned
    spending_paths:
      - id: bob
        label: Bob signature
```
