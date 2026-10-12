const n=`# Challenge finalizer connector primitive

ChallengeStart creates a challenge output and a separate finalizer. The watchtower posts a longest-chain proof, after which the operator must Assert its garbled-circuit inputs. A disprove preimage consumes Assert's output; if the operator never asserts, AssertTimeout consumes the preceding output. Both leave the finalizer available for the watchtower's unresolved-challenge path. If the watchtower never posts its proof, ChallengeTimeout closes both initial outputs; if no disprove arrives, DisproveTimeout consumes Assert and the finalizer together. An enclosing bridge can pair the unresolved finalizer with collateral to block reimbursement; that collateral linkage is not included here.

\`\`\`bridgeflow
color_groups:
  watchtower_operator: green
  operator_signature: red
\`\`\`

## tx: challenge_start

\`\`\`bridgeflow
label: Challenge start
inputs:
  - label: |-
      watchtower 1
      challenge utxo
outputs:
  - amount: "0.00000330"
    spending_paths:
      - id: challenge_timeout_path
        label: operator in 7 days
      - id: commit_lcp_path
        label: |-
          operator
          +
          watchtower commits to LCP
  - amount: "0.00000330"
    spending_paths:
      - id: finalizer_watchtower_timeout_path
        label: |-
          challenge finalizer connector
          watchtower in 1.5 days
\`\`\`

## tx: longest_chain_proof_posted

\`\`\`bridgeflow
label: Longest Chain proof posted Tx
inputs:
  - tx: challenge_start
    output: 0
    spending_path: commit_lcp_path
    color: operator_signature
outputs:
  - amount: "0.00000330"
    spending_paths:
      - id: operator_assert_timeout
        label: anyone in 1.5 days
      - id: operator_commits_gc_inputs
        label: operator commits to GC inputs
\`\`\`

## tx: challenge_timeout

\`\`\`bridgeflow
label: Challenge timeout
inputs:
  - tx: challenge_start
    output: 0
    spending_path: challenge_timeout_path
  - tx: challenge_start
    output: 1
    spending_path: finalizer_watchtower_timeout_path
    color: watchtower_operator
outputs: []
\`\`\`

## tx: challenge_not_finished

\`\`\`bridgeflow
label: Challenge not finished
inputs:
  - tx: challenge_start
    output: 1
    spending_path: finalizer_watchtower_timeout_path
outputs: []
\`\`\`

## tx: assert_timeout

\`\`\`bridgeflow
label: Assert Timeout
inputs:
  - tx: longest_chain_proof_posted
    output: 0
    spending_path: operator_assert_timeout
outputs: []
\`\`\`

## tx: assert_tx

\`\`\`bridgeflow
label: Assert TX
inputs:
  - tx: longest_chain_proof_posted
    output: 0
    spending_path: operator_commits_gc_inputs
outputs:
  - amount: "0.00000330"
    spending_paths:
      - id: disprove_preimage
        label: disprove preimage
      - id: disprove_timeout_path
        label: operator in 1 day
\`\`\`

## tx: disprove_tx

\`\`\`bridgeflow
label: Disprove tx
inputs:
  - tx: assert_tx
    output: 0
    spending_path: disprove_preimage
outputs: []
\`\`\`

## tx: disprove_timeout

\`\`\`bridgeflow
label: Disprove timeout
inputs:
  - tx: challenge_start
    output: 1
    spending_path: finalizer_watchtower_timeout_path
    color: watchtower_operator
  - tx: assert_tx
    output: 0
    spending_path: disprove_timeout_path
outputs: []
\`\`\`

<!-- bridgeflow:layout
txs:
  assert_timeout:
    x: 1788
    y: 363
  assert_tx:
    x: 1819
    y: 494
  challenge_not_finished:
    x: 1031
    y: 49
  challenge_start:
    x: 120
    y: 420
  challenge_timeout:
    x: 844
    y: 797
  disprove_timeout:
    x: 2329
    y: 848
  disprove_tx:
    x: 2431
    y: 583
  longest_chain_proof_posted:
    x: 1004
    y: 360
-->
`;export{n as default};
