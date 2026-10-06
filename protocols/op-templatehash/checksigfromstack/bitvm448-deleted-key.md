# BitVM-448 - CSFS deleted-key recursion

Users fund prepared reserve slots; operators front withdrawals and post bonded BitVM3 assertions bound to the payout and slot. Off-chain challengers use a false assertion's revealed secret to cancel reimbursement. Cancellation recreates the same reserve and pays the bond as miner fees; the secret also permits cancelling that operator's later attempts. Unchallenged assertions mature after the challenge window.

OP_TEMPLATEHASH and CHECKSIGFROMSTACK consensus changes enable indefinite covenant recursion with per-template setup signatures and at least one N-of-N participant honestly deleting its key share. This optimistic protocol also assumes sound BitVM3 garbling and assertion setup, available assertion data, and timely challenges. Recurring covenants do not make single-use assertion artifacts reusable.

Source: [BitVM-448: Covenant-Based BitVM3 Bridges](https://robinlinus.com/bitvm448.pdf)

```bridgeflow
tx_width: 640
color_groups:
  covenant: blue
  proof: purple
  deposit_tbd: gray
  timeout: orange
  fraud: red
  recursion: teal
```

## tx: deposit

```bridgeflow
label: Deposit / prepared slot
inputs:
  - label: |-
      User funds: 1 BTC
      unused published slot root
outputs:
  - amount: "1.00000000"
    label: Reserve {A,B} (same script)
    spending_paths:
      - id: assert_a
        label: |-
          O_A + publish BitVM3 assertion
          TH(prepared Assert_A template)
      - id: assert_b
        label: |-
          O_B + publish BitVM3 assertion
          TH(prepared Assert_B template)
```

## tx: assert_a

```bridgeflow
label: Assert A / reserve + fresh bond
inputs:
  - tx: deposit
    output: 0
    spending_path: assert_a
    color: covenant
    label: |-
      Publish assertion data
      bind peg-out + reserve slot
  - label: |-
      O_A: arbitrary funding input
      0.01 BTC bond + kickoff fee
outputs:
  - amount: "1.01000000"
    label: Asserted reserve + O_A bond
    spending_paths:
      - id: withdraw
        label: |-
          O_A + CSV(Delta)
          TH(Withdraw_A: D+B)
      - id: cancel
        label: |-
          Anyone reveals s_A; H(s_A)=h_A
          TH + CSFS(setup signature)
          recreate identical reserve covenant
```

## tx: withdraw_a

```bridgeflow
label: Withdraw A / reimbursement + bond
inputs:
  - tx: assert_a
    output: 0
    spending_path: withdraw
    color: timeout
    arrow_label: CSV(Delta)
outputs:
  - amount: "1.01000000"
    label: ""
    spending_paths:
      - id: owner
        label: O_A
```

## tx: cancel_a

```bridgeflow
label: Cancel A / recreate reserve
inputs:
  - tx: assert_a
    output: 0
    spending_path: cancel
    color: recursion
    arrow_label: s_A; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve {A,B} (same script)
    spending_paths:
      - id: assert_a
        label: |-
          O_A + publish BitVM3 assertion
          TH(prepared Assert_A template)
      - id: assert_b
        label: |-
          O_B + publish BitVM3 assertion
          TH(prepared Assert_B template)
```

## tx: assert_a_again

```bridgeflow
label: Assert A / reserve + fresh bond
inputs:
  - tx: cancel_a
    output: 0
    spending_path: assert_a
    color: covenant
    label: |-
      Publish assertion data
      bind peg-out + reserve slot
  - label: |-
      O_A: arbitrary funding input
      0.01 BTC bond + kickoff fee
outputs:
  - amount: "1.01000000"
    label: Asserted reserve + O_A bond
    spending_paths:
      - id: withdraw
        label: |-
          O_A + CSV(Delta)
          TH(Withdraw_A: D+B)
      - id: cancel
        label: |-
          Anyone reveals s_A; H(s_A)=h_A
          TH + CSFS(setup signature)
          recreate identical reserve covenant
```

## tx: withdraw_a_again

```bridgeflow
label: Withdraw A / reimbursement + bond
inputs:
  - tx: assert_a_again
    output: 0
    spending_path: withdraw
    color: timeout
    arrow_label: CSV(Delta)
outputs:
  - amount: "1.01000000"
    label: ""
    spending_paths:
      - id: owner
        label: O_A
```

## tx: cancel_a_again

```bridgeflow
label: Cancel A / recreate reserve
inputs:
  - tx: assert_a_again
    output: 0
    spending_path: cancel
    color: recursion
    arrow_label: s_A; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve {A,B} (same script)
    spending_paths:
      - id: assert_a
        label: |-
          O_A + publish BitVM3 assertion
          TH(prepared Assert_A template)
      - id: assert_b
        label: |-
          O_B + publish BitVM3 assertion
          TH(prepared Assert_B template)
```

## tx: assert_b

```bridgeflow
label: Assert B / reserve + fresh bond
inputs:
  - tx: cancel_a
    output: 0
    spending_path: assert_b
    color: covenant
    label: |-
      Publish assertion data
      bind peg-out + reserve slot
  - label: |-
      O_B: arbitrary funding input
      0.01 BTC bond + kickoff fee
outputs:
  - amount: "1.01000000"
    label: Asserted reserve + O_B bond
    spending_paths:
      - id: withdraw
        label: |-
          O_B + CSV(Delta)
          TH(Withdraw_B: D+B)
      - id: cancel
        label: |-
          Anyone reveals s_B; H(s_B)=h_B
          TH + CSFS(setup signature)
          recreate identical reserve covenant
```

## tx: withdraw_b

```bridgeflow
label: Withdraw B / reimbursement + bond
inputs:
  - tx: assert_b
    output: 0
    spending_path: withdraw
    color: timeout
    arrow_label: CSV(Delta)
outputs:
  - amount: "1.01000000"
    label: ""
    spending_paths:
      - id: owner
        label: O_B
```

## tx: cancel_b

```bridgeflow
label: Cancel B / recreate reserve
inputs:
  - tx: assert_b
    output: 0
    spending_path: cancel
    color: recursion
    arrow_label: s_B; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve {A,B} (same script)
    spending_paths:
      - id: assert_a
        label: |-
          O_A + publish BitVM3 assertion
          TH(prepared Assert_A template)
      - id: assert_b
        label: |-
          O_B + publish BitVM3 assertion
          TH(prepared Assert_B template)
```

<!-- bridgeflow:layout
txs:
  deposit:
    x: 100
    y: 100
  assert_a:
    x: 1200
    y: 100
  withdraw_a:
    x: 2350
    y: 100
  cancel_a:
    x: 2350
    y: 750
  assert_a_again:
    x: 3500
    y: 500
  withdraw_a_again:
    x: 4650
    y: 350
  cancel_a_again:
    x: 4650
    y: 950
  assert_b:
    x: 3500
    y: 1900
  withdraw_b:
    x: 4650
    y: 1800
  cancel_b:
    x: 4650
    y: 2400
-->
