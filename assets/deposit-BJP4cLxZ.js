const n=`# Deposit primitive

A user funds a deposit output committing to an EVM address. All N signers can authorize MoveToVault, which puts the funds under N-of-N control. Until that spend confirms, the user can instead take the refund path after 200 blocks; the two transactions conflict because they consume the same output. This primitive covers deposit acceptance and cancellation only: destination-chain crediting and eventual vault withdrawal belong to the enclosing bridge protocol.

\`\`\`bridgeflow
color_groups:
  nofn_signature: blue
\`\`\`

## tx: deposit

\`\`\`bridgeflow
label: Deposit
inputs:
  - label: user
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: nofn_with_evm_address
        label: |-
          N-of-N
          +
          data(evm_address)
      - id: user_after_200_blocks
        label: user in 200 blocks
\`\`\`

## tx: move_to_vault

\`\`\`bridgeflow
label: MoveToVault
inputs:
  - tx: deposit
    output: 0
    spending_path: nofn_with_evm_address
    color: nofn_signature
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: nofn_vault_spend
        label: N-of-N
\`\`\`

## tx: recovery

\`\`\`bridgeflow
label: Recovery
inputs:
  - tx: deposit
    output: 0
    spending_path: user_after_200_blocks
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: user
        label: user
\`\`\`

<!-- bridgeflow:layout
txs:
  deposit:
    x: 120
    y: 106
  move_to_vault:
    x: 646
    y: 117
  recovery:
    x: 640
    y: 420
-->
`;export{n as default};
