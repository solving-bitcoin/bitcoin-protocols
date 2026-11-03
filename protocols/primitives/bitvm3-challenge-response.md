# BitVM3 challenge response primitive

```bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  watchtower_challenge: purple
  operator_response: green
  fraud_proof: red
  timeout: orange
```

## tx: operator_collateral

```bridgeflow
label: Operator collateral
inputs:
  - label: |-
      1 BTC
      operator funds
outputs:
  - amount: "1.00000000"
    label: Slash Connector
    spending_paths:
      - id: resolve
        label: |-
          setup multisig
          presigned Slash / DisproveTimeout
          both bind the finalizer
          setup keys deleted
```

## tx: challenge

```bridgeflow
label: Watchtower challenge (longest-chain proof)
inputs:
  - label: |-
      0.00000660 BTC
      operator + watchtower setup UTXO
      verified garbled-circuit setup
      presigned graph; setup keys deleted
    color: setup_signature
  - label: |-
      watchtower signature
      + Winternitz commitment to
      longest-chain proof and claim data
    color: watchtower_challenge
outputs:
  - amount: "0.00000330"
    label: Assert Connector
    spending_paths:
      - id: assert
        label: |-
          operator + watchtower adaptor signatures
          BitVM3 proof bound to the challenge
          reveals garbled-circuit inputs
      - id: assert_timeout
        label: anyone after 18 blocks
  - amount: "0.00000330"
    label: Challenge Finalizer Connector
    spending_paths:
      - id: finalize_or_slash
        label: |-
          setup multisig; presigned spends only
          DisproveTimeout consumes this connector
          anyone can broadcast Slash after 54 blocks
```

## tx: assert_tx

```bridgeflow
label: Operator BitVM3 proof (Assert)
inputs:
  - tx: challenge
    output: 0
    spending_path: assert
    color: operator_response
    arrow_label: respond within 18 blocks
outputs:
  - amount: "0.00000330"
    label: Disprove Connector
    spending_paths:
      - id: disprove
        label: |-
          anyone + published Argo disprove preimage
          revealed by an incorrect proof
      - id: disprove_timeout
        label: operator after 18 blocks
```

## tx: assert_timeout

```bridgeflow
label: No operator response (AssertTimeout)
inputs:
  - tx: challenge
    output: 0
    spending_path: assert_timeout
    color: timeout
    arrow_label: after 18 blocks; finalizer remains unspent
outputs: []
```

## tx: disprove

```bridgeflow
label: Incorrect proof (Disprove)
inputs:
  - tx: assert_tx
    output: 0
    spending_path: disprove
    color: fraud_proof
    arrow_label: watchtower publishes preimage; finalizer remains unspent
outputs: []
```

## tx: disprove_timeout

```bridgeflow
label: Correct proof (DisproveTimeout)
inputs:
  - tx: assert_tx
    output: 0
    spending_path: disprove_timeout
    color: timeout
    arrow_label: after 18 blocks without Disprove
  - tx: challenge
    output: 1
    spending_path: finalize_or_slash
    color: setup_signature
    arrow_label: consumes finalizer; disables Slash
  - tx: operator_collateral
    output: 0
    spending_path: resolve
    color: setup_signature
    sighash_flag: sighash_all
    arrow_label: presigned collateral return
outputs:
  - amount: "1.00000000"
    label: Operator collateral returned
    spending_paths:
      - id: operator
        label: operator
```

## tx: slash

```bridgeflow
label: Slash (anyone broadcasts)
inputs:
  - tx: operator_collateral
    output: 0
    spending_path: resolve
    color: setup_signature
    sighash_flag: sighash_all
    arrow_label: presigned together with the finalizer input
  - tx: challenge
    output: 1
    spending_path: finalize_or_slash
    color: timeout
    arrow_label: after 54 blocks; unresolved challenge
outputs: []
```

<!-- bridgeflow:layout
txs:
  assert_timeout:
    x: 1196
    y: 293
  assert_tx:
    x: 640
    y: 80
  challenge:
    x: 120
    y: 80
  disprove:
    x: 1160
    y: 80
  disprove_timeout:
    x: 1160
    y: 420
  operator_collateral:
    x: 642
    y: 702
  slash:
    x: 1297
    y: 760
-->
