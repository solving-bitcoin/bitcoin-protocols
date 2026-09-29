# Lightning payment channel — commitments and HTLCs

Alice and Bob fund a 2-of-2 output and exchange signatures for two alternative commitment transactions, one broadcastable by each peer. Payments update these commitments off-chain; after a new state is secured, revocation secrets make the previous state punishable. This example has a pending 0.1 BTC payment from Alice to Bob, with 0.4 BTC and 0.5 BTC otherwise allocated to them. A cooperative close after fulfillment pays the final balances directly.

If either peer forces closure, the broadcaster’s balance is CSV-delayed while the other peer’s balance is immediately spendable. On Alice’s commitment, Bob claims the offered HTLC with its preimage, or Alice uses the presigned, absolute-time-locked HTLC-timeout transaction. On Bob’s commitment, Bob uses the presigned HTLC-success transaction with the preimage, or Alice refunds after expiry. Second-stage HTLC outputs also delay the broadcaster. If state n has been revoked, the counterparty can instead take its revocable outputs immediately, including second-stage outputs; monitoring or a watchtower must respond in time. This is BOLT 3’s non-anchor, static-remote-key form. D is to_self_delay and H is the HTLC expiry height. Amounts omit fees and dust trimming; all funding spends conflict.

Sources (snapshot reviewed 2026-09-27): [BOLT 3 at 1aadb71](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/03-transactions.md); [state updates](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/02-peer-protocol.md#normal-operation); [on-chain resolution](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/05-onchain.md).

Primitives: revocable output, hash-time-locked contract (in primitives/).

```bridgeflow
tx_width: 480
color_groups:
  setup_signature: blue
  cooperative: green
  unilateral_exit: teal
  timeout: orange
  forfeit: red
  preimage: purple
```

## tx: funding

```bridgeflow
label: Channel funding
inputs:
  - label: Alice + Bob on-chain funds
outputs:
  - amount: "1.00000000"
    label: Channel funding output
    spending_paths:
      - id: both
        label: |-
          Alice + Bob
          2-of-2 funding keys
```

## tx: cooperative_close

```bridgeflow
label: Cooperative close (paid)
inputs:
  - tx: funding
    output: 0
    spending_path: both
    color: cooperative
outputs:
  - amount: "0.40000000"
    spending_paths:
      - id: owner
        label: Alice
  - amount: "0.60000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: alice_commitment

```bridgeflow
label: "State n: Alice commitment"
inputs:
  - tx: funding
    output: 0
    spending_path: both
    color: setup_signature
outputs:
  - amount: "0.40000000"
    label: Alice delayed balance
    spending_paths:
      - id: delay
        label: Alice + CSV(D)
      - id: revoke
        label: |-
          Bob revocation key
          only if n was revoked
  - amount: "0.50000000"
    label: to_remote
    spending_paths:
      - id: owner
        label: Bob
  - amount: "0.10000000"
    label: Offered HTLC (Alice to Bob)
    spending_paths:
      - id: success
        label: |-
          Bob + preimage r
          H(r) = payment_hash
      - id: timeout
        label: |-
          Alice + Bob presigned
          HTLC-timeout, nLockTime=H
      - id: revoke
        label: |-
          Bob revocation key
          only if n was revoked
```

## tx: bob_commitment

```bridgeflow
label: "State n: Bob commitment"
inputs:
  - tx: funding
    output: 0
    spending_path: both
    color: setup_signature
outputs:
  - amount: "0.50000000"
    label: Bob delayed balance
    spending_paths:
      - id: delay
        label: Bob + CSV(D)
      - id: revoke
        label: |-
          Alice revocation key
          only if n was revoked
  - amount: "0.40000000"
    label: to_remote
    spending_paths:
      - id: owner
        label: Alice
  - amount: "0.10000000"
    label: Received HTLC (Alice to Bob)
    spending_paths:
      - id: success
        label: |-
          Alice + Bob presigned
          HTLC-success + preimage r
      - id: timeout
        label: Alice + CLTV(H)
      - id: revoke
        label: |-
          Alice revocation key
          only if n was revoked
```

## tx: alice_balance

```bridgeflow
label: Alice delayed balance
inputs:
  - tx: alice_commitment
    output: 0
    spending_path: delay
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.40000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: bob_direct_balance

```bridgeflow
label: Bob direct balance
inputs:
  - tx: alice_commitment
    output: 1
    spending_path: owner
    color: unilateral_exit
outputs:
  - amount: "0.50000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: bob_preimage_claim

```bridgeflow
label: Bob direct HTLC claim
inputs:
  - tx: alice_commitment
    output: 2
    spending_path: success
    color: preimage
outputs:
  - amount: "0.10000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: htlc_timeout

```bridgeflow
label: Presigned HTLC-timeout
inputs:
  - tx: alice_commitment
    output: 2
    spending_path: timeout
    color: timeout
    arrow_label: nLockTime = H
outputs:
  - amount: "0.10000000"
    label: Alice delayed balance
    spending_paths:
      - id: delay
        label: Alice + CSV(D)
      - id: revoke
        label: |-
          Bob revocation key
          only if n was revoked
```

## tx: timeout_claim

```bridgeflow
label: Alice timeout-output claim
inputs:
  - tx: htlc_timeout
    output: 0
    spending_path: delay
    color: unilateral_exit
    arrow_label: CSV(D) from HTLC-timeout
outputs:
  - amount: "0.10000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: timeout_penalty

```bridgeflow
label: Bob second-stage penalty
inputs:
  - tx: htlc_timeout
    output: 0
    spending_path: revoke
    color: forfeit
    arrow_label: only revoked state n
outputs:
  - amount: "0.10000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: alice_commitment_penalty

```bridgeflow
label: Bob justice (revoked n)
inputs:
  - tx: alice_commitment
    output: 0
    spending_path: revoke
    color: forfeit
  - tx: alice_commitment
    output: 2
    spending_path: revoke
    color: forfeit
outputs:
  - amount: "0.50000000"
    label: Revocable outputs
    spending_paths:
      - id: owner
        label: Bob
```

## tx: bob_balance

```bridgeflow
label: Bob delayed balance
inputs:
  - tx: bob_commitment
    output: 0
    spending_path: delay
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.50000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: alice_direct_balance

```bridgeflow
label: Alice direct balance
inputs:
  - tx: bob_commitment
    output: 1
    spending_path: owner
    color: unilateral_exit
outputs:
  - amount: "0.40000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: alice_htlc_refund

```bridgeflow
label: Alice direct HTLC refund
inputs:
  - tx: bob_commitment
    output: 2
    spending_path: timeout
    color: timeout
    arrow_label: CLTV(H)
outputs:
  - amount: "0.10000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: htlc_success

```bridgeflow
label: Presigned HTLC-success
inputs:
  - tx: bob_commitment
    output: 2
    spending_path: success
    color: preimage
    arrow_label: r + both HTLC signatures
outputs:
  - amount: "0.10000000"
    label: Bob delayed balance
    spending_paths:
      - id: delay
        label: Bob + CSV(D)
      - id: revoke
        label: |-
          Alice revocation key
          only if n was revoked
```

## tx: success_claim

```bridgeflow
label: Bob success-output claim
inputs:
  - tx: htlc_success
    output: 0
    spending_path: delay
    color: unilateral_exit
    arrow_label: CSV(D) from HTLC-success
outputs:
  - amount: "0.10000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: success_penalty

```bridgeflow
label: Alice second-stage penalty
inputs:
  - tx: htlc_success
    output: 0
    spending_path: revoke
    color: forfeit
    arrow_label: only revoked state n
outputs:
  - amount: "0.10000000"
    spending_paths:
      - id: owner
        label: Alice
```

## tx: bob_commitment_penalty

```bridgeflow
label: Alice justice (revoked n)
inputs:
  - tx: bob_commitment
    output: 0
    spending_path: revoke
    color: forfeit
  - tx: bob_commitment
    output: 2
    spending_path: revoke
    color: forfeit
outputs:
  - amount: "0.60000000"
    label: Revocable outputs
    spending_paths:
      - id: owner
        label: Alice
```

<!-- bridgeflow:layout
txs:
  alice_balance:
    x: 1520
    y: 470
  alice_commitment:
    x: 820
    y: 670
  alice_commitment_penalty:
    x: 1320
    y: 1870
  alice_direct_balance:
    x: 1520
    y: 2570
  alice_htlc_refund:
    x: 1620
    y: 2870
  bob_balance:
    x: 1520
    y: 2270
  bob_commitment:
    x: 820
    y: 2370
  bob_commitment_penalty:
    x: 1320
    y: 3670
  bob_direct_balance:
    x: 1520
    y: 770
  bob_preimage_claim:
    x: 1520
    y: 1070
  cooperative_close:
    x: 820
    y: 120
  funding:
    x: 120
    y: 1170
  htlc_success:
    x: 1520
    y: 3170
  htlc_timeout:
    x: 1520
    y: 1370
  success_claim:
    x: 2220
    y: 3020
  success_penalty:
    x: 2220
    y: 3420
  timeout_claim:
    x: 2220
    y: 1220
  timeout_penalty:
    x: 2220
    y: 1620
-->
