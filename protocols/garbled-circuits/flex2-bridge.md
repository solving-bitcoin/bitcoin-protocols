# FLEX2 - optimistic bridge with early refund (A = B = 0)

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
label: Peg-In
inputs:
  - label: Peg funds; side-system peg-in outside this graph
outputs:
  - amount: v
    label: Peg funds
    spending_paths:
      - id: direct
        label: |-
          n-of-n live signatures for DirectTransfer
          also consumes n-of-n take
      - id: early
        label: "Setup presignatures: EarlyRefund"
      - id: refund
        label: "Setup presignatures: Refund"
  - amount: "*"
    label: n-of-n take
    spending_paths:
      - id: direct
        label: n-of-n live signature for DirectTransfer
      - id: cancel
        label: "Setup presignatures: CancelDirectTransfer"
  - amount: "*"
    label: Start Refund by Alice
    spending_paths:
      - id: start
        label: |-
          Setup presignatures: StartDispute
          issued by Alice
```

## tx: direct_transfer

```bridgeflow
label: DirectTransfer
inputs:
  - tx: peg_in
    output: 0
    spending_path: direct
    color: setup_presignature
  - tx: peg_in
    output: 1
    spending_path: direct
    color: setup_presignature
outputs:
  - amount: v
    label: Cooperative payment
    spending_paths:
      - id: carol
        label: Carol signature
```

## tx: cancel_direct_transfer

```bridgeflow
label: CancelDirectTransfer
inputs:
  - tx: peg_in
    output: 1
    spending_path: cancel
    color: setup_presignature
outputs:
  - amount: "*"
    label: Direct payment disabled
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: front_payment

```bridgeflow
label: Alice fronts Carol
inputs:
  - label: Alice liquidity; Carol burns wrapped BTC on the side-system
outputs:
  - amount: v
    label: Fronted payment; fees unspecified
    spending_paths:
      - id: carol
        label: Carol signature
```

## tx: start_dispute

```bridgeflow
label: StartDispute
inputs:
  - tx: peg_in
    output: 2
    spending_path: start
    color: setup_presignature
outputs:
  - amount: "*"
    label: Try
    spending_paths:
      - id: try_early
        label: |-
          Setup presignatures: TryEarlyRefund
          CSV(1 TL) from StartDispute
  - amount: "*"
    label: Reimburse Enabler / Alice Can Win
    spending_paths:
      - id: early
        label: "Setup presignatures: EarlyRefund"
      - id: refund
        label: |-
          Setup presignatures: Refund
          CSV(5 TL) from StartDispute
      - id: stalled_1
        label: "Setup presignatures: DisputeIsStalled1"
      - id: stalled_2
        label: "Setup presignatures: DisputeIsStalled2"
      - id: missing_alice_deposit
        label: "Setup presignatures: MissingAliceDeposit"
      - id: missing_alice_input
        label: "Setup presignatures: MissingAliceInput"
      - id: invalid
        label: |-
          Setup presignatures: InvalidAssertion
          reveal Pb; H(Pb) = Vb
  - amount: "*"
    label: Bob Challenge Enabler
    spending_paths:
      - id: challenge
        label: |-
          Setup presignatures: BobChallenge
          issued by Bob
      - id: no_challenge
        label: |-
          Setup presignatures: NoBobChallenge
          CSV(1 TL) from StartDispute
      - id: stalled
        label: |-
          Setup presignatures: DisputeIsStalled1
          CSV(2 TL) from StartDispute
          other asserter authorization unspecified
```

## tx: try_early_refund

```bridgeflow
label: TryEarlyRefund
inputs:
  - tx: start_dispute
    output: 0
    spending_path: try_early
    color: timeout
    arrow_label: 1 TL after StartDispute
outputs:
  - amount: "*"
    label: Reimbursement Tried / Alice tries to win early
    spending_paths:
      - id: early
        label: |-
          Setup presignatures: EarlyRefund
          CSV(1 TL) from TryEarlyRefund
      - id: still_open
        label: |-
          Setup presignatures: StillOpen
          also consumes dispute Close
```

## tx: early_refund

```bridgeflow
label: EarlyRefund
inputs:
  - tx: peg_in
    output: 0
    spending_path: early
    color: setup_presignature
  - tx: try_early_refund
    output: 0
    spending_path: early
    color: timeout
    arrow_label: 1 TL after TryEarlyRefund; Bob can block with StillOpen
  - tx: start_dispute
    output: 1
    spending_path: early
    color: setup_presignature
outputs:
  - amount: v
    label: Early reimbursement
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: refund

```bridgeflow
label: Refund
inputs:
  - tx: peg_in
    output: 0
    spending_path: refund
    color: setup_presignature
  - tx: start_dispute
    output: 1
    spending_path: refund
    color: timeout
    arrow_label: 5 TL after StartDispute
