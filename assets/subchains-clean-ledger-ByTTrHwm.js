const n=`# OP_CAT subchains - clean ledger

Anyone can publish a subblock by spending and recreating the shared funds covenant, at most once per Bitcoin block. Subblock data is published in the Taproot annex, and an OP_RETURN output commits to the growing history. Every transition requires a valid STARK proof, including carrying the reserve forward and paying a Bitcoin withdrawal.

The design assumes OP_CAT, annex relay support, and a STARK verifier that fits in one Bitcoin transaction. Deposit aggregation and crediting remain unspecified in the source and are shown schematically. The example adds 0.1 BTC to a 1 BTC reserve, then withdraws 0.25 BTC; fees are omitted.

Source: [Bitcoin Subchains via OP_CAT and the Taproot Annex](https://gist.github.com/RobinLinus/8183bec5040e75d57642e69bfaa22a6f/33a4129d75f9ae6ee2c686e2f09c284e9087ed61)

\`\`\`bridgeflow
tx_width: 640
color_groups:
  covenant: blue
  proof: purple
  deposit_tbd: gray
  timeout: orange
  fraud: red
  recursion: teal
\`\`\`

## tx: subblock_i

\`\`\`bridgeflow
label: Existing subblock i
inputs:
  - label: |-
      Previously funded reserve
      1 BTC, prior subchain history
outputs:
  - amount: "1.00000000"
    label: Funds / state_i
    spending_paths:
      - id: carry
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          keep the full reserve
      - id: aggregate_tbd
        label: |-
          CAT + CSV(1) + STARK
          aggregation / credit covenant TBD
      - id: withdraw
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          authorized Bitcoin payouts
  - amount: "0.00000000"
    label: History commitment state_i
    spending_paths:
      - id: unspendable
        label: |-
          OP_RETURN: state_i
          unspendable
\`\`\`

## tx: deposit_request

\`\`\`bridgeflow
label: Deposit request (covenant TBD)
inputs:
  - label: "Depositor funds: 0.1 BTC"
outputs:
  - amount: "0.10000000"
    label: Pending deposit
    spending_paths:
      - id: aggregate_tbd
        label: |-
          Only aggregate into Funds
          exact recognition / credit
          mechanism unspecified
\`\`\`

## tx: aggregate_deposit

\`\`\`bridgeflow
label: Subblock i+1 / aggregate (TBD)
inputs:
  - tx: subblock_i
    output: 0
    spending_path: aggregate_tbd
    color: deposit_tbd
    arrow_label: CSV(1); peg-in rules TBD
  - tx: deposit_request
    output: 0
    spending_path: aggregate_tbd
    color: deposit_tbd
    label: Credit depositor (mechanism TBD)
outputs:
  - amount: "1.10000000"
    label: Funds / state_i+1
    spending_paths:
      - id: carry
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          keep the full reserve
      - id: aggregate_tbd
        label: |-
          CAT + CSV(1) + STARK
          aggregation / credit covenant TBD
      - id: withdraw
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          authorized Bitcoin payouts
  - amount: "0.00000000"
    label: History commitment state_i+1
    spending_paths:
      - id: unspendable
        label: |-
          OP_RETURN: state_i+1
          unspendable
\`\`\`

## tx: carry_forward

\`\`\`bridgeflow
label: Subblock i+2 / proven carry
inputs:
  - tx: aggregate_deposit
    output: 0
    spending_path: carry
    color: proof
    label: |-
      Annex: subblock data
      state_i+2=H(previous || sha_annex)
    arrow_label: CSV(1) + STARK
outputs:
  - amount: "1.10000000"
    label: Funds / state_i+2
    spending_paths:
      - id: carry
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          keep the full reserve
      - id: aggregate_tbd
        label: |-
          CAT + CSV(1) + STARK
          aggregation / credit covenant TBD
      - id: withdraw
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          authorized Bitcoin payouts
  - amount: "0.00000000"
    label: History commitment state_i+2
    spending_paths:
      - id: unspendable
        label: |-
          OP_RETURN: state_i+2
          unspendable
\`\`\`

## tx: withdraw

\`\`\`bridgeflow
label: Subblock i+2 / proven payout
inputs:
  - tx: aggregate_deposit
    output: 0
    spending_path: withdraw
    color: proof
    label: |-
      Annex: subblock data
      state_i+2=H(previous || sha_annex)
    arrow_label: CSV(1) + STARK
outputs:
  - amount: "0.85000000"
    label: Funds / state_i+2
    spending_paths:
      - id: carry
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          keep the full reserve
      - id: aggregate_tbd
        label: |-
          CAT + CSV(1) + STARK
          aggregation / credit covenant TBD
      - id: withdraw
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          authorized Bitcoin payouts
  - amount: "0.00000000"
    label: History commitment state_i+2
    spending_paths:
      - id: unspendable
        label: |-
          OP_RETURN: state_i+2
          unspendable
  - amount: "0.25000000"
    label: ""
    spending_paths:
      - id: owner
        label: Withdrawing user
\`\`\`

## tx: next_subblock

\`\`\`bridgeflow
label: Next subblock (repeat)
inputs:
  - tx: withdraw
    output: 0
    spending_path: carry
    color: proof
    label: |-
      Annex: subblock data
      state_i+3=H(previous || sha_annex)
    arrow_label: CSV(1) + STARK
outputs:
  - amount: "0.85000000"
    label: Funds / state_i+3
    spending_paths:
      - id: carry
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          keep the full reserve
      - id: aggregate_tbd
        label: |-
          CAT + CSV(1) + STARK
          aggregation / credit covenant TBD
      - id: withdraw
        label: |-
          CAT covenant + CSV(1)
          STARK: valid transition
          authorized Bitcoin payouts
  - amount: "0.00000000"
    label: History commitment state_i+3
    spending_paths:
      - id: unspendable
        label: |-
          OP_RETURN: state_i+3
          unspendable
\`\`\`

<!-- bridgeflow:layout
txs:
  subblock_i:
    x: 100
    y: 100
  deposit_request:
    x: 100
    y: 1100
  aggregate_deposit:
    x: 1200
    y: 350
  carry_forward:
    x: 2350
    y: 100
  withdraw:
    x: 2350
    y: 1150
  next_subblock:
    x: 3500
    y: 1150
-->
`;export{n as default};
