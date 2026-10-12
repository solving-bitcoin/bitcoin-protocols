const e=`# Binohash ancestry bridge

**The N-of-N committee acts only when a deposit is accepted.** It presigns the
reserve's reimbursement alternatives and an absence penalty for each claim
slot, then deletes the signing keys. Operators, rollup publishers, and
permissionless challengers handle every subsequent step.

The key construction is a **presigned missing-capture penalty**. Keep the
dynamic Binohash Capture separate from a fixed-txid Assert. If the Binohash slot
is still unspent, anyone can consume it together with Assert's reimbursement
gate using the penalty. If Capture spends the slot first, its forced HORS
signature authenticates the actual captured history for the fraud proof.
Both kinds of fraud therefore attack the same fixed gate that the reserve
requires. No future Capture txid appears in a deposit-time signature.

Change the rollup's publishing transactions to form a unique state-UTXO thread
with read outputs. Capture imports both a valid burn's ordered history and the
operator's actual Bitcoin payout. This replaces the claimed Bitcoin header-chain
comparison with an ancestry-and-execution proof.

This is a protocol-level research proposal, not an implemented or audited
bridge. It assumes the local Binohash and garbled-verifier interfaces, including
their full transcript checks. The exact script and cryptographic composition
still needs implementation and validation. No new Bitcoin consensus rule or
live replacement custodian is assumed.

## Local sources and deductions

Only local files were used, reviewed 2026-10-11 at workspace revision \`1c70210\`.
Their linked papers and implementations were not fetched.

| Local source | Mechanism used |
| --- | --- |
| [Clementine v2](clementine-v2.md) | Deposit-time presigning and key deletion; operator-funded payouts; unused-connector penalties that consume a control output together with an unused slot. In particular, \`unspent_kickoff_tx\` and the other \`UnspentKickoff\` variants supply the absence-penalty pattern. |
| [BitVM3 rollup bridge](bitvm3_paper_rollup.md) | Unique user payout connector; mandatory proof encoding; verified garbling; permissionless false-label disproof; a fixed Assert connector required alongside the reserve in Withdraw. |
| [Binohash primitive](primitives/binohash.md) | Forced HORS signature on the spending transaction's Binohash; transitive prevout authentication; the two-output/three-input construction and a separate mutable grinding ancestor. |

Source-file SHA-256 digests:

\`\`\`text
clementine-v2.md       514178c4917e8c4f6da74ea873eeed34617ac5935b62221901176bfd98f15220
bitvm3_paper_rollup.md e074cfc483ec2e9f4c380e989b1a330d09bf03de603adfc73ecd76260cfc3bad
primitives/binohash.md e184896513f39ca8860017691a0de713c8ad38f314d6fc3da97f1708522b13ce
\`\`\`

The missing-capture composition, publishing format, proof relation, and timing
argument below are new proposals/deductions. They are not attributed to the
source papers. The local sources are summaries, not executable specifications.

## Two branches joined by one dispute gate

For one reserve R, operator o, and one-time claim slot j:

\`\`\`text
Dynamic history:
  earlier rollup history → publish/read ─┐
                                payout ├→ read-and-grind → Capture
                      Binohash slot F ─┘

Fixed deposit-time templates:
  proof funding P → Assert A → gate A:0 ─┬→ Reimburse, together with R
                                        ├→ Disprove, using false label L*
                                        └→ MissingCapture, together with unspent F

Capture and MissingCapture conflict on F.
Reimburse, Disprove, and MissingCapture conflict on A:0.
\`\`\`

There is intentionally **no Capture → Assert Bitcoin input**. That would make
Assert's txid depend on future ancestors and Binohash's legacy scriptSig again.
The connection is instead enforced by the two mutually exclusive ways of
spending F and the challenger's ability to consume A:0.

## Exactly what the presignatures commit to

Capture's txid **does change** when its legacy scriptSig, grinding fields, or
imported ancestors change. No attempt is made to stabilize it. Neither Capture
nor any of its descendants may be an input to a deposit-time presigned
reimbursement transaction or an ancestor of its fixed Assert.

Use these exact outpoints; F is the **funding output**, not Capture's output:

| Name | Bitcoin outpoint or transaction inputs | When fixed |
| --- | --- | --- |
| R | \`MoveToVault:0\` | Deposit acceptance |
| F | \`FundBinohash:0\` | Deposit acceptance |
| P | \`AssertFunding:0\`, or the complete fixed set of proof chunks | Deposit acceptance |
| Assert A | Inputs \`[P]\`; fixed transaction body, variable proof witness | Body fixed at deposit; proof later |
| Reimburse W | Inputs \`[R, (txid(A), 0)]\` | Deposit acceptance |
| MissingCapture X | Inputs \`[F, (txid(A), 0)]\` | Deposit acceptance |
| Capture C | Inputs \`[ReadAndGrind:0, ReadAndGrind:1, F]\` | Withdrawal time; never presigned by the committee |

The reimbursement signature therefore commits to \`txid(A)\`, not \`txid(C)\`.
Changing C cannot propagate into A because A spends only P. MissingCapture
references the same fixed F that C spends; it does not spend an output of C.
The HORS signature flows from C into **off-chain circuit evaluation**, not into
a prevout of A or W.

This separation imposes a concrete implementation requirement: P's locking
script and A's non-witness fields must not contain a future Capture txid, H,
payout txid, burn ID, or proof. P commits to prepared encoding keys and the
fixed verifier context. Future proof/input selections must use its SegWit
witness and the Binohash-to-circuit input interface. If an implementation has to
rebuild P or A after learning C, the dependency becomes \`P → A → W\`, and the
deposit-time reimbursement signature really does fail. Merely calling A
"fixed" would not repair that implementation.

These are transaction-dependency claims. They do not establish that the required
garbling/encoding adapter has been implemented correctly; that remains an
explicit construction obligation below.

The roles of the scripts and presignatures are:

| Output | Allowed spending conditions |
| --- | --- |
| Reserve R | N-of-N reserve key; only exact Reimburse templates are signed at deposit time, using \`SIGHASH_ALL\`. At least one signer deletes its share. |
| Binohash slot F | The Binohash path, or an N-of-N absence key. The **only** signed absence-key transaction is MissingCapture, which also consumes this slot's A:0. No operator-only cancellation/refund path exists. |
| Assert gate A:0 | Operator signature after \`CSV(Delta)\`, or false-output label L*, or the absence key used in that exact MissingCapture transaction. |
| Proof funding P | Mandatory one-time proof encoding for this slot. Assert's fixed transaction body consumes all required encoding chunks. |

MissingCapture is completely presigned on both inputs with \`SIGHASH_ALL\` during
deposit acceptance. Anyone can broadcast it without requesting any new
signature. Its outputs contain only operator collateral and an anyone-spendable
reward/fee-bumping output. It neither spends nor burns R.

Use separate reserve and absence role keys, both controlled by the same N-of-N
committee during this deposit ceremony and both deleted afterward. A slot F
belongs to **one** fixed Assert gate. Do not reuse F across alternative Assert
transactions or give its absence key another signed spend: that would let an
operator consume F while leaving the relevant reimbursement gate alive.

The Binohash script needs an authenticated absence branch. This is a proposed
composition, not an existing branch in the local isolated primitive. Its actual
bytecode must preserve all Binohash checks and account for the changed scriptCode
and script limits. Simply pasting a branch onto unaudited bytecode is not enough.
It remains a bare legacy script: moving Binohash into a SegWit or Taproot leaf
would not preserve the legacy behavior used by the supplied primitive. The
extra branch must fit the legacy consensus limits, not merely miner policy.

## Deposit-time setup closes every future authorization

The operator prepares one-time slots; the committee verifies and authorizes
them only while accepting the deposit:

1. Construct MoveToVault with a stable transaction body, fixing R. Use native
   SegWit funding so witness signatures do not change the
   prospective txid. Do not release the deposit into custody before setup is
   complete.
2. Fix each operator's Binohash funding outpoint F and fresh HORS commitments.
   Prepare a verified garbled verifier G for \`(network, bridge, rollup, version,
   rollup verifier, R, operator, slot, F)\`. Fix the proof-funding outpoints P and
   their one-time encoding keys. Funding txids must be confirmed or otherwise
   stable.
3. Construct Assert with only fixed SegWit inputs P, fixed outputs, sequences,
   version, and locktime. Its future proof encoding lives in the witness, so
   Assert's txid is known now. Verify all proof chunks are mandatory.
4. Presign Reimburse spending exactly R and A:0, with fixed operator payment
   outputs. Presign MissingCapture spending exactly F and A:0. Publish the
   complete penalty transactions and challenger artifacts before acceptance.
5. Delete the per-deposit reserve and absence signing shares after signing the
   entire approved finite set. Release MoveToVault only after the deposit's
   setup checks and signature collection are complete.

No circuit constant needs to contain its own funding txid. Fix R and F first;
the proof-funding scripts and Assert are constructed afterward. The circuit's
dynamic Bitcoin digest is supplied by the forced Binohash signature, not by a
future committee-signed constant.

At withdrawal time the operator does not contact the committee. It uses the
already prepared slot, circuit, Assert body, Reimburse signatures, and penalty.
A failed slot can be retried through another already authorized slot. Exhausting
all slots is a finite-setup liveness limit; this design does not silently call
the committee back to replenish an old deposit.

## Rollup publishing format

The rollup adopts an explicit UTXO-ordered admission rule:

1. Pin a network, bridge/rollup ID, program version, and the rollup's verifier
   and bootstrap configuration. Every admitted publication spends the previous
   state-thread output at input 0 and creates its successor at output 0.
2. Put the batch sequence, preceding/next state roots, and batch-data commitment
   in the transaction's **non-witness body**. The execution proof checks every
   state-thread link covered by its recursively verified history. Hashing an
   arbitrary state root is not proof of a valid transition or of complete history.
3. The rollup handles MoveToVault inclusion and deposit admission internally:
   check Bitcoin inclusion/finality under its deposit rules, R's amount and
   approved reserve script, and one-time registration of its outpoint. The
   bridge proof verifies the resulting rollup state. No additional Bitcoin mint
   receipt or publication input spending a MoveToVault output is required.
4. A burn irreversibly reserves R and binds \`(burn_id, R, q, user_script,
   payout_amount, fee)\`, where q is a unique Bitcoin user payout connector.
   State-transition nullifiers prevent reusing R or q for another burn.
5. A publication containing that burn, or a later valid publication containing
   it in its history, creates an operator-owned read output. Read-and-grind
   spends it together with an output of the actual payout and creates the two
   auxiliary outputs consumed by Capture.

Earlier publications and the rollup bootstrap are omitted from the drawing.
Their verification remains inside the recursive rollup proof. Moving deposit
admission into the rollup does not make an arbitrary deposit hash sufficient:
the rollup's deposit verifier must establish the inclusion/finality and backing
conditions above. No separate bridge-side header proof is introduced for that
check, and MoveToVault need not be an ancestor of Capture.

The read output is separate from the state-thread output, so claims do not stop
ordinary batch publication. Multiple read outputs or later read-output fanouts
can serve different operators/slots. They are ordinary funded outputs, with
transaction-size and fee costs; they are not a free or unbounded resource.

Read-and-grind also leaves a small operator-owned carry output. A fresh slot can
import the same evidence through that surviving descendant after a failed proof,
without trying to spend the original read ticket or payout marker twice. The
ancestry relation must support this authenticated descendant chain. Continuing
the carry chain or preparing additional fanout outputs costs operator funds;
destroying every usable descendant can make that operator's retry unavailable.

Read-and-grind includes a nonce in its body. Vary that nonce before publication
to grind a new ancestor txid while keeping the already published rollup history
and payout unchanged. Capture uses this transaction's outputs at inputs 0 and
1, its fixed Binohash slot at input 2, and exactly two outputs, matching the
local primitive's legacy SINGLE out-of-range topology.

The rollup's canonical state is defined by this unique publication thread.
The proof must include every intervening thread transaction, not just a chosen
subsequence of valid-looking batches. A valid older prefix is sufficient for an
irreversible burn: a valid successor must not restore the burned balance or
reuse the reserved R. No newest-tip proof is required for that monotone claim.

This does not work unchanged for a rollup whose canonical order is defined by
all transactions in Bitcoin block order or by another consensus protocol. Such
a rollup must adopt the stated publishing/admission rule or retain a proof of
its original completeness/finality rule.

The sequencer still controls state-thread continuation. Bitcoin does not enforce
rollup execution or force a successor output. An invalid transition, destroyed
successor, or unavailable batch data can halt future proofs. This is a rollup
liveness assumption, not committee custody or an invented recovery path. An
earlier valid burn can remain usable through an available read descendant.

## Proof relation and actual-spend binding

The prepared circuit obtains H from the signature forced by the **actual spend
of F**, and proof pi from Assert's mandatory signature encoding. Its fixed
context names R, operator, F, slot, program, network, and the rollup verifier.
It constructs the verifier statement from that fixed context and H.

The operator cannot substitute an independently chosen H from its Assert
witness. In particular, the operator knows its HORS secrets and can sign other
messages off-chain. Existence of some valid HORS signature is insufficient: the
challenger evaluates with the signature publicly forced by F's actual Bitcoin
spend and the correctly prepared input-label mapping.

The proof establishes:

| Check | Required assertion |
| --- | --- |
| Binohash | Authenticate the spending transaction, pinning rounds, subset extraction, script instance, and canonical \`0x01\` flags for both extraction rounds, as required by the local primitive. |
| Ancestry | Recompute txids and check actual prevouts/output indices linking Capture to its read publication and the matching payout. A mere OP_RETURN reference to an unrelated transaction or block is insufficient. |
| Rollup execution | Verify the designated publication thread against recursively verified prior rollup state, including deposit admission, reserve uniqueness, and irreversible burn/nullifier rules. |
| Deposit admission | Inside the rollup's verified execution, MoveToVault satisfied its inclusion/finality rules, R's amount/script were accepted, and R was registered once. No bridge mint-receipt UTXO is used. |
| Burn | The valid state burns the denomination and binds R, q, recipient, and exact payout amount. |
| Payout | The actual ancestor payout spends q and pays the bound user output. Its marker identifies the operator reimbursed by this slot. Operator signatures fix the full payout; the user's \`SINGLE|ANYONECANPAY\` fixes its corresponding recipient output. |
| Scope | The claim matches every fixed context field. A proof for another reserve, operator, bridge, slot, or rollup verifier configuration fails. |

A malformed or invalid **forced** proof must expose L*, letting any challenger
spend A:0. Uncommitted proof bytes chosen by a challenger must not be able to
produce that label for an honest claim. Conversely, withholding the required
proof encoding must make the fixed Assert transaction unspendable.

The Binohash adapter must also make malformed actual extraction/pinning
transcripts refutable. It is unsafe to implement a parser that merely returns
"no usable labels" after an invalid Capture has consumed F: that would disable
MissingCapture without enabling Disprove. Actual-transcript authentication,
canonical-flag enforcement in the off-chain verifier, and failure-label
completeness are explicit cryptographic proof obligations of this composition.
The local summary requires those checks but does not supply their compiler.

Transaction IDs do not bind SegWit witnesses. The rollup commitments and payout
conditions authenticated through ancestry are in transaction bodies. Execution
data used privately by a recursive proof must match those commitments and the
rollup's DA rule. Assert's proof witness is authenticated separately through its
mandatory one-time encoding, not through Assert's txid.

## Timing: a late Capture must not erase the challenge window

The honest operator publishes Capture first, waits for the configured
confirmation margin, and then broadcasts the fixed Assert with its proof.
Challengers nevertheless handle an operator who reverses that order.

As soon as Assert is observed, the challenger looks up the **specific F outpoint**:

- If F is unspent, broadcast the fully presigned MissingCapture immediately.
  Do not wait until Delta expires.
- If F was spent through Binohash, obtain that exact confirmed spending
  transcript and evaluate the forced proof. Submit Disprove if invalid.
- If Capture races and invalidates a pending MissingCapture, switch to evaluating
  that Capture. A different absence-key spend cannot preserve A:0 because only
  the exact two-input MissingCapture was authorized.

Define \`B_presence\` as a conservative bound, from Assert's first confirmation,
for monitoring plus settled resolution of the absence race: either
MissingCapture is confirmed with the chosen stability margin, or a conflicting
Capture is observed with that margin. Include the initial observation lag,
transaction inclusion bounds, and shallow-reorganization handling in this bound.
Define \`B_verify\` for transcript retrieval and evaluation, and \`B_disprove\` for
disproof broadcast, inclusion, and its stability margin, in the same block units.
Require:

\`\`\`text
Delta > B_presence + B_verify + B_disprove
\`\`\`

This is a bounded-inclusion/common-prefix assumption, not an unconditional
promise by Bitcoin or a measured parameter choice. If a valid MissingCapture
can be censored until just before reimbursement, the operator could reveal
Capture too late to dispute it. Choosing an arbitrary Delta without reserving
time for both phases would be unsafe. Block-based CSV also does not guarantee
a fixed wall-clock verification interval.

Unlike a direct parent-child design, **Capture is not a Bitcoin ancestor of
Reimburse**. A sufficiently deep reorganization can remove Capture while keeping
the independent Assert/Reimburse branch. This design therefore requires the
explicit confirmation/common-prefix margins above and consistent rollup rollback.
It must not claim that removal of the payout mechanically removes reimbursement.
The benefit is avoiding adversarial private-header comparisons, not eliminating
Bitcoin finality or challenger-inclusion assumptions.

## Safety argument

Assume correct setup with one honest key deleter, correct Binohash/garbling/proof
interfaces, and the timing and Bitcoin assumptions above. A reserve spend must
consume a preauthorized A:0. Its associated F can be in only one of these states:

| State of F | Consequence |
| --- | --- |
| Unspent | MissingCapture can consume F and A:0; the presence bound prevents an indefinitely missing capture from passing the gate. |
| Spent through the absence-key branch | The only available authorized transaction also consumes A:0. Reimburse is impossible. |
| Spent through Binohash with an invalid claim | Its actual transcript and Assert's forced proof enable Disprove within the reserved window. |
| Spent through Binohash with a valid claim | The proof establishes an admitted burn for R and a matching actual payout in Capture's canonical ancestry. Reimburse may proceed after Delta. |

R itself is never an input to either penalty. An invalid attempt cannot turn a
false label into permission to steal or burn principal. Reimburse consumes R
once; the ordered rollup's R/q nullifiers prevent the same payment from claiming
another reserve. Disproving one slot does not spend other slots or other reserves.

No reserve signature uses ANYONECANPAY. Merely allowing arbitrary extra inputs
on the reserve would allow the operator to omit the dispute gate. Here both
Reimburse and MissingCapture commit to their complete input sets and outputs.

## Assumptions, resources, and comparison

| Dimension | Result |
| --- | --- |
| Committee activity | All N participate only in this deposit's acceptance, verify setup, presign all approved alternatives, and delete reserve/absence key shares. No later signing, veto, timeout signature, or recovery signature is required. |
| Safety | One honest deposit signer/key deleter, verified garbling and proof soundness, Binohash's stated cryptographic/work-binding assumptions, one timely challenger, and Bitcoin common-prefix/inclusion assumptions. |
| Withdrawal liveness | One liquid operator with an unused authorized slot, available valid rollup history/read outputs, a usable proof/grinding implementation, and a Binohash mining path. No live committee. |
| Bitcoin consensus | No added opcode or native ZK verifier. The absence branch and fixed penalties are proposed ordinary-script/deleted-key compositions, subject to script validation. |
| Relay/mining | Preserve Binohash's nonstandard-mining dependency, including its bare script, signature deletion, and residual-stack requirements. \`acceptnonstdtxn\` alone is insufficient according to the local primitive. |
| Publishing | The rollup adopts the stated ordered thread/read-output format and data-availability rule. Sequencer liveness remains necessary. |
| One-time material | Fresh HORS commitments, proof encoding, and verified garbled instances for each slot. No claim of safe shared-garbling reuse follows merely from a shared verifier program. |
| Slot exhaustion | Existing deposits have finite prepared alternatives. More deposits can receive new setups, but an exhausted old reserve has no unspecified committee-free refresh or migration. |

For M operators and S slots per operator **per deposit**, there are \`M * S\`
Reimburse templates and \`M * S\` MissingCapture templates. With ordinary N-of-N
per-input signatures, the illustrated signing budget per deposit is:

\`\`\`text
N * (1 + 3 * M * S)
\`\`\`

The one is MoveToVault; each slot needs one reserve-input signature per signer
for Reimburse and two absence-input signatures per signer for MissingCapture.
Operator signatures and garbling verification are additional. Separate deposit-
bound circuits simplify the binding argument but may be expensive; do not reuse
the original sources' shared-circuit cost estimates for this construction.

Compared with the local Clementine model, this removes the watchtower/operator
private-work comparison and round-wide advancement dependency. Compared with
the local BitVM3 rollup model, it removes the prepared difficulty-epoch checkpoint
chain and its separate checkpoint dispute stage. Claims use independent fixed
gates and one **adequately budgeted** Assert window, with an absence race inside
that budget. Fresh slots can proceed independently.

The cost is Binohash capture/grinding, altered rollup publications, per-slot
absence penalties and setup, and explicit confirmation margins. There is no
supported numerical BTC/day, security-bit, or proof-cost improvement in the local
files. In particular, the local approximately 84-bit Binohash estimate is not
an independently established bridge security level, and this proposal does not
derive a replacement numerical hashrate threshold for Clementine's 45% bound.

## Adversarial checks and implementation boundary

| Attack | Required defense |
| --- | --- |
| Assert without any Capture | Presigned MissingCapture consumes the reimbursement gate. |
| Capture at the last moment | Immediate absence penalty plus the two-phase Delta budget; censoring that penalty violates the explicit inclusion assumption. |
| Consume F through a cheap refund instead of Binohash | No such signed path exists. The sole non-Binohash spend also consumes this exact A:0. |
| Prove a private-fork payout while F is spent on the public chain | The circuit uses the signature from F's actual spend and checks that spend's real ancestry. An independently supplied H does not count. |
| Make a fake burn/header OP_RETURN | Complete admitted state-thread execution and actual prevouts are required. |
| Skip an intervening publication | Sequence, predecessor outpoint, and recursive execution checks fail. |
| Repeat a payment across reserves | Fixed R per slot, burn binding, R/q nullifiers, and Bitcoin single spending. |
| Change Capture txid after setup | Reserve templates never reference it. Follow the actual spend of F; malformed actual spends must remain refutable. |
| Change Assert's body or omit proof chunks | Its txid no longer matches the deposit-time Reimburse/penalty templates. |
| Withhold mandatory proof labels | Cannot broadcast the fixed Assert successfully. Withheld off-chain DA may still prevent an honest operator from proving. |
| Spend the gate directly after timeout | Disables that slot's reserve spend; does not bypass the reserve signature. |
| Reuse F with another gate or issue extra absence signatures | Forbidden by the deposit-time setup verifier; otherwise the presence argument fails. |
| Remove Capture with a deep reorg while retaining Reimburse | Explicit common-prefix/finality boundary; no structural descendant guarantee is claimed. |

Before implementation can establish this protocol's security, it must validate:

- The Binohash absence-branch bytecode, exact signature scopes, pinning/flag and
  actual-transcript fault handling, one-time key rules, script/transaction limits,
  and real grinding retry costs. The source notes \`log2(C(120,8)) = 39.612\` per
  round and warns of exhausted subsets for a fixed transaction.
- The garbling/encoding adapter that combines the actual forced HORS input with
  the mandatory proof input, including sound failure-label extraction for every
  invalid claim. \`CheckGS\` in the graph is a compiled interface, not a new opcode
  or evidence that this compiler has been implemented.
- The complete recursive rollup relation, deposit/reserve registry and admission
  checks, DA policy, and canonical serialization. A drawing does not prove these.
- Full deposit-time signature/template verification, shallow-reorg handling,
  adversarial late-capture scheduling, proof evaluation bounds, and deployable
  fee bumping for both kinds of penalty.

## Graph conventions

The drawing shows one 10 BTC reserve and one operator/slot; repeat the slot
branch for additional deposit-authorized alternatives. Amounts fund illustrative
fees and bonds, not measured security or dust thresholds. Label-only inputs are
external funding. Zero-valued OP_RETURN paths are terminal annotations. Layout
is left to the visualizer.

Keep every committee signature below at **deposit time**. Its later appearance
in a witness means reuse of an already issued signature, never renewed approval.

\`\`\`bridgeflow
color_groups:
  committee: blue
  state_thread: teal
  operator: green
  user: purple
  binohash: pink
  disproof: red
  timeout: orange
\`\`\`

## tx: deposit_request

\`\`\`bridgeflow
label: Deposit request
inputs:
  - label: User funds 10.00020000 BTC
outputs:
  - amount: "10.00010000"
    label: Request and fee allowance
    spending_paths:
      - id: committee_deposit
        label: N-of-N signers
      - id: user_refund
        label: User signature + CSV(200 blocks)
\`\`\`

## tx: deposit_refund

\`\`\`bridgeflow
label: Refund before vault acceptance
inputs:
  - tx: deposit_request
    output: 0
    spending_path: user_refund
    color: timeout
    arrow_label: 200 blocks
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: user
        label: User signature
\`\`\`

## tx: move_to_vault

\`\`\`bridgeflow
label: MoveToVault
inputs:
  - tx: deposit_request
    output: 0
    spending_path: committee_deposit
    sighash_flag: sighash_all
    color: committee
outputs:
  - amount: "10.00000000"
    label: Reserve R; committee keys deleted at deposit
    spending_paths:
      - id: committee_reimburse
        label: Deposit-time N-of-N Reimburse presignature
\`\`\`

The rollup recognizes this reserve under its own deposit-admission rules.
There is no separate mint-receipt output or Capture-ancestry requirement for
MoveToVault.

## tx: user_connector

\`\`\`bridgeflow
label: Unique user payout connector q
inputs:
  - label: User funds 0.00002000 BTC
outputs:
  - amount: "0.00001000"
    label: q; named by the rollup burn
    spending_paths:
      - id: user_payout
        label: User signature
\`\`\`

## tx: burn_batch

\`\`\`bridgeflow
label: Rollup publication with withdrawal and read ticket
note: Rollup proof covers prior state, deposit admission, and the burn
inputs:
  - label: Previous rollup publication state output 0.00001000 BTC
    sighash_flag: sighash_all
  - label: Sequencer fee and read-ticket funding 0.00002000 BTC
outputs:
  - amount: "0.00001000"
    label: Successor state thread; later batches may continue
    spending_paths:
      - id: next_batch
        label: Sequencer signature
  - amount: "0.00001000"
    label: Read ticket for the operator
    spending_paths:
      - id: operator_read
        label: Operator signature
  - amount: "0.00000000"
    label: OP_RETURN roots and batch commitment; burn binds R, q, recipient
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
\`\`\`

Prior publications, deposit admission, and token transfers are verified inside
the rollup proof and omitted from the graph. The burn references q in its
committed payload; it does not spend q on Bitcoin. Only Payout does that.

## tx: payout

\`\`\`bridgeflow
label: Operator pays user
inputs:
  - tx: user_connector
    output: 0
    spending_path: user_payout
    color: user
    sighash_flag: sighash_single|anyonecanpay
    arrow_label: Input 0 fixes user output 0
  - label: Operator liquidity 10.00010000 BTC
    sighash_flag: sighash_all
outputs:
  - amount: "9.99900000"
    label: User payment; matches admitted burn
    spending_paths:
      - id: user
        label: User signature
  - amount: "0.00001000"
    label: Operator payout marker
    spending_paths:
      - id: operator_marker
        label: Operator signature
  - amount: "0.00100000"
    label: Operator change
    spending_paths:
      - id: operator
        label: Operator signature
\`\`\`

## tx: fund_binohash

\`\`\`bridgeflow
label: Fund fresh Binohash instance j
inputs:
  - label: Operator funds 0.01010000 BTC
outputs:
  - amount: "0.01000000"
    label: Binohash slot F with fresh HORS commitments
    spending_paths:
      - id: binohash
        label: Forced HORS signature and Binohash puzzles
      - id: missing_capture
        label: Deposit-time N-of-N MissingCapture presignature
\`\`\`

## tx: read_and_grind

\`\`\`bridgeflow
label: Import burn and payout; mutable grinding ancestor
inputs:
  - tx: burn_batch
    output: 1
    spending_path: operator_read
    color: state_thread
    sighash_flag: sighash_all
  - tx: payout
    output: 1
    spending_path: operator_marker
    color: operator
    sighash_flag: sighash_all
  - label: Operator auxiliary funding 0.00030000 BTC
    sighash_flag: sighash_all
outputs:
  - amount: "0.00010000"
    label: Read output importing both histories
    spending_paths:
      - id: operator
        label: Operator signature
  - amount: "0.00010000"
    label: Auxiliary output
    spending_paths:
      - id: operator
        label: Operator signature
  - amount: "0.00000000"
    label: OP_RETURN ancestor grinding nonce
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
  - amount: "0.00001000"
    label: Carry read ancestry into a fresh prepared claim slot
    spending_paths:
      - id: operator
        label: Operator signature
\`\`\`

Finish grinding before publishing read-and-grind. Changing its nonce changes
its txid without changing the confirmed payout or state-thread history. Produce
ordinary owner signatures after selecting the relevant transaction fields.

## tx: capture

\`\`\`bridgeflow
label: Capture actual ancestry with Binohash
note: Nonstandard mining path; no reserve funds are spent
inputs:
  - tx: read_and_grind
    output: 0
    spending_path: operator
    color: operator
    sighash_flag: sighash_all
    arrow_label: Input 0
  - tx: read_and_grind
    output: 1
    spending_path: operator
    color: operator
    sighash_flag: sighash_all
    arrow_label: Input 1
  - tx: fund_binohash
    output: 0
    spending_path: binohash
    color: binohash
    arrow_label: Input 2; two outputs; forced HORS signature
outputs:
  - amount: "0.01000000"
    label: Example operator bond return; independent of Assert
    spending_paths:
      - id: operator
        label: Operator signature
  - amount: "0.00000000"
    label: OP_RETURN output grinding nonce
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
\`\`\`

Use the primitive's four pinning stages and both extraction rounds. No single
sighash annotation represents its multiple checks. Auxiliary sequences and
other grinding fields must remain within valid consensus/locktime ranges.

## tx: assert_funding

\`\`\`bridgeflow
label: Fixed proof funding prepared at deposit
note: Fixed encoding keys and verifier context; no future Capture txid or H
inputs:
  - label: Operator funds 0.01020000 BTC
outputs:
  - amount: "0.01010000"
    label: Fixed SegWit proof funding P; schematic chunks
    spending_paths:
      - id: forced_proof
        label: |-
          Compiled CheckGS for proof pi_j
          Fresh one-time encoding for this slot
          Circuit takes H from actual spend of F
\`\`\`

The proof input may require several chunks. Every chunk must be fixed and
mandatory in the deposit-time Assert body. This funding does not contain a
future Capture txid or a committee-endorsed future H. The circuit obtains its
Binohash input from the forced signature on the actual spend of F, using the
verified adapter described above.

## tx: assert_tx

\`\`\`bridgeflow
label: Fixed Assert; spends only proof funding P
note: No Capture input; body fixed at deposit; proof is in SegWit witness
inputs:
  - tx: assert_funding
    output: 0
    spending_path: forced_proof
    arrow_label: Mandatory verifier input labels
outputs:
  - amount: "0.00990000"
    label: Operator-funded disputed reimbursement connector
    spending_paths:
      - id: false_label
        label: Anyone with false-output label L*_j
      - id: operator_delay
        label: Operator signature + CSV(Delta)
      - id: missing_capture
        label: Deposit-time N-of-N MissingCapture presignature
  - amount: "0.00010000"
    label: Operator fee anchor
    spending_paths:
      - id: operator
        label: Operator signature
\`\`\`

## tx: missing_capture

\`\`\`bridgeflow
label: MissingCapture; fully presigned at deposit
note: Immediately usable if Assert exists and F is still unspent
inputs:
  - tx: fund_binohash
    output: 0
    spending_path: missing_capture
    color: committee
    sighash_flag: sighash_all
    arrow_label: Conflicts with every Binohash Capture of this slot
  - tx: assert_tx
    output: 0
    spending_path: missing_capture
    color: committee
    sighash_flag: sighash_all
    arrow_label: Consumes the exact reimbursement gate
outputs:
  - amount: "0.01980000"
    label: Operator-funded reward and fee-bumping output
    spending_paths:
      - id: anyone
        label: Anyone
\`\`\`

Both inputs carry complete deposit-time signatures. The transaction has no
additional timeout and requires no operator cooperation. Its fixed output is
anyone-spendable so a broadcaster can attach a fee-paying child; this does not
let anyone take reserve principal. Adequate package inclusion remains assumed.

## tx: disprove

\`\`\`bridgeflow
label: Disprove invalid forced proof
inputs:
  - tx: assert_tx
    output: 0
    spending_path: false_label
    color: disproof
    arrow_label: Confirm before operator timeout spend
outputs:
  - amount: "0.00980000"
    label: Challenger reward from operator funds
    spending_paths:
      - id: challenger
        label: Challenger signature
\`\`\`

Disprove and Reimburse conflict on exactly the same Assert output. Disprove
does not consume, burn, or release R. The reward destination is chosen by the
disprover; no restriction on that destination is needed for reserve safety.

## tx: reimburse

\`\`\`bridgeflow
label: Reimburse; fixed inputs R and Assert only
inputs:
  - tx: move_to_vault
    output: 0
    spending_path: committee_reimburse
    color: committee
    sighash_flag: sighash_all
    arrow_label: N signatures issued at deposit for this fixed Assert
  - tx: assert_tx
    output: 0
    spending_path: operator_delay
    color: timeout
    sighash_flag: sighash_all
    arrow_label: CSV(Delta); gate cannot be omitted
outputs:
  - amount: "10.00970000"
    label: 10 BTC reimbursement plus returned operator collateral less fees
    spending_paths:
      - id: operator
        label: Operator signature
  - amount: "0.00010000"
    label: Operator fee anchor
    spending_paths:
      - id: operator
        label: Operator signature
\`\`\`

<!-- bridgeflow:layout
txs:
  assert_funding:
    x: 120
    y: 1305
  assert_tx:
    x: 1011
    y: 1156
  burn_batch:
    x: 80
    y: 344
  capture:
    x: 2390
    y: 372
  deposit_refund:
    x: 784
    y: -202
  deposit_request:
    x: -146
    y: 29
  disprove:
    x: 2210
    y: 1203
  fund_binohash:
    x: 1084
    y: 837
  missing_capture:
    x: 2115
    y: 886
  move_to_vault:
    x: 365
    y: 96
  payout:
    x: 213
    y: 799
  read_and_grind:
    x: 1161
    y: 421
  reimburse:
    x: 2432
    y: -79
  user_connector:
    x: -304
    y: 905
-->
`;export{e as default};