outputs:
  - amount: v
    label: Ordinary reimbursement
    spending_paths:
      - id: alice
        label: Alice signature
```

## tx: no_bob_challenge

```bridgeflow
label: NoBobChallenge
inputs:
  - tx: start_dispute
    output: 2
    spending_path: no_challenge
    color: timeout
    arrow_label: 1 TL after StartDispute
outputs:
  - amount: "*"
    label: Alice wins; BobChallenge disabled
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: dispute_is_stalled_1

```bridgeflow
label: DisputeIsStalled1
inputs:
  - tx: start_dispute
    output: 1
    spending_path: stalled_1
    color: other_asserters
  - tx: start_dispute
    output: 2
    spending_path: stalled
    color: other_asserters
    arrow_label: 2 TL after StartDispute
outputs:
  - amount: "*"
    label: Other asserter closes stalled dispute; Alice reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: bob_challenge

```bridgeflow
label: BobChallenge
inputs:
  - tx: start_dispute
    output: 2
    spending_path: challenge
    color: bob
outputs:
  - amount: "*"
    label: Alice Input
    spending_paths:
      - id: input
        label: |-
          Setup presignatures: AliceInput
          Alice Lamport OTS of burn SNARK
      - id: missing
        label: |-
          Setup presignatures: MissingAliceInput
          CSV(2 TL) from BobChallenge
  - amount: "*"
    label: Alice Deposit
    spending_paths:
      - id: deposit
        label: |-
          Setup presignatures: AliceDeposit
          ANYONECANPAY; dynamic funding
      - id: missing
        label: |-
          Setup presignatures: MissingAliceDeposit
          CSV(2 TL) from BobChallenge
  - amount: "*"
    label: Bob Deposit
    spending_paths:
      - id: deposit
        label: |-
          Setup presignatures: BobDeposit
          ANYONECANPAY; dynamic funding
      - id: missing
        label: |-
          Setup presignatures: MissingBobDeposit
          CSV(1 TL) from BobChallenge
  - amount: "*"
    label: Close (shared conflicting output)
    spending_paths:
      - id: missing_alice_deposit
        label: "Setup presignatures: MissingAliceDeposit"
      - id: missing_bob_deposit
        label: "Setup presignatures: MissingBobDeposit"
      - id: missing_alice_input
        label: "Setup presignatures: MissingAliceInput"
      - id: missing_bob_input
        label: "Setup presignatures: MissingBobInput"
      - id: invalid
        label: "Setup presignatures: InvalidAssertion"
      - id: correct
        label: "Setup presignatures: InputIsCorrect"
      - id: still_open
        label: "Setup presignatures: StillOpen"
      - id: disabled
        label: |-
          Setup presignatures: BobWasDisabled
          global preimage; setup unspecified
      - id: stalled
        label: |-
          Setup presignatures: DisputeIsStalled2
          CSV(5 TL) from BobChallenge
          other asserter authorization unspecified
```

## tx: alice_deposit

```bridgeflow
label: AliceDeposit
inputs:
  - tx: bob_challenge
    output: 1
    spending_path: deposit
    color: setup_presignature
    sighash_flag: sighash_anyonecanpay
  - label: Alice adds a live funding UTXO of at least d BTC; fees omitted
outputs:
  - amount: d
    label: potA (unspendable internal key)
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
  - tx: bob_challenge
    output: 2
    spending_path: deposit
    color: setup_presignature
    sighash_flag: sighash_anyonecanpay
  - label: Bob adds a live funding UTXO of at least d BTC; fees omitted
outputs:
  - amount: d
    label: potB (unspendable internal key)
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
          Bob signature + CSV(3 TL)
          from this deposit
```

## tx: alice_input

```bridgeflow
label: AliceInput
inputs:
  - tx: bob_challenge
    output: 0
    spending_path: input
    color: alice
    label: |-
      Alice OTS publishes her circuit labels
      After both bonds are posted (operational ordering)
outputs:
  - amount: "*"
    label: Bob Input
    spending_paths:
      - id: input
        label: |-
          Setup presignatures: BobInput
          Alice OTS + Bob OTS of the same SNARK
      - id: missing
        label: |-
          Setup presignatures: MissingBobInput
          CSV(1 TL) from AliceInput
