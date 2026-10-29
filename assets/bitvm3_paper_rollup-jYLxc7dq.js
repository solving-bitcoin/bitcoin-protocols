const n=`# BitVM3 paper - Bitcoin rollup bridge

Users enter through a committee-authorized deposit swap: reserve funding enables delayed rollup minting, while relaying the cancellation secret aborts it. To exit, a user burns wBTC with a presigned PegOut fixing the recipient and amount. Its unique user connector prevents duplicate fulfillment; any operator can add liquidity and pay the user. Reimbursement proves both the rollup burn and matching Bitcoin payout against a Bitcoin checkpoint.

The operator advances a checkpoint chain with garbled header-chain proofs and timestamp bounds; invalid proofs or missed deadlines let challengers consume its chain and claim connectors. After the checkpoint dispute window, Assert uses a claim connector and matching Lamport-signed checkpoint hashes to bind its proof. False-output labels or conflicting checkpoint signatures can consume Assert's output; otherwise Withdraw combines it with the reserve after another Delta. Verified garbling, committee presignatures with honest key deletion, and active challengers enforce the intended restrictions. Checkpoint branches repeat per epoch and claim; Bitcoin consensus assumptions and the paper's symbolic timing parameters govern the light client.

Source: [BitVM3: Efficient Bitcoin Bridges via Garbled Circuits](https://eprint.iacr.org/2026/933.pdf)

## Actors

| Actor | Role |
| --- | --- |
| User | Deposits BTC through the deposit swap. To withdraw, burns wBTC on the rollup and embeds a presigned PegOut fixing the Bitcoin recipient and amount. |
| N-of-N signers | Verify each operator's garbled setup and transaction templates, sign Deposit, and presign the permitted Withdraw transactions before deleting the reserve signing keys. |
| Operator | Maintains a Bitcoin checkpoint chain, fronts the user's PegOut, proves the rollup burn and Bitcoin payout in Assert, and receives reimbursement through Withdraw. |
| Challenger | Monitors checkpoints and reimbursement claims, evaluates the published garbled circuits, and spends invalid claims or expired checkpoint connectors. Challenging is permissionless. |

## Protocol phases

| Phase | Protocol action |
| --- | --- |
| Setup | Each operator prepares its light-client checkpoint instances and a shared reimbursement verifier. The N-of-N signers verify the garbling, signature-encoding keys, and transaction templates. The garbled circuits are published for permissionless challengers. |
| Deposit | The user posts Request. All N signers sign Deposit and presign its permitted Withdraw alternatives for the prepared operators and checkpoints. After registration on the rollup, Deposit can be broadcast; wBTC is minted after the cancellation window if no cancellation secret is relayed. |
| Withdrawal | The user burns wBTC with a presigned PegOut. An operator adds its funds and pays the user, then uses a checkpoint covering both the burn and payout. After that checkpoint's dispute window, it posts Assert. Challengers can disprove an invalid proof or punish checkpoint equivocation; otherwise, after another dispute window, Withdraw reimburses the operator. |

## Protocol parameters

| Parameter | Meaning |
| --- | --- |
| **N** | Number of N-of-N signers. |
| **M** | Number of registered operators with prepared reimbursement paths. |
| \`num_checkpoints\` | Total number of prepared checkpoint epochs per operator, including the initial instance. Bitcoin difficulty epochs contain 2,016 blocks. |
| \`num_reimburse_connectors\` | Number of claim connectors per operator and checkpoint, excluding the connector used to advance the checkpoint chain. |
| \`num_signed_reimburse_connectors\` | Number of those claim connectors authorized for a particular deposit, operator, and checkpoint through a presigned Deposit–Assert withdrawal pair. |
| \`u\` | Deposit / withdrawal denomination in BTC; the operator pays \`u − f_O\`, where \`f_O\` is its fee. |
| \`Delta\` | Dispute / cancellation delay, written as Δ below. It remains symbolic in the paper and graph. |
| \`k\`, \`m_t\` | Bitcoin confirmation-depth and timestamp-convergence margins used in checkpoint deadlines. |

## Trust assumptions

| Property | Assumption |
| --- | --- |
| Safety | Correct committee setup and verified garbling; at least **1 of N signers** authorizes only the permitted transaction pairs and honestly deletes its signing key; at least **one honest challenger** can monitor and dispute within the deadlines. Bitcoin and the rollup must remain secure, and the SNARK and signature / garbling schemes must satisfy their security assumptions. |
| Deposit liveness | **All N signers** must be online and willing to sign Deposit and its reimbursement alternatives. One unavailable signer can stall deposit acceptance. The rollup must process registration and minting after the cancellation window. |
| Withdrawal liveness | At least **1 of M operators** is honest, has liquidity to front the payout, and maintains a usable checkpoint chain with an available, presigned reimbursement connector. Bitcoin and the rollup must include valid transactions within the assumed delays. |

The paper assumes honest committee setup, then uses one honest signer's key deletion to prevent new reserve-spending transactions. The challenger's role is independent: an invalid garbled proof reveals a false-output label that blocks reimbursement, while conflicting checkpoint signatures or missed checkpoint deadlines provide other ways to invalidate the operator's path.

The Bitcoin light client checks each epoch's header chain and difficulty adjustment. Timestamp locks prevent an operator from advancing with arbitrarily future-dated checkpoints to lower its private fork's difficulty; a missed deadline lets a challenger burn the checkpoint connector. Its security depends on Bitcoin's common-prefix, chain-quality, and chain-growth properties, with \`k\` and \`m_t\` chosen for those assumptions. See [Sections 5 and 7.2 and Appendix D](https://eprint.iacr.org/2026/933.pdf).

## Off-chain resources

| Phase | Resources |
| --- | --- |
| Setup | \`M × num_checkpoints\` light-client garbled setups + \`M\` shared reimbursement garbled setups, with their signature-encoding artifacts. Preparing all claim slots also requires \`M × num_checkpoints × num_reimburse_connectors\` Assert–Withdraw template pairs. |
| Deposit | \`N × (1 + M × num_checkpoints × num_signed_reimburse_connectors)\` signatures per deposit across all signers: one Deposit signature per signer plus the Withdraw presignatures. Per signer, the count is \`1 + M × num_checkpoints × num_signed_reimburse_connectors\`. |

Challengers use the published circuits; additional challengers do not require additional garbled setups. A deposit can use only the connectors covered by its presigned Withdraw alternatives. These counts describe the paper's shared-circuit design in [Section 6.3 and Figure 15](https://eprint.iacr.org/2026/933.pdf); setup verification may generate additional candidate garblings, depending on the chosen verification method.

## Throughput and capacity

Each operator prepares \`num_reimburse_connectors\` claim slots per checkpoint epoch. An epoch spans **2,016 Bitcoin blocks**, nominally **14 days**. If every slot is usable and has a matching deposit authorization, its prepared reimbursement capacity is \`num_reimburse_connectors × u\` BTC per epoch, averaging \`num_reimburse_connectors × u / 14\` BTC per day. For example, 100 connectors and a 10 BTC denomination provide **100 reimbursements**, or **1,000 BTC per epoch**, averaging about **71 BTC per day per operator**. Claims can proceed in parallel through different connectors.

The user receives BTC when PegOut confirms; the operator is reimbursed later. It must wait for a checkpoint covering the burn and payout, then Δ before Assert and another Δ before Withdraw. Invalidating a checkpoint or missing its advancement deadline can disable that operator's remaining checkpoint chain. A disproof of an individual Assert consumes that claim's connector without spending the reserve.

An operator's maximum prepared claim capacity is \`num_checkpoints × num_reimburse_connectors\`. With 100 checkpoints and 100 claim connectors each, that is **10,000 reimbursement slots**, or **100,000 BTC** at a 10 BTC denomination, over roughly **3.8 years**. A particular deposit is eligible only for its presigned subset, and its reserve UTXO can be spent once. Multiple operators and checkpoint alternatives therefore do not multiply the BTC held in the reserve. Effective throughput also depends on operator liquidity, proof generation, and Bitcoin transaction capacity.

## Caveats and open questions

- The checkpoint chain has a finite prepared lifetime. Continued operation needs a new setup before its checkpoint instances are exhausted.
- The graph's zero-value spendable connectors are schematic; concrete funding amounts and fees must satisfy Bitcoin's relay policy.
- The paper shares a reimbursement circuit across claims, while its Lamport encoding example is one-time. The concrete encoding scheme must support that reuse without exposing incompatible input labels.

\`\`\`bridgeflow
color_groups:
  nofn_presignature: blue
  user_presignature: red
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
    color: nofn_presignature
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
    color: user_presignature
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
outputs: []
\`\`\`

## tx: burn_checkpoint_chain

\`\`\`bridgeflow
label: Burn i (chain connector)
inputs:
  - tx: checkpoint_i
    output: 0
    spending_path: checkpoint_deadline
    arrow_label: "height i × 2016 + k + m_t"
outputs: []
\`\`\`

## tx: disprove_checkpoint_gate

\`\`\`bridgeflow
label: DisproveCheckpoint i (peg-out gate j=1)
inputs:
  - tx: checkpoint_i
    output: 1
    spending_path: checkpoint_disprove
outputs: []
\`\`\`

## tx: burn_checkpoint_gate

\`\`\`bridgeflow
label: Burn i (peg-out gate j=1)
inputs:
  - tx: checkpoint_i
    output: 1
    spending_path: checkpoint_deadline
    arrow_label: "height i × 2016 + k + m_t"
outputs: []
\`\`\`

## tx: assert_tx

\`\`\`bridgeflow
label: Assert i,1 (rollup reimbursement)
inputs:
  - tx: assert_funding
    output: 0
    spending_path: garbled_signature
    label: |-
      SNARK relative to H(B_i):
      rollup Burn + matching Bitcoin PegOut
      bound to this reimbursement instance
  - tx: checkpoint_i
    output: 1
    spending_path: assert_gate
    arrow_label: "Δ"
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
    color: nofn_presignature
  - tx: assert_tx
    output: 0
    spending_path: operator_timeout
    arrow_label: "Δ"
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
    x: 1013
    y: 639
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
