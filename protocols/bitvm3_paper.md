# BitVM3 paper - Ethereum / finality-certificate bridge

The paper's Ethereum variant uses a deposit swap: a committee authorizes moving a user's Bitcoin request into the reserve, while Ethereum schedules wBTC minting after a delay. Revealing and relaying the cancellation secret aborts minting. To exit, the user swaps wBTC with an operator for BTC; the operator then burns that wBTC, naming the specific Bitcoin deposit it will claim.

Assert reveals garbled inputs for a SNARK proving the operator's finalized burn through Ethereum sync-committee handoffs from a setup bootstrap state. Any challenger can evaluate the published circuit; an invalid proof yields a false-output label that spends Assert's connector and blocks withdrawal. Otherwise Withdraw consumes both the reserve and the surviving connector after Delta. Committee verification of the garbling, N-of-N SIGHASH_ALL presignatures, and at least one signer's honest key deletion bind the withdrawal to the approved transaction pair. Timely challenger monitoring supplies the dispute protection; amounts and timing remain symbolic as in the paper.

Source: [BitVM3: Efficient Bitcoin Bridges via Garbled Circuits](https://eprint.iacr.org/2026/933.pdf)

```bridgeflow
color_groups:
  committee_presignature: blue
  operator_signature: green
  user_signature: teal
  secret_reveal: purple
  permissionless_challenge: red
  timeout_path: orange
```

## tx: request

```bridgeflow
label: Request
inputs:
  - label: user funds
outputs:
  - amount: u
    label: Deposit request
    spending_paths:
      - id: cancel_secret
        label: |-
          reveal s_a
          Hashlock(s_a)
      - id: committee_deposit
        label: |-
          N-of-N committee
          CheckCovenant
```

## tx: deposit

```bridgeflow
label: Deposit
inputs:
  - tx: request
    output: 0
    spending_path: committee_deposit
    sighash_flag: sighash_all
    color: committee_presignature
outputs:
  - amount: u
    label: Bridge reserve
    spending_paths:
      - id: committee_withdraw
        label: |-
          N-of-N committee
          Withdraw presigned for
          this Deposit + specific Assert
```

## tx: cancel

```bridgeflow
label: Cancel (reveal s_a)
inputs:
  - tx: request
    output: 0
    spending_path: cancel_secret
    arrow_label: relay s_a to abort mint
    color: secret_reveal
outputs:
  - amount: u
    label: Refund (schematic)
    spending_paths:
      - id: user
        label: user
```

## tx: assert_funding

```bridgeflow
label: Assert funding UTXO (template)
inputs:
  - label: operator funding; amount unspecified
outputs:
  - amount: "*"
    label: Proof commitment input
    spending_paths:
      - id: garbled_signature
        label: |-
          CheckGS(pk_GS)
          signature reveals garbled proof labels
```

## tx: swap_payout

```bridgeflow
label: Swap payout (Bitcoin leg)
inputs:
  - label: |-
      operator liquidity
      user transfers u wBTC on Ethereum
outputs:
  - amount: u - f_O
    label: User receives BTC
    spending_paths:
      - id: user
        label: user
```

## tx: assert_tx

```bridgeflow
label: Assert (Ethereum operator burn)
inputs:
  - tx: assert_funding
    output: 0
    spending_path: garbled_signature
    color: operator_signature
    label: |-
      SNARK: finalized operator burn
      sync-committee chain from bootstrap
      burn binds this Deposit UTXO
outputs:
  - amount: "*"
    label: Reimbursement connector
    spending_paths:
      - id: false_output_label
        label: |-
          any challenger with L*
          false-output label of garbled verifier
      - id: operator_timeout
        label: operator + CSV(Delta)
```

## tx: disprove

```bridgeflow
label: Disprove
inputs:
  - tx: assert_tx
    output: 0
    spending_path: false_output_label
    color: permissionless_challenge
    arrow_label: "invalid proof: reveal L*"
outputs:
  - amount: "*"
    label: Table 4 output (unspecified value)
    spending_paths:
      - id: anyone
        label: anyone (True)
```

## tx: withdraw

```bridgeflow
label: Withdraw
inputs:
  - tx: deposit
    output: 0
    spending_path: committee_withdraw
    sighash_flag: sighash_all
    color: committee_presignature
  - tx: assert_tx
    output: 0
    spending_path: operator_timeout
    color: timeout_path
    arrow_label: after Delta from Assert
outputs:
  - amount: u
    label: Operator reimbursement
    spending_paths:
      - id: operator
        label: operator
```

<!-- bridgeflow:layout
txs:
  assert_funding:
    x: 0
    y: 800
  assert_tx:
    x: 850
    y: 750
  cancel:
    x: 450
    y: 360
  deposit:
    x: 650
    y: 0
  disprove:
    x: 1680
    y: 800
  request:
    x: 0
    y: 0
  swap_payout:
    x: 0
    y: 430
  withdraw:
    x: 2050
    y: 0
-->
