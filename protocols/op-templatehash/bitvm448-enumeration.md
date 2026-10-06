# BitVM-448 - strict operator-removal enumeration

Users fund prepared reserve slots; operators front withdrawals and post bonded BitVM3 reimbursement assertions bound to the payout and slot. A false assertion reveals the operator's slashing secret to off-chain challengers. Cancellation restores the reserve, removes that operator, and pays its bond as miner fees. An unchallenged assertion returns the reserve amount and bond to the operator after the challenge window.

This optimistic variant assumes an OP_TEMPLATEHASH consensus change, sound BitVM3 garbling and assertion setup, available assertion data, and timely challenges. It precomputes every remaining-operator subset, making setup exponential. Slots have fixed amounts and parameters; recovery after all operators are removed is unspecified.

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
    label: Reserve {A,B}
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
          TH(return D to Funds_{B})
          bond B paid as miner fee
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
label: Cancel A / redeposit
inputs:
  - tx: assert_a
    output: 0
    spending_path: cancel
    color: fraud
    arrow_label: s_A; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve {B}
    spending_paths:
      - id: assert_b
        label: |-
          O_B + publish BitVM3 assertion
          TH(prepared Assert_B template)
```

## tx: assert_b_after_a

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
          TH(return D to Funds_empty)
          bond B paid as miner fee
```

## tx: withdraw_b_after_a

```bridgeflow
label: Withdraw B / reimbursement + bond
inputs:
  - tx: assert_b_after_a
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

## tx: cancel_b_after_a

```bridgeflow
label: Cancel B / redeposit
inputs:
  - tx: assert_b_after_a
    output: 0
    spending_path: cancel
    color: fraud
    arrow_label: s_B; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve empty
    spending_paths:
      - id: recovery_unspecified
        label: |-
          No further assertion in this model
          migration / recovery unspecified
```

## tx: assert_b

```bridgeflow
label: Assert B / reserve + fresh bond
inputs:
  - tx: deposit
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
          TH(return D to Funds_{A})
          bond B paid as miner fee
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
label: Cancel B / redeposit
inputs:
  - tx: assert_b
    output: 0
    spending_path: cancel
    color: fraud
    arrow_label: s_B; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve {A}
    spending_paths:
      - id: assert_a
        label: |-
          O_A + publish BitVM3 assertion
          TH(prepared Assert_A template)
```

## tx: assert_a_after_b

```bridgeflow
label: Assert A / reserve + fresh bond
inputs:
  - tx: cancel_b
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
          TH(return D to Funds_empty)
          bond B paid as miner fee
```

## tx: withdraw_a_after_b

```bridgeflow
label: Withdraw A / reimbursement + bond
inputs:
  - tx: assert_a_after_b
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

## tx: cancel_a_after_b

```bridgeflow
label: Cancel A / redeposit
inputs:
  - tx: assert_a_after_b
    output: 0
    spending_path: cancel
    color: fraud
    arrow_label: s_A; B = 0.01 BTC fee
outputs:
  - amount: "1.00000000"
    label: Reserve empty
    spending_paths:
      - id: recovery_unspecified
        label: |-
          No further assertion in this model
          migration / recovery unspecified
```

<!-- bridgeflow:layout
txs:
  deposit:
    x: 100
    y: 950
  assert_a:
    x: 1200
    y: 100
  withdraw_a:
    x: 2350
    y: 100
  cancel_a:
    x: 2350
    y: 750
  assert_b_after_a:
    x: 3500
    y: 750
  withdraw_b_after_a:
    x: 4650
    y: 650
  cancel_b_after_a:
    x: 4650
    y: 1250
  assert_b:
    x: 1200
    y: 2200
  withdraw_b:
    x: 2350
    y: 2200
  cancel_b:
    x: 2350
    y: 2850
  assert_a_after_b:
    x: 3500
    y: 2850
  withdraw_a_after_b:
    x: 4650
    y: 2750
  cancel_a_after_b:
    x: 4650
    y: 3350
-->