```

## tx: bob_input

```bridgeflow
label: BobInput
inputs:
  - tx: alice_input
    output: 0
    spending_path: input
    color: bob
    label: |-
      Script checks Alice and Bob sign the same SNARK
      Bob OTS reveals Bob circuit labels
outputs:
  - amount: "*"
    label: Eval Bob Circuit
    spending_paths:
      - id: correct
        label: |-
          Setup presignatures: InputIsCorrect
          reveal Pa; H(Pa) = Va
```

## tx: missing_alice_deposit

```bridgeflow
label: MissingAliceDeposit
inputs:
  - tx: start_dispute
    output: 1
    spending_path: missing_alice_deposit
    color: setup_presignature
  - tx: bob_challenge
    output: 1
    spending_path: missing
    color: timeout
    arrow_label: 2 TL after BobChallenge
  - tx: bob_challenge
    output: 3
    spending_path: missing_alice_deposit
    color: setup_presignature
outputs:
  - amount: "*"
    label: Bob wins; Alice reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: missing_bob_deposit

```bridgeflow
label: MissingBobDeposit
inputs:
  - tx: bob_challenge
    output: 2
    spending_path: missing
    color: timeout
    arrow_label: 1 TL after BobChallenge
  - tx: bob_challenge
    output: 3
    spending_path: missing_bob_deposit
    color: setup_presignature
outputs:
  - amount: "*"
    label: Alice wins; dispute closed
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: missing_alice_input

```bridgeflow
label: MissingAliceInput
inputs:
  - tx: start_dispute
    output: 1
    spending_path: missing_alice_input
    color: setup_presignature
  - tx: bob_challenge
    output: 0
    spending_path: missing
    color: timeout
    arrow_label: 2 TL after BobChallenge
  - tx: bob_challenge
    output: 3
    spending_path: missing_alice_input
    color: setup_presignature
outputs:
  - amount: "*"
    label: Bob wins; Alice reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: missing_bob_input

```bridgeflow
label: MissingBobInput
inputs:
  - tx: alice_input
    output: 0
    spending_path: missing
    color: timeout
    arrow_label: 1 TL after AliceInput
  - tx: bob_challenge
    output: 3
    spending_path: missing_bob_input
    color: setup_presignature
outputs:
  - amount: "*"
    label: Alice wins; dispute closed
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: invalid_assertion

```bridgeflow
label: InvalidAssertion
inputs:
  - tx: start_dispute
    output: 1
    spending_path: invalid
    color: bob
    arrow_label: Pb from off-chain evaluation of Alice circuit
  - tx: bob_challenge
    output: 3
    spending_path: invalid
    color: setup_presignature
outputs:
  - amount: "*"
    label: Bob wins; Alice reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: input_is_correct

```bridgeflow
label: InputIsCorrect
inputs:
  - tx: bob_input
    output: 0
    spending_path: correct
    color: alice
    arrow_label: Pa from off-chain evaluation of Bob circuit
  - tx: bob_challenge
    output: 3
    spending_path: correct
    color: setup_presignature
outputs:
  - amount: "*"
    label: Alice wins; dispute closed
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: still_open

```bridgeflow
label: StillOpen
inputs:
  - tx: try_early_refund
    output: 0
    spending_path: still_open
    color: bob
  - tx: bob_challenge
    output: 3
    spending_path: still_open
    color: bob
outputs:
  - amount: "*"
    label: EarlyRefund blocked; dispute Close spent
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: bob_was_disabled

```bridgeflow
label: BobWasDisabled
inputs:
  - tx: bob_challenge
    output: 3
    spending_path: disabled
    color: alice
    label: Global preimage; origin and distribution unspecified
outputs:
  - amount: "*"
    label: Alice wins; dispute closed
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
```

## tx: dispute_is_stalled_2

```bridgeflow
label: DisputeIsStalled2
inputs:
  - tx: bob_challenge
    output: 3
    spending_path: stalled
    color: other_asserters
    arrow_label: 5 TL after BobChallenge
  - tx: start_dispute
    output: 1
    spending_path: stalled_2
    color: other_asserters
outputs:
  - amount: "*"
    label: Other asserter closes stalled dispute; Alice reimbursement blocked
    spending_paths:
      - id: unspecified
        label: Result output/script unspecified in paper
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
  - amount: d
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
  - amount: d
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
  - amount: d
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
  - amount: d
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
  - amount: d
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
    arrow_label: 3 TL after BobDeposit
outputs:
  - amount: d
    label: Bob's bond returned
    spending_paths:
      - id: bob
        label: Bob signature
```
