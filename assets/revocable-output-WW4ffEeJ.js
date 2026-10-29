const e=`# Revocable delayed output primitive

A commitment or second-stage HTLC transaction pays its broadcaster through a delayed output. The broadcaster can spend after D blocks using its delayed key; the counterparty can spend immediately using the derived revocation key once that state’s secret has been disclosed. Advancing the channel first secures a new commitment, then revokes the old one. Revocation does not erase an old transaction or automatically transfer its coins: the counterparty or watchtower must detect publication and confirm a penalty before the broadcaster’s delayed spend wins. The paths shown are alternatives; the revocation key is unavailable to the counterparty for a current unrevoked state. Amounts are illustrative BTC and exclude fees.

Sources (snapshot reviewed 2026-09-27): [BOLT 3 to_local](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/03-transactions.md#to_local-output); [revocation keys](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/03-transactions.md#revocationpubkey-derivation); [revoking states](https://github.com/lightning/bolts/blob/1aadb719b4007c4cea0ba6e36b08c4fb53788dee/02-peer-protocol.md#committing-updates-so-far-commitment_signed).

\`\`\`bridgeflow
tx_width: 480
color_groups:
  unilateral_exit: teal
  forfeit: red
\`\`\`

## tx: commitment

\`\`\`bridgeflow
label: Commitment state n
inputs:
  - label: |-
      2-of-2 channel funding
      or second-stage HTLC
outputs:
  - amount: "0.01000000"
    label: Alice delayed balance
    spending_paths:
      - id: delay
        label: Alice + CSV(D)
      - id: revoke
        label: |-
          Bob revocation key
          only if n was revoked
\`\`\`

## tx: delayed_claim

\`\`\`bridgeflow
label: Alice delayed claim
inputs:
  - tx: commitment
    output: 0
    spending_path: delay
    color: unilateral_exit
    arrow_label: CSV(D)
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Alice
\`\`\`

## tx: penalty

\`\`\`bridgeflow
label: Bob revocation claim
inputs:
  - tx: commitment
    output: 0
    spending_path: revoke
    color: forfeit
    arrow_label: requires revoked state n
outputs:
  - amount: "0.01000000"
    spending_paths:
      - id: owner
        label: Bob
\`\`\`

<!-- bridgeflow:layout
txs:
  commitment:
    x: 120
    y: 340
  delayed_claim:
    x: 820
    y: 120
  penalty:
    x: 820
    y: 620
-->
`;export{e as default};
