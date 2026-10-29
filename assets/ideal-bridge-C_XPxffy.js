const n=`# idealgroup/bridge BitVM3 bridge

The user creates a deposit request carrying an Ethereum address. N-of-N signers move it into the bridge reserve, or the user cancels after roughly one hour by revealing the deposit secret. An operator-funded fanout tree supplies slots for Lamport commitments; Kickoff consumes three chunks to commit the proof bits and creates a disputed reimbursement connector plus a fee-bumping anchor.

Under the intended garbled-circuit setup, an invalid proof reveals the false-output label, letting Disprove burn the connector. Otherwise, after roughly three days, Withdraw combines that connector with the reserve output to reimburse the operator. The reserve input uses SIGHASH_NONE, so its signature does not constrain withdrawal outputs. Ethereum minting/burning, the proof's exact statement, and setup verification are outside this Bitcoin transaction graph.

Source: [idealgroup/bridge](https://github.com/idealgroup/bridge/tree/9928a3515946aa8ec87709951ec715432946c951)

\`\`\`bridgeflow
color_groups:
  nofn_signature: blue
  user_timeout: orange
  disprove_path: red
\`\`\`

## tx: request_tx

\`\`\`bridgeflow
label: requestTx
inputs:
  - label: |-
      1.00000330 BTC
      user
outputs:
  - amount: "1.00000330"
    spending_paths:
      - id: nofn_request_spend
        label: N-of-N
      - id: user_cancel_after_1h
        label: |-
          user in ~1h
          +
          depositSecret
  - amount: "0.00000000"
    spending_paths:
      - id: eth_address_op_return
        label: |-
          OP_RETURN
          eth_address
\`\`\`

## tx: deposit_tx

\`\`\`bridgeflow
label: depositTx
inputs:
  - tx: request_tx
    output: 0
    spending_path: nofn_request_spend
    color: nofn_signature
outputs:
  - amount: "1.00000000"
    spending_paths:
      - id: deposit_nofn
        label: N-of-N
\`\`\`

## tx: cancel_tx

\`\`\`bridgeflow
label: cancelTx
inputs:
  - tx: request_tx
    output: 0
    spending_path: user_cancel_after_1h
    arrow_label: ~1h CSV
    color: user_timeout
outputs:
  - amount: "1.00000000"
    spending_paths:
      - id: user_refund
        label: user
\`\`\`

## tx: fanout_tree

\`\`\`bridgeflow
label: fanoutTx tree
inputs:
  - label: |-
      0.09900000 BTC
      operator init
outputs:
  - amount: "0.00000330"
    spending_paths:
      - id: leaf_chunk_0
        label: |-
          operator
          +
          Lamport chunk 0
  - amount: "0.00000330"
    spending_paths:
      - id: leaf_chunk_1
        label: |-
          operator
          +
          Lamport chunk 1
  - amount: "0.00000330"
    spending_paths:
      - id: leaf_chunk_2
        label: |-
          operator
          +
          Lamport chunk 2
  - amount: "0.09899010"
    spending_paths:
      - id: other_leaf_chunks
        label: other slot leaves
\`\`\`

## tx: kickoff_tx

\`\`\`bridgeflow
label: kickoffTx
inputs:
  - tx: fanout_tree
    output: 0
    spending_path: leaf_chunk_0
    arrow_label: proof bits 0..997
  - tx: fanout_tree
    output: 1
    spending_path: leaf_chunk_1
    arrow_label: proof bits 998..1995
  - tx: fanout_tree
    output: 2
    spending_path: leaf_chunk_2
    arrow_label: proof bits 1996..2047
outputs:
  - amount: "0.00000330"
    spending_paths:
      - id: operator_connector
        label: operator in ~3 days
      - id: disprove_secret
        label: |-
          GC_zero_label
          (disproveSecret)
  - amount: "0.00000330"
    spending_paths:
      - id: operator_anchor
        label: operator CPFP anchor
\`\`\`

## tx: disprove_tx

\`\`\`bridgeflow
label: disproveTx
inputs:
  - tx: kickoff_tx
    output: 0
    spending_path: disprove_secret
    color: disprove_path
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: burn_op_return
        label: |-
          OP_RETURN
          burn connector
\`\`\`

## tx: withdraw_tx

\`\`\`bridgeflow
label: withdrawTx
inputs:
  - tx: deposit_tx
    output: 0
    spending_path: deposit_nofn
    sighash_flag: sighash_none
    color: nofn_signature
  - tx: kickoff_tx
    output: 0
    spending_path: operator_connector
    arrow_label: ~3 days CSV
outputs:
  - amount: "1.00000000"
    spending_paths:
      - id: operator_reimbursement
        label: |-
          operator
          or chosen outputs
\`\`\`

<!-- bridgeflow:layout
txs:
  cancel_tx:
    x: 400
    y: 430
  deposit_tx:
    x: 664
    y: 312
  disprove_tx:
    x: 1217
    y: 866
  fanout_tree:
    x: 27
    y: 753
  kickoff_tx:
    x: 640
    y: 760
  request_tx:
    x: 96
    y: 226
  withdraw_tx:
    x: 1160
    y: 420
-->
`;export{n as default};
