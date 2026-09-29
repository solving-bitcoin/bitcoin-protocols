# Clementine V1

This Clementine graph moves user deposits into an N-of-N vault, with a 200-block refund before MoveToVault. Withdrawals can use a cooperative vault payout or the operator payout route. For reimbursement, an operator posts a kickoff committing to a block hash and must combine the vault output, its kickoff reimbursement connector, and a matching connector from the next collateral round.

Each kickoff reserves connectors for a funded challenge, watchtower header-chain proof, operator acknowledgement, latest-blockhash commitment, and split assertions. Invalid assertions can be disproved, while missed response deadlines, unused kickoffs, and unfinalized claims expose collateral-spending paths. If no challenge arrives, or the disprove window expires without a successful dispute, a timeout consumes the kickoff finalizer so that its penalty can no longer block advancement. The graph shows one representative kickoff; payout funding and the detailed proof predicates are schematic rather than a complete implementation specification.

Source: [Clementine](https://github.com/chainwayxyz/clementine); [Clementine paper](https://eprint.iacr.org/2025/776)

```bridgeflow
color_groups:
  nofn_signature: blue
  operator_signature: red
```

## tx: deposit_external

```bridgeflow
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
```

## tx: move_to_vault

```bridgeflow
label: MoveToVault
inputs:
  - tx: deposit_external
    output: 0
    spending_path: nofn_with_evm_address
    color: nofn_signature
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: nofn_vault_spend
        label: N-of-N
```

## tx: recovery

```bridgeflow
label: Recovery
inputs:
  - tx: deposit_external
    output: 0
    spending_path: user_after_200_blocks
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: user
        label: user
```

## tx: user_dust_utxo

```bridgeflow
label: User dust UTXO
inputs:
  - label: User funds
outputs:
  - amount: "0.00010000"
    spending_paths:
      - id: external_user
        label: user_sig
```

## tx: optimistic_payout

```bridgeflow
label: OptimisticPayout
inputs:
  - tx: user_dust_utxo
    output: 0
    spending_path: external_user
    sighash_flag: sighash_single|anyonecanpay
  - tx: move_to_vault
    output: 0
    spending_path: nofn_vault_spend
    color: nofn_signature
outputs:
  - amount: "0.00010000"
    spending_paths:
      - id: user_payout_addr
        label: user payout
```

## tx: payout

```bridgeflow
label: Payout
inputs:
  - tx: user_dust_utxo
    output: 0
    spending_path: external_user
outputs:
  - amount: "0.00010000"
    spending_paths:
      - id: user_payout_addr
        label: user payout
  - amount: "0.00000000"
    spending_paths:
      - id: op_return_marker
        label: OP_RETURN operator_xonly_pk
```

## tx: operator_collateral

```bridgeflow
label: Operator collateral (external)
inputs:
  - label: Operator funds
outputs:
  - amount: "2.00000000"
    spending_paths:
      - id: operator_keyspend
        label: Operator
```

## tx: round_0

```bridgeflow
label: Round(0)
inputs:
  - tx: operator_collateral
    output: 0
    spending_path: operator_keyspend
outputs:
  - amount: "1.95000000"
    spending_paths:
      - id: collateral_in_round
        label: Operator
  - amount: "0.00000000"
    spending_paths:
      - id: blockhash_commit
        label: Operator commits to blockhash
      - id: kickoff_one_block_timeout
        label: Operator in 1 block
  - amount: "0.00000000"
    spending_paths:
      - id: blockhash_commit
        label: Operator commits to blockhash
      - id: kickoff_one_block_timeout
        label: Operator in 1 block
  - amount: "0.00000000"
    spending_paths:
      - id: blockhash_commit
        label: Operator commits to blockhash
      - id: kickoff_one_block_timeout
        label: Operator in 1 block
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_in_round_0
        label: Operator reimburse connector 1
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_in_round_1
        label: Operator reimburse connector 2
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_in_round_2
        label: Operator reimburse connector 3
```

## tx: ready_to_reimburse_0

```bridgeflow
label: ReadyToReimburse(0)
inputs:
  - tx: round_0
    output: 0
    spending_path: collateral_in_round
outputs:
  - amount: "1.90000000"
    spending_paths:
      - id: collateral
        label: Operator
```

## tx: round_1

```bridgeflow
label: Round(1)
inputs:
  - tx: ready_to_reimburse_0
    output: 0
    spending_path: collateral
outputs:
  - amount: "1.85000000"
    spending_paths:
      - id: collateral_in_round
        label: Operator
  - amount: "0.00000000"
    spending_paths:
      - id: blockhash_commit
        label: Operator commits to blockhash
      - id: kickoff_one_block_timeout
        label: Operator in 1 block
  - amount: "0.00000000"
    spending_paths:
      - id: blockhash_commit
        label: Operator commits to blockhash
      - id: kickoff_one_block_timeout
        label: Operator in 1 block
  - amount: "0.00000000"
    spending_paths:
      - id: blockhash_commit
        label: Operator commits to blockhash
      - id: kickoff_one_block_timeout
        label: Operator in 1 block
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_in_round_0
        label: Operator reimburse connector 1
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_in_round_1
        label: Operator reimburse connector 2
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_in_round_2
        label: Operator reimburse connector 3
```

## tx: kickoff_0_0

```bridgeflow
label: Kickoff(0,0)
inputs:
  - tx: round_0
    output: 1
    spending_path: blockhash_commit
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: operator_immediate
        label: Operator
      - id: operator_challenge_timeout
        label: Operator in 24 blocks
  - amount: "0.00000000"
    spending_paths:
      - id: nofn_finalize
        label: N-of-N kickoff finalizer
  - amount: "0.00000000"
    spending_paths:
      - id: nofn_reimburse
        label: N-of-N
  - amount: "0.00000000"
    spending_paths:
      - id: operator_disprove_timeout
        label: Operator in 120 blocks
      - id: additional_disprove
        label: additional disprove
      - id: operator_disprove_bitvm
        label: Disprove scripts
  - amount: "0.00000000"
    spending_paths:
      - id: nofn_latest_blockhash_timeout
        label: N-of-N in 60 blocks
      - id: operator_latest_blockhash
        label: Operator latest blockhash
  - amount: "0.00000000"
    spending_paths:
      - id: nofn_assert_timeout
        label: N-of-N in 96 blocks
      - id: operator_assert_0
        label: Operator commits assert 0
  - amount: "0.00000000"
    spending_paths:
      - id: nofn_assert_timeout
        label: N-of-N in 96 blocks
      - id: operator_assert_1
        label: Operator commits assert 1
  - amount: "0.00000000"
    spending_paths:
      - id: watchtower_keypath
        label: Watchtower
      - id: nofn_watchtower_timeout
        label: N-of-N in 48 blocks
  - amount: "0.00000000"
    spending_paths:
      - id: nofn_operator_nack_timeout
        label: N-of-N in 72 blocks
      - id: nofn_watchtower_timeout
        label: N-of-N in 48 blocks
      - id: operator_with_preimage
        label: Operator with preimage
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_metadata
        label: OP_RETURN kickoff payload
```

## tx: challenge_0_0

```bridgeflow
label: Challenge(0,0)
inputs:
  - tx: kickoff_0_0
    output: 0
    spending_path: operator_immediate
    sighash_flag: sighash_single|anyonecanpay
  - label: Challenger 2 BTC funding
outputs:
  - amount: "2.00000000"
    spending_paths:
      - id: operator_reimbursement
        label: operator reimburse address
```

## tx: challenge_timeout_0_0

```bridgeflow
label: ChallengeTimeout(0,0)
inputs:
  - tx: kickoff_0_0
    output: 0
    spending_path: operator_challenge_timeout
  - tx: kickoff_0_0
    output: 1
    spending_path: nofn_finalize
outputs: []
```

## tx: kickoff_not_finalized_0_0

```bridgeflow
label: KickoffNotFinalized(0,0)
inputs:
  - tx: kickoff_0_0
    output: 1
    spending_path: nofn_finalize
  - tx: ready_to_reimburse_0
    output: 0
    spending_path: collateral
outputs: []
```

## tx: watchtower_challenge_0_0_0

```bridgeflow
label: WatchtowerChallenge(0,0,0)
inputs:
  - tx: kickoff_0_0
    output: 7
    spending_path: watchtower_keypath
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: hcp_metadata
        label: OP_RETURN 144 bytes hcp
```

## tx: watchtower_challenge_timeout_0_0_0

```bridgeflow
label: WatchtowerChallengeTimeout(0,0,0)
inputs:
  - tx: kickoff_0_0
    output: 7
    spending_path: nofn_watchtower_timeout
  - tx: kickoff_0_0
    output: 8
    spending_path: nofn_watchtower_timeout
outputs: []
```

## tx: operator_challenge_nack_0_0_0

```bridgeflow
label: OperatorChallengeNack(0,0,0)
inputs:
  - tx: kickoff_0_0
    output: 8
    spending_path: nofn_operator_nack_timeout
  - tx: kickoff_0_0
    output: 1
    spending_path: nofn_finalize
  - tx: round_0
    output: 0
    spending_path: collateral_in_round
outputs: []
```

## tx: operator_challenge_ack_0_0_0

```bridgeflow
label: OperatorChallengeAck(0,0,0)
inputs:
  - tx: kickoff_0_0
    output: 8
    spending_path: operator_with_preimage
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: padding
        label: OP_RETURN PADDING
```

## tx: latest_blockhash_0_0

```bridgeflow
label: LatestBlockhash(0,0)
inputs:
  - tx: kickoff_0_0
    output: 4
    spending_path: operator_latest_blockhash
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: padding
        label: OP_RETURN
```

## tx: latest_blockhash_timeout_0_0

```bridgeflow
label: LatestBlockhashTimeout(0,0)
inputs:
  - tx: kickoff_0_0
    output: 4
    spending_path: nofn_latest_blockhash_timeout
  - tx: kickoff_0_0
    output: 1
    spending_path: nofn_finalize
  - tx: round_0
    output: 0
    spending_path: collateral_in_round
outputs: []
```

## tx: mini_assert_0_0_0

```bridgeflow
label: MiniAssert(0,0,0)
inputs:
  - tx: kickoff_0_0
    output: 5
    spending_path: operator_assert_0
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: padding
        label: OP_RETURN
```

## tx: mini_assert_0_1_0

```bridgeflow
label: MiniAssert(0,1,0)
inputs:
  - tx: kickoff_0_0
    output: 6
    spending_path: operator_assert_1
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: padding
        label: OP_RETURN
```

## tx: assert_timeout_0_0_0

```bridgeflow
label: AssertTimeout(0,0,0)
inputs:
  - tx: kickoff_0_0
    output: 5
    spending_path: nofn_assert_timeout
  - tx: kickoff_0_0
    output: 1
    spending_path: nofn_finalize
  - tx: round_0
    output: 0
    spending_path: collateral_in_round
outputs: []
```

## tx: disprove_0_0

```bridgeflow
label: Disprove(0,0)
inputs:
  - tx: kickoff_0_0
    output: 3
    spending_path: operator_disprove_bitvm
  - tx: round_0
    output: 0
    spending_path: collateral_in_round
outputs: []
```

## tx: disprove_timeout_0_0

```bridgeflow
label: DisproveTimeout(0,0)
inputs:
  - tx: kickoff_0_0
    output: 3
    spending_path: operator_disprove_timeout
  - tx: kickoff_0_0
    output: 1
    spending_path: nofn_finalize
outputs: []
```

## tx: unspent_kickoff_0_0

```bridgeflow
label: UnspentKickoff(0,0)
inputs:
  - tx: ready_to_reimburse_0
    output: 0
    spending_path: collateral
  - tx: round_0
    output: 1
    spending_path: kickoff_one_block_timeout
outputs: []
```

## tx: reimburse_0_0

```bridgeflow
label: Reimburse(0,0)
inputs:
  - tx: move_to_vault
    output: 0
    spending_path: nofn_vault_spend
    color: nofn_signature
  - tx: kickoff_0_0
    output: 2
    spending_path: nofn_reimburse
  - tx: round_1
    output: 4
    spending_path: reimburse_in_round_0
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: operator_reimbursement
        label: operator reimburse address
```

<!-- bridgeflow:layout
txs:
  assert_timeout_0_0_0:
    x: 1680
    y: 4160
  challenge_0_0:
    x: 1680
    y: 420
  challenge_timeout_0_0:
    x: 1680
    y: 760
  deposit_external:
    x: 120
    y: 80
  disprove_0_0:
    x: 1680
    y: 4500
  disprove_timeout_0_0:
    x: 1680
    y: 4840
  kickoff_0_0:
    x: 953
    y: 1324
  kickoff_not_finalized_0_0:
    x: 1680
    y: 1100
  latest_blockhash_0_0:
    x: 1958
    y: 2711
  latest_blockhash_timeout_0_0:
    x: 1680
    y: 3140
  mini_assert_0_0_0:
    x: 1680
    y: 3480
  mini_assert_0_1_0:
    x: 1680
    y: 3820
  move_to_vault:
    x: 640
    y: 80
  operator_challenge_ack_0_0_0:
    x: 2188
    y: 2460
  operator_challenge_nack_0_0_0:
    x: 2333
    y: 2120
  operator_collateral:
    x: -344
    y: 3148
  optimistic_payout:
    x: 1281
    y: -20
  payout:
    x: 640
    y: 420
  ready_to_reimburse_0:
    x: 1160
    y: 420
  recovery:
    x: 640
    y: -260
  reimburse_0_0:
    x: 3387
    y: 704
  round_0:
    x: 77
    y: 3150
  round_1:
    x: 3477
    y: 2908
  unspent_kickoff_0_0:
    x: 1680
    y: 5180
  user_dust_utxo:
    x: 120
    y: 420
  watchtower_challenge_0_0_0:
    x: 2326
    y: 1429
  watchtower_challenge_timeout_0_0_0:
    x: 2397
    y: 1780
-->
