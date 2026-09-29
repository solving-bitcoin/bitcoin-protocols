const n=`# Clementine v2

This graph locks deposits in an N-of-N vault, with a 200-block refund before MoveToVault. Operators front withdrawals and reclaim funds through Reimburse, which requires the vault output, a kickoff naming that vault and operator, and the matching next-round connector. Regular and extended rounds supply these connectors. Unused connectors can be swept; leaving one unspent exposes the round collateral to a presigned penalty.

Each operator–watchtower pair prepares an Argo dispute. ChallengeStart reserves a finalizer; PostChallenge commits the watchtower's proof and claim data. Assert completes watchtower adaptor signatures, revealing the operator's garbled proof inputs. An invalid proof gives the watchtower a preimage for Disprove, which spends Assert but leaves the finalizer available for Slash. Otherwise DisproveTimeout consumes Assert and the finalizer. ChallengeTimeout closes an unposted challenge, while AssertTimeout leaves it unresolved. Slash combines a surviving finalizer with reimbursement-ready collateral, preventing advancement to the next round. Values and delays use the recorded regtest configuration; anchors and padding are omitted.

\`\`\`bridgeflow
color_groups:
  nofn_signature: blue
  operator_setup_signature: red
  pair_setup_signature: red
  wt_op_adaptor_signature: green
  timeout_path: orange
  watchtower_live_signature: purple
\`\`\`

## tx: deposit

\`\`\`bridgeflow
label: Deposit TX
inputs:
  - label: |-
      10 BTC
      user
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: nofn_with_evm_address
        label: |-
          N-of-N
          +
          data("citrea", evm_address)
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
      - id: deposit_in_move
        label: N-of-N
      - id: security_council_emergency
        label: security_council
\`\`\`

## tx: recovery

\`\`\`bridgeflow
label: Recovery
inputs:
  - tx: deposit
    output: 0
    spending_path: user_after_200_blocks
    arrow_label: in 200 blocks
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: user_refund
        label: user
\`\`\`

## tx: payout_tx

\`\`\`bridgeflow
label: Payout
inputs:
  - label: |-
      0.00000330 BTC
      WithdrawalUtxo
      user
    sighash_flag: sighash_single|anyonecanpay
  - label: |-
      10 BTC
      operator payout-wallet funds
outputs:
  - amount: "9.99900000"
    spending_paths:
      - id: user
        label: user
  - amount: "0.00000000"
    spending_paths:
      - id: operator_pk
        label: |-
          unspendable OP_RETURN
          operator_pk
  - amount: "0.00100090"
    label: Operator Fee Collector
    spending_paths:
      - id: fee_collector
        label: configured fee collector
\`\`\`

## tx: round_tx_1

\`\`\`bridgeflow
label: Round 0
inputs:
  - label: |-
      0.00500000 BTC
      Operator Collateral
outputs:
  - amount: "0.00497690"
    label: Round Connector
    spending_paths:
      - id: round_connector
        label: operator
  - amount: "0.00000330"
    label: Kickoff Connector (0, 0)
    spending_paths:
      - id: kickoff_0
        label: operator
  - amount: "0.00000330"
    label: Kickoff Connector (1, 0)
    spending_paths:
      - id: kickoff_1
        label: operator
  - amount: "0.00000330"
    label: Kickoff Connector (2, 0)
    spending_paths:
      - id: kickoff_2
        label: operator
  - amount: "0.00000330"
    label: Reimburse Connector (0, 0)
    spending_paths:
      - id: reimburse_0
        label: operator
  - amount: "0.00000330"
    label: Reimburse Connector (1, 0)
    spending_paths:
      - id: reimburse_1
        label: operator
  - amount: "0.00000330"
    label: Reimburse Connector (2, 0)
    spending_paths:
      - id: reimburse_2
        label: operator
  - amount: "0.00000330"
    label: Extended Round Generator
    spending_paths:
      - id: extended_round_generator
        label: operator
\`\`\`

## tx: end_round_tx

\`\`\`bridgeflow
label: EndRound
inputs:
  - tx: round_tx_1
    output: 0
    spending_path: round_connector
outputs:
  - amount: "0.00497690"
    label: Round Connector
    spending_paths:
      - id: round_connector
        label: operator
\`\`\`

## tx: ready_to_reimburse_tx

\`\`\`bridgeflow
label: ReadyToReimburse
inputs:
  - tx: end_round_tx
    output: 0
    spending_path: round_connector
    arrow_label: "nSequence: 72 blocks"
outputs:
  - amount: "0.00497690"
    label: Round Connector
    spending_paths:
      - id: round_connector
        label: operator
\`\`\`

## tx: round_tx_2

\`\`\`bridgeflow
label: Round 1
inputs:
  - tx: ready_to_reimburse_tx
    output: 0
    spending_path: round_connector
    arrow_label: "nSequence: 18 blocks"
outputs:
  - amount: "0.00495380"
    label: Round Connector
    spending_paths:
      - id: round_connector
        label: operator
  - amount: "0.00000330"
    label: Kickoff Connector (0, 1)
    spending_paths:
      - id: kickoff_0
        label: operator
  - amount: "0.00000330"
    label: Kickoff Connector (1, 1)
    spending_paths:
      - id: kickoff_1
        label: operator
  - amount: "0.00000330"
    label: Kickoff Connector (2, 1)
    spending_paths:
      - id: kickoff_2
        label: operator
  - amount: "0.00000330"
    label: Reimburse Connector (0, 1)
    spending_paths:
      - id: reimburse_0
        label: operator
  - amount: "0.00000330"
    label: Reimburse Connector (1, 1)
    spending_paths:
      - id: reimburse_1
        label: operator
  - amount: "0.00000330"
    label: Reimburse Connector (2, 1)
    spending_paths:
      - id: reimburse_2
        label: operator
  - amount: "0.00000330"
    label: Extended Round Generator
    spending_paths:
      - id: extended_round_generator
        label: operator
\`\`\`

## tx: kickoff_tx

\`\`\`bridgeflow
label: Kickoff
inputs:
  - tx: round_tx_1
    output: 1
    spending_path: kickoff_0
outputs:
  - amount: "0.00000330"
    label: Reimburse Link Connector
    spending_paths:
      - id: reimburse
        label: operator
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_commitment
        label: |-
          unspendable OP_RETURN
          move_txid, operator_pk
\`\`\`

## tx: burn_unused_kickoff_tx

\`\`\`bridgeflow
label: BurnUnusedKickoffConnectors (opened)
inputs:
  - tx: round_tx_1
    output: 3
    spending_path: kickoff_2
  - tx: round_tx_1
    output: 6
    spending_path: reimburse_2
  - tx: extended_round_tx_0
    output: 2
    spending_path: kickoff_2
  - tx: extended_round_tx_0
    output: 12
    spending_path: reimburse_2
outputs:
  - amount: "0.00000660"
    label: Change
    spending_paths:
      - id: burn_change
        label: operator
\`\`\`

## tx: unspent_kickoff_tx

\`\`\`bridgeflow
label: UnspentKickoff
inputs:
  - tx: end_round_tx
    output: 0
    spending_path: round_connector
    color: operator_setup_signature
  - tx: round_tx_1
    output: 3
    spending_path: kickoff_2
    color: operator_setup_signature
outputs: []
\`\`\`

## tx: reimburse_tx

\`\`\`bridgeflow
label: Reimburse
inputs:
  - tx: move_to_vault
    output: 0
    spending_path: deposit_in_move
    sighash_flag: sighash_none
    color: nofn_signature
  - tx: kickoff_tx
    output: 0
    spending_path: reimburse
  - tx: round_tx_2
    output: 4
    spending_path: reimburse_0
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: operator_reimbursement
        label: operator
\`\`\`

## tx: challenge_source_utxo

\`\`\`bridgeflow
label: Challenge Source UTXO
inputs:
  - label: |-
      0.00000990 BTC
      aggregator funding
outputs:
  - amount: "0.00000990"
    label: SourceUTXO
    spending_paths:
      - id: operator_watchtower_multisig
        label: |-
          watchtower AND operator
          data(
          bridge_version,
          collateral_outpoint,
          security_council)
\`\`\`

## tx: circuit_generated_tx

\`\`\`bridgeflow
label: CircuitGenerated
inputs:
  - tx: challenge_source_utxo
    output: 0
    spending_path: operator_watchtower_multisig
    color: pair_setup_signature
outputs:
  - amount: "0.00000990"
    label: Challenge Start Connector
    spending_paths:
      - id: main
        label: watchtower
      - id: security_council_path
        label: security_council
\`\`\`

## tx: challenge_start_tx

\`\`\`bridgeflow
label: ChallengeStart
inputs:
  - tx: circuit_generated_tx
    output: 0
    spending_path: main
outputs:
  - amount: "0.00000330"
    label: Challenge Connector
    spending_paths:
      - id: challenge_connector
        label: |-
          watchtower signature
          + Winternitz commitment
          (180 bytes)
  - amount: "0.00000330"
    label: Challenge Timeout Connector
    spending_paths:
      - id: operator_connector
        label: operator
  - amount: "0.00000330"
    label: Challenge Finalizer Connector
    spending_paths:
      - id: challenge_finalizer_watchtower
        label: watchtower
      - id: challenge_finalizer_security_council
        label: security_council
\`\`\`

## tx: post_challenge_tx

\`\`\`bridgeflow
label: PostChallenge
inputs:
  - tx: challenge_start_tx
    output: 0
    spending_path: challenge_connector
    arrow_label: "nSequence: 18 blocks"
  - tx: challenge_start_tx
    output: 1
    spending_path: operator_connector
    color: operator_setup_signature
outputs:
  - amount: "0.00000330"
    label: Assert Connector
    spending_paths:
      - id: assert_connector
        label: |-
          508 watchtower adaptor signatures
          (4 proof bits per row)
          + operator signature
      - id: assert_timeout
        label: anyone in 18 blocks
\`\`\`

## tx: assert_timeout_tx

\`\`\`bridgeflow
label: AssertTimeout
inputs:
  - tx: post_challenge_tx
    output: 0
    spending_path: assert_timeout
    arrow_label: in 18 blocks
outputs: []
\`\`\`

## tx: assert_tx

\`\`\`bridgeflow
label: Assert
inputs:
  - tx: post_challenge_tx
    output: 0
    spending_path: assert_connector
    color: wt_op_adaptor_signature
    arrow_label: operator completes presigned rows
outputs:
  - amount: "0.00000330"
    label: Disprove Connector
    spending_paths:
      - id: disprove_preimage
        label: |-
          watchtower + Argo key preimage
          (one leaf per hidden instance)
      - id: disprove_timeout
        label: operator in 18 blocks
\`\`\`

## tx: challenge_timeout_tx

\`\`\`bridgeflow
label: ChallengeTimeout
inputs:
  - tx: challenge_start_tx
    output: 1
    spending_path: operator_connector
    arrow_label: "nSequence: 126 blocks"
  - tx: challenge_start_tx
    output: 2
    spending_path: challenge_finalizer_watchtower
    color: timeout_path
outputs: []
\`\`\`

## tx: slash_tx

\`\`\`bridgeflow
label: Slash
inputs:
  - tx: ready_to_reimburse_tx
    output: 0
    spending_path: round_connector
    color: operator_setup_signature
  - tx: challenge_start_tx
    output: 2
    spending_path: challenge_finalizer_watchtower
    arrow_label: "nSequence: 54 blocks"
    color: watchtower_live_signature
outputs: []
\`\`\`

## tx: disprove_tx

\`\`\`bridgeflow
label: Disprove
inputs:
  - tx: assert_tx
    output: 0
    spending_path: disprove_preimage
    color: watchtower_live_signature
outputs: []
\`\`\`

## tx: disprove_timeout_tx

\`\`\`bridgeflow
label: DisproveTimeout
inputs:
  - tx: assert_tx
    output: 0
    spending_path: disprove_timeout
    arrow_label: in 18 blocks
  - tx: challenge_start_tx
    output: 2
    spending_path: challenge_finalizer_watchtower
    color: timeout_path
outputs: []
\`\`\`

## tx: extended_round_tx_0

\`\`\`bridgeflow
label: ExtendedRound 0 (10 slots)
inputs:
  - tx: round_tx_1
    output: 7
    spending_path: extended_round_generator
outputs:
  - amount: "0.00000000"
    label: Extended Kickoff (0, 0)
    spending_paths:
      - id: kickoff_0
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (1, 0)
    spending_paths:
      - id: kickoff_1
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (2, 0)
    spending_paths:
      - id: kickoff_2
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (3, 0)
    spending_paths:
      - id: kickoff_3
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (4, 0)
    spending_paths:
      - id: kickoff_4
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (5, 0)
    spending_paths:
      - id: kickoff_5
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (6, 0)
    spending_paths:
      - id: kickoff_6
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (7, 0)
    spending_paths:
      - id: kickoff_7
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (8, 0)
    spending_paths:
      - id: kickoff_8
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (9, 0)
    spending_paths:
      - id: kickoff_9
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (0, 0)
    spending_paths:
      - id: reimburse_0
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (1, 0)
    spending_paths:
      - id: reimburse_1
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (2, 0)
    spending_paths:
      - id: reimburse_2
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (3, 0)
    spending_paths:
      - id: reimburse_3
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (4, 0)
    spending_paths:
      - id: reimburse_4
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (5, 0)
    spending_paths:
      - id: reimburse_5
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (6, 0)
    spending_paths:
      - id: reimburse_6
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (7, 0)
    spending_paths:
      - id: reimburse_7
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (8, 0)
    spending_paths:
      - id: reimburse_8
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (9, 0)
    spending_paths:
      - id: reimburse_9
        label: operator
\`\`\`

## tx: extended_round_tx_1

\`\`\`bridgeflow
label: ExtendedRound 1 (10 slots)
inputs:
  - tx: round_tx_2
    output: 7
    spending_path: extended_round_generator
outputs:
  - amount: "0.00000000"
    label: Extended Kickoff (0, 1)
    spending_paths:
      - id: kickoff_0
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (1, 1)
    spending_paths:
      - id: kickoff_1
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (2, 1)
    spending_paths:
      - id: kickoff_2
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (3, 1)
    spending_paths:
      - id: kickoff_3
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (4, 1)
    spending_paths:
      - id: kickoff_4
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (5, 1)
    spending_paths:
      - id: kickoff_5
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (6, 1)
    spending_paths:
      - id: kickoff_6
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (7, 1)
    spending_paths:
      - id: kickoff_7
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (8, 1)
    spending_paths:
      - id: kickoff_8
        label: operator
  - amount: "0.00000000"
    label: Extended Kickoff (9, 1)
    spending_paths:
      - id: kickoff_9
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (0, 1)
    spending_paths:
      - id: reimburse_0
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (1, 1)
    spending_paths:
      - id: reimburse_1
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (2, 1)
    spending_paths:
      - id: reimburse_2
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (3, 1)
    spending_paths:
      - id: reimburse_3
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (4, 1)
    spending_paths:
      - id: reimburse_4
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (5, 1)
    spending_paths:
      - id: reimburse_5
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (6, 1)
    spending_paths:
      - id: reimburse_6
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (7, 1)
    spending_paths:
      - id: reimburse_7
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (8, 1)
    spending_paths:
      - id: reimburse_8
        label: operator
  - amount: "0.00000000"
    label: Extended Reimburse (9, 1)
    spending_paths:
      - id: reimburse_9
        label: operator
\`\`\`

## tx: extended_kickoff_tx

\`\`\`bridgeflow
label: Kickoff (extended slot 0, round 0)
inputs:
  - tx: extended_round_tx_0
    output: 0
    spending_path: kickoff_0
outputs:
  - amount: "0.00000000"
    label: Reimburse Link Connector
    spending_paths:
      - id: reimburse
        label: operator
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_commitment
        label: |-
          unspendable OP_RETURN
          move_txid, operator_pk
\`\`\`

## tx: extended_reimburse_tx

\`\`\`bridgeflow
label: Reimburse (extended slot 0, round 0)
inputs:
  - tx: move_to_vault
    output: 0
    spending_path: deposit_in_move
    sighash_flag: sighash_none
    color: nofn_signature
  - tx: extended_kickoff_tx
    output: 0
    spending_path: reimburse
  - tx: extended_round_tx_1
    output: 10
    spending_path: reimburse_0
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: operator_reimbursement
        label: operator
\`\`\`

## tx: burn_unused_generator_tx

\`\`\`bridgeflow
label: BurnUnusedKickoffConnectors (unopened)
inputs:
  - tx: round_tx_1
    output: 7
    spending_path: extended_round_generator
outputs:
  - amount: "0.00000330"
    label: Change
    spending_paths:
      - id: operator
        label: operator
\`\`\`

## tx: unspent_reimburse_tx

\`\`\`bridgeflow
label: UnspentKickoff (reimburse)
inputs:
  - tx: end_round_tx
    output: 0
    spending_path: round_connector
    color: operator_setup_signature
  - tx: round_tx_1
    output: 6
    spending_path: reimburse_2
    color: operator_setup_signature
outputs: []
\`\`\`

## tx: unspent_generator_tx

\`\`\`bridgeflow
label: UnspentKickoff (generator)
inputs:
  - tx: end_round_tx
    output: 0
    spending_path: round_connector
    color: operator_setup_signature
  - tx: round_tx_1
    output: 7
    spending_path: extended_round_generator
    color: operator_setup_signature
outputs: []
\`\`\`

## tx: unspent_extended_kickoff_tx

\`\`\`bridgeflow
label: UnspentKickoff (extended kickoff)
inputs:
  - tx: end_round_tx
    output: 0
    spending_path: round_connector
    color: operator_setup_signature
  - tx: extended_round_tx_0
    output: 2
    spending_path: kickoff_2
    color: operator_setup_signature
outputs: []
\`\`\`

## tx: unspent_extended_reimburse_tx

\`\`\`bridgeflow
label: UnspentKickoff (extended reimburse)
inputs:
  - tx: end_round_tx
    output: 0
    spending_path: round_connector
    color: operator_setup_signature
  - tx: extended_round_tx_0
    output: 12
    spending_path: reimburse_2
    color: operator_setup_signature
outputs: []
\`\`\`

<!-- bridgeflow:layout
txs:
  assert_timeout_tx:
    x: 3184
    y: 4796
  assert_tx:
    x: 3350
    y: 4532
  burn_unused_generator_tx:
    x: 650
    y: 1850
  burn_unused_kickoff_tx:
    x: 1292
    y: 2401
  challenge_source_utxo:
    x: 0
    y: 4400
  challenge_start_tx:
    x: 1500
    y: 4450
  challenge_timeout_tx:
    x: 2400
    y: 5050
  circuit_generated_tx:
    x: 750
    y: 4500
  deposit:
    x: 0
    y: 120
  disprove_timeout_tx:
    x: 4300
    y: 5050
  disprove_tx:
    x: 4300
    y: 4620
  end_round_tx:
    x: 900
    y: 1000
  extended_kickoff_tx:
    x: 2201
    y: 1580
  extended_reimburse_tx:
    x: 4566
    y: 2222
  extended_round_tx_0:
    x: 346
    y: 2176
  extended_round_tx_1:
    x: 3411
    y: 2106
  kickoff_tx:
    x: 1292
    y: 619
  move_to_vault:
    x: 850
    y: 80
  payout_tx:
    x: 583
    y: 590
  post_challenge_tx:
    x: 2400
    y: 4500
  ready_to_reimburse_tx:
    x: 1700
    y: 1000
  recovery:
    x: 644
    y: 297
  reimburse_tx:
    x: 4084
    y: 672
  round_tx_1:
    x: 0
    y: 1000
  round_tx_2:
    x: 2612
    y: 1034
  slash_tx:
    x: 2555
    y: 3913
  unspent_extended_kickoff_tx:
    x: 2000
    y: 3150
  unspent_extended_reimburse_tx:
    x: 2000
    y: 3540
  unspent_generator_tx:
    x: 1400
    y: 1450
  unspent_kickoff_tx:
    x: 1400
    y: 1230
  unspent_reimburse_tx:
    x: 1400
    y: 1340
-->
`;export{n as default};
