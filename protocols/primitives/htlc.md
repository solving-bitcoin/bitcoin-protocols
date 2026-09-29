# Hash-time-locked contract primitive

Alice locks value so Bob can spend with his signature and the preimage of an agreed hash; Alice can instead refund after an absolute expiry. Revealing the preimage on one leg can unlock another leg of a swap or routed payment, provided the expiries leave enough time to act. Expiry enables the refund but does not disable Bob’s preimage path: after expiry, unconfirmed competing claims race for the same output. This minimal standalone HTLC extracts the hash/timeout choice from the Lightning graph; Lightning adds commitment signatures, revocation, and second-stage delays. Amounts are illustrative BTC and exclude fees.

Sources (snapshot reviewed 2026-09-27): [BOLT 3 HTLC paths](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/03-transactions.md#received-htlc-outputs); [BIP 65 absolute timelocks](https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki).

```bridgeflow
tx_width: 480
color_groups:
  timeout: orange
  preimage: purple
```

## tx: lock

```bridgeflow
label: Fund HTLC
inputs:
  - label: Alice funds
outputs:
  - amount: "0.01000000"
    label: HTLC
    spending_paths:
      - id: claim
        label: |-
          Bob + preimage r
          H(r) = payment_hash
      - id: refund
        label: Alice + CLTV(H)
```

## tx: claim

```bridgeflow
label: Preimage claim
inputs:
  - tx: lock
    output: 0
    spending_path: claim
    color: preimage
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Bob
```

## tx: refund

```bridgeflow
label: Timeout refund
inputs:
  - tx: lock
    output: 0
    spending_path: refund
    color: timeout
    arrow_label: CLTV(H)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
```

<!-- bridgeflow:layout
txs:
  lock:
    x: 120
    y: 340
  claim:
    x: 820
    y: 120
  refund:
    x: 820
    y: 620
-->
