const n=`# Round tx primitive

An operator splits collateral into a continuing collateral output, kickoff slots, and reimbursement connectors. ReadyToReimburse advances the collateral, and a delayed next round creates the connectors needed to reimburse the previous round. A setup-signed transaction can instead consume an unused kickoff together with ready collateral, returning funds to the operator and conflicting with round advancement. ExtendedRound sketches extra zero-value slots and is marked nonstandard. Vault funding and dispute resolution are supplied by an enclosing protocol; this primitive illustrates their round-to-round coordination.

\`\`\`bridgeflow
color_groups:
  operator_setup_signature: red
  delayed_round_advance: orange
  extension_path: purple
\`\`\`

## tx: initial_collateral

\`\`\`bridgeflow
label: InitialCollateral
inputs:
  - label: operator
outputs:
  - amount: "2.00000000"
    spending_paths:
      - id: operator_collateral
        label: operator collateral
\`\`\`

## tx: round_0

\`\`\`bridgeflow
label: Round(0)
inputs:
  - tx: initial_collateral
    output: 0
    spending_path: operator_collateral
outputs:
  - amount: "1.95000000"
    spending_paths:
      - id: collateral_in_round
        label: operator collateral
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_1
        label: |-
          kickoff connector 1
          operator
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_2
        label: |-
          kickoff connector 2
          operator
  - amount: "0.00000000"
    spending_paths:
      - id: extension_kickoff_connector
        label: |-
          kickoff connector 50
          extension
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_connector_1
        label: reimburse connector 1
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_connector_2
        label: reimburse connector 2
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_connector_3
        label: reimburse connector 3
\`\`\`

## tx: ready_to_reimburse_0

\`\`\`bridgeflow
label: ReadyToReimburse(0)
inputs:
  - tx: round_0
    output: 0
    spending_path: collateral_in_round
outputs:
  - amount: "1.90000000"
    spending_paths:
      - id: collateral
        label: operator
\`\`\`

## tx: round_1

\`\`\`bridgeflow
label: Round(1)
inputs:
  - tx: ready_to_reimburse_0
    output: 0
    spending_path: collateral
    arrow_label: 1.5 days
    color: delayed_round_advance
outputs:
  - amount: "1.85000000"
    spending_paths:
      - id: collateral_in_round
        label: operator collateral
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_1
        label: |-
          kickoff connector 1
          operator
  - amount: "0.00000000"
    spending_paths:
      - id: kickoff_2
        label: |-
          kickoff connector 2
          operator
  - amount: "0.00000000"
    spending_paths:
      - id: extension_kickoff_connector
        label: |-
          kickoff connector 50
          extension
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_prev_round_1
        label: reimburse round 0 connector 1
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_prev_round_2
        label: reimburse round 0 connector 2
  - amount: "0.00000000"
    spending_paths:
      - id: reimburse_prev_round_3
        label: reimburse round 0 connector 3
\`\`\`

## tx: ready_to_reimburse_1

\`\`\`bridgeflow
label: ReadyToReimburse(1)
inputs:
  - tx: round_1
    output: 0
    spending_path: collateral_in_round
outputs:
  - amount: "1.80000000"
    spending_paths:
      - id: collateral
        label: operator
\`\`\`

## tx: unspent_kickoff_connector_0_1

\`\`\`bridgeflow
label: UnspentKickoffConnector(0,1)
inputs:
  - tx: ready_to_reimburse_0
    output: 0
    spending_path: collateral
    arrow_label: setup-signed
    color: operator_setup_signature
  - tx: round_0
    output: 1
    spending_path: kickoff_1
    color: operator_setup_signature
outputs:
  - amount: "1.89990000"
    spending_paths:
      - id: operator_reimbursement
        label: operator reimbursement
\`\`\`

## tx: reimburse_0_from_round_1

\`\`\`bridgeflow
label: Reimburse(0 via Round 1)
inputs:
  - tx: round_1
    output: 4
    spending_path: reimburse_prev_round_1
    color: operator_setup_signature
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: reimbursement_complete
        label: round 0 reimbursed
\`\`\`

## tx: extended_round_0

\`\`\`bridgeflow
label: ExtendedRound(0)
inputs:
  - tx: round_0
    output: 3
    spending_path: extension_kickoff_connector
    arrow_label: nonstandard extension
    color: extension_path
outputs:
  - amount: "0.00000000"
    spending_paths:
      - id: extended_kickoff_connector_set
        label: |-
          200x 0-sat
          kickoff connectors
  - amount: "0.00000000"
    spending_paths:
      - id: extended_reimburse_connector_set
        label: extended reimburse connectors
\`\`\`

<!-- bridgeflow:layout
txs:
  extended_round_0:
    x: 903
    y: 1034
  initial_collateral:
    x: 80
    y: 160
  ready_to_reimburse_0:
    x: 1160
    y: 160
  ready_to_reimburse_1:
    x: 2360
    y: 160
  reimburse_0_from_round_1:
    x: 3017
    y: -204
  round_0:
    x: 560
    y: 160
  round_1:
    x: 1760
    y: 160
  unspent_kickoff_connector_0_1:
    x: 1342
    y: 389
-->
`;export{n as default};
