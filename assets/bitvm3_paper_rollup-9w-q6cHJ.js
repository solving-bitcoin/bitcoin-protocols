const n=`# BitVM3 paper - Bitcoin rollup bridge

Users enter through a committee-authorized deposit swap: reserve funding enables delayed rollup minting, while relaying the cancellation secret aborts it. To exit, a user burns wBTC with a presigned PegOut fixing the recipient and amount. Its unique user connector prevents duplicate fulfillment; any operator can add liquidity and pay the user. Reimbursement proves both the rollup burn and matching Bitcoin payout against a Bitcoin checkpoint.

The operator advances a checkpoint chain with garbled header-chain proofs and timestamp bounds; invalid proofs or missed deadlines let challengers consume its chain and claim connectors. After the checkpoint dispute window, Assert uses a claim connector and matching Lamport-signed checkpoint hashes to bind its proof. False-output labels or conflicting checkpoint signatures can consume Assert's output; otherwise Withdraw combines it with the reserve after another Delta. Verified garbling, committee presignatures with honest key deletion, and active challengers enforce the intended restrictions. Checkpoint branches repeat per epoch and claim; Bitcoin consensus assumptions and the paper's symbolic timing parameters govern the light client.

Source: [BitVM3: Efficient Bitcoin Bridges via Garbled Circuits](https://eprint.iacr.org/2026/933.pdf)

\`\`\`bridgeflow
color_groups:
  committee_presignature: blue
  operator_signature: green
  user_signature: teal
  secret_reveal: purple
  permissionless_challenge: red
  timeout_path: orange
\`\`\`

## tx: request

\`\`\`bridgeflow
label: Request
inputs:
  - label: user funds
outputs:
  - amount: u
    label: Deposit request
    spending_paths:
      - id: cancel_secret
        label: |-
          reveal s_a
          Hashlock(s_a)
      - id: committee_deposit
        label: |-
          N-of-N committee
          CheckCovenant
\`\`\`

## tx: deposit

\`\`\`bridgeflow
label: Deposit
inputs:
  - tx: request
    output: 0
    spending_path: committee_deposit
    sighash_flag: sighash_all
    color: committee_presignature
outputs:
  - amount: u
    label: Bridge reserve
    spending_paths:
      - id: committee_withdraw
        label: |-
          N-of-N committee
          Withdraw presigned for
          this Deposit + specific Assert
\`\`\`

## tx: cancel

\`\`\`bridgeflow
label: Cancel (reveal s_a)
inputs:
  - tx: request
    output: 0
    spending_path: cancel_secret
    arrow_label: relay s_a to abort mint
    color: secret_reveal
outputs:
  - amount: u
    label: Refund (schematic)
    spending_paths:
      - id: user
        label: user
\`\`\`

## tx: assert_funding

\`\`\`bridgeflow
label: Assert funding UTXO (template)
inputs:
  - label: operator funding; amount unspecified
outputs:
  - amount: "*"
    label: Proof commitment input
    spending_paths:
      - id: garbled_signature
        label: |-
          CheckGS(pk_GS)
          signature reveals garbled proof labels
\`\`\`

## tx: user_connector

\`\`\`bridgeflow
label: User connector UTXO (template)
inputs:
  - label: user creates unique zero-value connector
outputs:
  - amount: "0.00000000"
    label: PegOut connector
    spending_paths:
      - id: user
        label: user
\`\`\`

## tx: pegout

\`\`\`bridgeflow
label: PegOut
inputs:
  - tx: user_connector
    output: 0
    spending_path: user
    sighash_flag: sighash_single|anyonecanpay
    color: user_signature
    arrow_label: template embedded in rollup Burn
  - label: operator supplies payout funds
outputs:
  - amount: u - f_O
    label: User receives BTC
    spending_paths:
      - id: user
        label: user
\`\`\`

## tx: checkpoint_i

\`\`\`bridgeflow
label: Checkpoint i
inputs:
  - label: |-
      txin_0 or Checkpoint(i-1):0
      operator + GS(phi_i, pi_LC,i)
      Lamport commitment to H_i, T_i
      previous BurnScript
outputs:
  - amount: "0.00000000"
    label: Checkpoint chain connector (vout 0)
    spending_paths:
      - id: advance_checkpoint
        label: |-
          BurnScript_i (Table 10)
          operator + CheckGS + CLTV(T_i - 2h)
      - id: checkpoint_deadline
        label: |-
          anyone after block height
          i * 2016 + k + m_t
      - id: checkpoint_disprove
        label: |-
          any challenger with L*_LC,i
          invalid checkpoint proof
  - amount: "0.00000000"
    label: Peg-out gate (representative j = 1)
    spending_paths:
      - id: assert_gate
        label: |-
          operator + CSV(Delta)
          Lamport(pk_H,i^C, H_C)
          + Lamport(pk_H,i^A, H_A)
          + H_C = H_A
      - id: checkpoint_deadline
        label: |-
          anyone after block height
          i * 2016 + k + m_t
      - id: checkpoint_disprove
        label: |-
          any challenger with L*_LC,i
          invalid checkpoint proof
\`\`\`

## tx: checkpoint_next

\`\`\`bridgeflow
label: Checkpoint i+1 (repeat)
inputs:
  - tx: checkpoint_i
    output: 0
    spending_path: advance_checkpoint
    color: operator_signature
    arrow_label: timestamp-bound advance
    label: |-
      header-chain proof
      + Lamport hash/time commitment
outputs:
  - amount: "0.00000000"
    label: Checkpoint chain connector (vout 0)
    spending_paths:
      - id: advance_checkpoint
        label: |-
          BurnScript_(i+1) (Table 10)
          operator + CheckGS + CLTV(T_(i+1) - 2h)
      - id: checkpoint_deadline
        label: |-
          anyone after block height
          (i+1) * 2016 + k + m_t
      - id: checkpoint_disprove
        label: |-
          any challenger with L*_LC,(i+1)
          invalid checkpoint proof
  - amount: "0.00000000"
    label: Peg-out gate (representative j = 1)
    spending_paths:
      - id: assert_gate
        label: |-
          operator + CSV(Delta)
          Lamport(pk_H,(i+1)^C, H_C)
          + Lamport(pk_H,(i+1)^A, H_A)
          + H_C = H_A
      - id: checkpoint_deadline
        label: |-
          anyone after block height
          (i+1) * 2016 + k + m_t
      - id: checkpoint_disprove
        label: |-
          any challenger with L*_LC,(i+1)
          invalid checkpoint proof
\`\`\`

## tx: disprove_checkpoint_chain

\`\`\`bridgeflow
label: DisproveCheckpoint i (chain connector)
inputs:
  - tx: checkpoint_i
    output: 0
    spending_path: checkpoint_disprove
    color: permissionless_challenge
outputs: []
\`\`\`

## tx: burn_checkpoint_chain

\`\`\`bridgeflow
label: Burn i (chain connector)
inputs:
  - tx: checkpoint_i
    output: 0
    spending_path: checkpoint_deadline
    color: timeout_path
    arrow_label: CLTV(i * 2016 + k + m_t)
outputs: []
\`\`\`

## tx: disprove_checkpoint_gate

\`\`\`bridgeflow
label: DisproveCheckpoint i (peg-out gate j=1)
inputs:
  - tx: checkpoint_i
    output: 1
    spending_path: checkpoint_disprove
    color: permissionless_challenge
outputs: []
\`\`\`

## tx: burn_checkpoint_gate

\`\`\`bridgeflow
label: Burn i (peg-out gate j=1)
inputs:
  - tx: checkpoint_i
    output: 1
    spending_path: checkpoint_deadline
    color: timeout_path
    arrow_label: CLTV(i * 2016 + k + m_t)
outputs: []
\`\`\`

## tx: assert_tx

\`\`\`bridgeflow
label: Assert i,1 (rollup reimbursement)
inputs:
  - tx: assert_funding
    output: 0
    spending_path: garbled_signature
    color: operator_signature
    label: |-
      SNARK relative to H(B_i):
      rollup Burn + matching Bitcoin PegOut
      bound to this reimbursement instance
  - tx: checkpoint_i
    output: 1
    spending_path: assert_gate
    color: operator_signature
    arrow_label: |-
      after Delta from Checkpoint i
      reuse checkpoint signature; equal hashes
outputs:
  - amount: "*"
    label: Reimbursement connector
    spending_paths:
      - id: false_output_label
        label: |-
          any challenger with L*
          false-output label of garbled verifier
      - id: checkpoint_equivocation
        label: |-
          any challenger with conflicting
          Lamport signatures on H_i
          under checkpoint key pk_H,i^C
      - id: operator_timeout
        label: operator + CSV(Delta)
\`\`\`

## tx: disprove

\`\`\`bridgeflow
label: Disprove
inputs:
  - tx: assert_tx
    output: 0
    spending_path: false_output_label
    color: permissionless_challenge
    arrow_label: "invalid proof: reveal L*"
outputs:
  - amount: "*"
    label: Table 4 output (unspecified value)
    spending_paths:
      - id: anyone
        label: anyone (True)
\`\`\`

## tx: punish_equivocation

\`\`\`bridgeflow
label: PunishEquiv i
inputs:
  - tx: assert_tx
    output: 0
    spending_path: checkpoint_equivocation
    color: permissionless_challenge
    arrow_label: two distinct signed hashes
outputs: []
\`\`\`

## tx: withdraw

\`\`\`bridgeflow
label: Withdraw i,1
inputs:
  - tx: deposit
    output: 0
    spending_path: committee_withdraw
    sighash_flag: sighash_all
    color: committee_presignature
  - tx: assert_tx
    output: 0
    spending_path: operator_timeout
    color: timeout_path
    arrow_label: after Delta from Assert
outputs:
  - amount: u
    label: Operator reimbursement
    spending_paths:
      - id: operator
        label: operator
\`\`\`

<!-- bridgeflow:layout
txs:
  assert_funding:
    x: 1050
    y: 520
  assert_tx:
    x: 1850
    y: 680
  burn_checkpoint_chain:
    x: 660
    y: 1340
  burn_checkpoint_gate:
    x: 650
    y: 1790
  cancel:
    x: 400
    y: 350
  checkpoint_i:
    x: 0
    y: 1250
  checkpoint_next:
    x: 1447
    y: 1264
  deposit:
    x: 680
    y: 0
  disprove:
    x: 2780
    y: 730
  disprove_checkpoint_chain:
    x: 660
    y: 1200
  disprove_checkpoint_gate:
    x: 650
    y: 1700
  pegout:
    x: 440
    y: 640
  punish_equivocation:
    x: 2780
    y: 1100
  request:
    x: 0
    y: 0
  user_connector:
    x: 0
    y: 640
  withdraw:
    x: 2850
    y: 0
-->
`;export{n as default};
