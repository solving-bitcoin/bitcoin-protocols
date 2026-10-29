# Binohash bridge with shared timed Bitcoin checkpoints

**Ordinary rollup publications create no operator read outputs.** They finalize
under the rollup's Bitcoin confirmation rule. Separate Bitcoin light-client
certificates, published approximately once per 2016-block difficulty epoch,
provide reusable read receipts for all prepared bridge operators. An operator
can be offline during those epochs and later import certificates made by others.

This is a conditional composition of the BitVM3 paper's timed Bitcoin light
client with Binohash ancestry. It replaces each operator's independently
maintained checkpoint chain with shared, independently published epoch records.
It does not remove periodic maintenance: every required epoch needs a timely
valid certificate, and unused certificate gates must be burned promptly after
their deadlines. A missing global epoch cannot be repaired by backdating it.

All setup and deposit-admission keys may be deleted after authorized deposits;
existing withdrawals use saved transactions and public challenges. Ordinary
operator/user keys remain live for their own actions. No sequencer signature
attests canonical history, and no checkpoint publisher's claimed header is
trusted without verification. This is a research design, not compiled bridge
bytecode or a formally proved adaptation of the source light-client theorem.

## Sources and validation boundary

Research checked 2026-10-29. Bitcoin Knowledge API was queried first for the
relevant BIPs, Binohash and checkpoint constructions; primary papers supplement
those results. The shared-certificate composition and direct body-binding rules
below are deductions, not a construction claimed by either source paper.

| Primary source | Used here |
| --- | --- |
| [BitVM3, section 5 and Appendix D](https://bitvm.org/bitvm3.pdf) | Timestamp-versus-height checkpoint deadlines, variable-difficulty analysis, and the protected endpoint/lookahead requirement. Retrieved 29-page PDF SHA-256 `1f446acde8fdacd5c622ee079b85cc6dd0b7eb98743a4c0593a841a288247cf8`. |
| [Binohash, Appendix C and Appendix D](https://robinlinus.com/binohash.pdf) | Authentication through actual spent ancestry and the polyglot HORS parameterization. Retrieved 33-page PDF SHA-256 `1be2b63034a86db1f9f4a35c7963248d307583723079ff25284a9fc4affee94a`. |
| [BIP 65](https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki), [BIP 113](https://github.com/bitcoin/bips/blob/master/bip-0113.mediawiki) | Locktime type checking and transaction finality against median-time-past. A timelock does not expire the other branch. |
| [BIP 341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki), [BIP 342](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki) | Exact Taproot gate recognition and signature scopes. |
| [BIP 68](https://github.com/bitcoin/bips/blob/master/bip-0068.mediawiki), [BIP 112](https://github.com/bitcoin/bips/blob/master/bip-0112.mediawiki) | Pre-acceptance deposit refund and its sequence-disable distinction. |
| [BIP 141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki), [BIP 143](https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki) | Complete block commitments and the native P2WPKH payout connector. |
| [Bitcoin Core proof-of-work rules](https://github.com/bitcoin/bitcoin/blob/v30.0/src/pow.cpp) | Exact target encoding, retarget clamping/rounding and proof-of-work checks; the paper's abbreviated pseudocode is not a complete consensus implementation. |

The [abstract shared-checkpoint model](binohash-shared-checkpoint-model.py)
checks finite publisher/reader schedules, omitted receipts, malformed records,
wrong locktime modes, delayed descendant commitments, incompatible histories,
cutoff races and endpoint lookahead. Run
`python3 protocols/binohash-shared-checkpoint-model.py`. It assumes header
validity, ancestry and cryptography; it is not a proof of canonicality, a Script
interpreter, a garbling test or a performance benchmark.

The withdrawal gate inherits the explicit compiler and cryptographic boundaries
of [publication cells](binohash-publication-cells-bridge.md) and the
[HORS/Lamport mismatch adapter](primitives/hors-lamport-mismatch.md). No signature
prototype from a different protocol is claimed to implement this bridge.
Compared with the paper light client, the shared access mechanism additionally
assumes Binohash work binding, its nonstandard mining path and the stated
compiler composition; this is not an improvement on every security axis.

## Fixed bootstrap, roles and funded gates

Use N setup signers, K prepared withdrawal operators/readers, P certificate
publishers and E future epochs. A useful deployment chooses the same roster
for P and K, so an awake honest withdrawing operator can also publish its own
future covering certificates. The roles are logically distinct.

The verified bootstrap fixes an admissible Bitcoin header H_0 at a difficulty
boundary h_0, a Bitcoin UTXO-state commitment and rollup state for that point,
network/consensus rules, canonical application codec/VM, the operator receipt
scripts, publisher keys, deadlines, and the finite claim/garbling configuration.
The N signers check the bootstrap against Bitcoin and verify the exit packages.

For every publisher p and epoch i, fund a distinct gate V[p,i] before use. Every
one of these outpoints must be **actually funded and confirmed during bootstrap,
before its deadline**. Merely knowing the txid of an unbroadcast future funding
transaction is insufficient: an attacker could otherwise fund an old gate years
later and immediately spend it before a burner sees it. The manifest fixes
these actual outpoints, amounts and scripts. It cannot be extended retroactively
for existing reserves.

Let h_i = h_0 + 2016*i and choose a block-height deadline
`0 < D_i < 500000000`, allowing the honest boundary to stabilize and the
certificate to confirm. Each gate is NUMS Taproot with no usable key path and
exactly these two leaves:

```text
publication: <P_p> OP_CHECKSIG
cutoff:      <D_i> OP_CHECKLOCKTIMEVERIFY OP_DROP OP_TRUE
```

Only the ordinary publisher key can use the live branch. Anyone can use the
height-locked cutoff branch. These are small metadata/fee coins, not reserves.
No N-of-N signature is needed to publish a certificate or burn an expired gate.
The fixed finite manifest prevents an attacker from creating a new backdated
lane after the relevant deadline.

## Certificate format: actual body and native timestamp binding

A certificate C[p,i] is a direct spend of V[p,i], not a later descendant that
merely names it. It has version 2, gate-input sequence `0xfffffffe`, and:

```text
nLockTime = T_i - 7200
500000000 <= nLockTime <= 0xffffffff
500007200 <= T_i <= 0xffffffff (checked unsigned arithmetic; no wrap)
```

It carries exactly one canonical body record for this protocol:

```text
Checkpoint(domain, i, H_(i-1), H_i, T_i)
```

Use a fixed-width, domain-separated encoding, with one recognized record and
exactly one input from the complete V manifest. Domain binds network, bridge,
manifest and program version. The record is in a transaction-body output;
putting the only commitment in an arbitrary SegWit witness would not suffice.
A concrete implementation must pin the complete codec and intended relay/miner
policy for that body encoding.

For the source paper's 2017-header segment
`w = [B_(h_(i-1)), ..., B_(h_i)]`, **T_i is w[2015].timestamp**, the timestamp
of block h_i-1. H_i is the hash of w[2016], the first block under the next
period's target. It is not the timestamp of that endpoint header. Check both
relationships and every exact retarget input.

The nonfinal gate sequence makes transaction nLockTime effective. Thus Bitcoin
can confirm the certificate only once real-chain median-time-past exceeds
T_i-7200. This is a native transaction-finality check; no Script inspection of
the body record is imagined. The later bridge verifier enforces exact equality
between the record's T_i and the authenticated transaction's nLockTime+7200.

A cutoff spend cannot masquerade as this certificate. Its script requires a
height-mode nLockTime, whereas a qualifying certificate uses timestamp mode.
BIP 65 rejects that type mismatch. A final-sequence transaction, a wrong T_i,
a duplicate record, an unrelated gate or a record added only in a later
transaction is ineligible in the withdrawal relation.

An honest publisher includes one independently spendable P2TR receipt for each
of the K registered readers, controlled by that reader's ordinary key. It signs
the complete body using 64-byte SIGHASH_DEFAULT. Fee inputs and change are
allowed. There is no WOTS, garbled proof or N-party presigning per certificate.

The live script does not force those outputs. This is safe because an omitted
receipt neither certifies a false header nor invalidates another publisher's
independent lane. A reader selects a valid candidate it can actually spend.
For liveness, at least one valid candidate in every required epoch must supply
all honest readers their receipts. An honest publisher stops redundant work
only after validating a compatible candidate and its **complete K-receipt set**;
a raw checkpoint-looking transaction is not sufficient.

## Deadline enforcement and what it assumes

A deadline is not an expiry. A height locktime equal to D_i with a nonfinal
sequence can first confirm at height D_i+1, because finality uses a strict
comparison. At that point, public participants broadcast spends of
all still-unspent V[p,i] gates. They may aggregate burns, provide fees, and retry
after conflicts. If a certificate beats a pending burn, that certificate has
already consumed the gate; it cannot be replaced with a later commitment on
the settled chain. A malformed live spend also permanently consumes its own
lane and does not block other lanes.

Assume a bound B_cutoff covering observation, fees, conflicting inclusion,
confirmation and allowed reorganization. By D_i+1+B_cutoff, every gate for that
epoch is either spent by a certificate/other transaction or irreversibly burned.
This is an explicit bounded race assumption, not a property supplied by CLTV.
Aggregation can lose to a spend of one selected input; each confirmed conflict
removes a gate from the retry set, while unconfirmed churn has no such finite
bound without the inclusion assumption.

Consequently every usable certificate's timestamp is bounded by real consensus
time near D_i+1+B_cutoff, plus the 7200-second allowance. The source paper's
checkpoint-time advantage and difficulty-error bounds must be widened for this
actual race/inclusion margin, including the extra first-eligible block. A
conservative adapted time advantage includes at least the source margin plus
1+B_cutoff; its exact security inequality still needs proof. Do not mix block
counts and seconds without the
source chain-growth/timestamp assumptions. No numerical epsilon or security
probability is established here. The source interior-depth parameter must
remain feasible: choose 0 < m < 2016 satisfying the source adversarial-rate
inequality for the widened time advantage. If that inequality has no such m,
this parameterization does not provide the claimed light-client guarantee.

**All unused lanes need this maintenance even when a good certificate already
exists.** Leaving an old malicious publisher's gate unspent permits a much later
certificate, defeating the timestamp bound and potentially reviving a cheap
private difficulty history. There is no privileged burner key, but some public
participant must act on time.

Publishing a header hash before the cutoff commits to that header and its
previous-hash chain. Deferring verification until withdrawal does not permit a
publisher to substitute a different header history later, under the hash
preimage/collision assumptions. Invalid old commitments remain unusable; there
is no obligation to evaluate a garbled circuit on each certificate when posted.

## Withdrawal relation and conservative protected endpoint

Reader o chooses one usable certificate per epoch from 1 through j, potentially
from different publishers. Its collector spends the reader-owned receipt from
each selected transaction, or a descendant preserving that ancestry. Binohash
then imports these actual certificate bodies and the actual operator payout.
A proof includes all receipt-to-gate paths and every selected record.

The claim verifier checks:

1. Exact bootstrap and manifest, actual direct V[p,i] spend, canonical record,
   active timestamp nLockTime and T_i binding, and authentic collector ancestry.
2. Every complete header segment from H_0 through H_j; exact previous/next hash
   stitching, epoch indices, proof of work, target limits and encoding, retarget
   clamping/rounding, MTP and all applicable deterministic header rules. An
   isolated valid-looking header or recursive proof is not a canonicality proof.
3. The fixed relation's protected-endpoint rule. Its soundness relies on the
   source light-client timing premises, adapted to global candidates and
   B_cutoff. Timely public cutoff is an external execution assumption, not a
   confirmation-height oracle available to the circuit. Appendix D protects an
   interior prefix first, and uses a following
   checkpoint to justify the preceding boundary. Conservatively, certificates
   through j authorize bridge events only through **H_(j-1)**. The last reported
   boundary H_j is not accepted as final by assertion.
4. Complete Bitcoin block data through that protected endpoint, linked to the
   accepted headers and bootstrap UTXO state. Verify transaction lists/counts,
   merkle commitments and witness commitments where used, script/UTXO validity
   and deterministic transaction rules needed by the application. Reject
   ambiguous/mutated representations. The simplest specified relation is full
   Bitcoin state-transition validation from the checked bootstrap; its proving
   cost and compiler are unbenchmarked.
5. All protocol records and application transactions in those blocks, in exact
   `(block height, transaction index, item index)` order. Scan the full committed
   lists; membership proofs for selected publications do not prove completeness.
   Run the fixed rollup VM, including deterministic invalid/no-op/revert rules,
   conservation, nonces, reserve assignment and irreversible burn nullifiers.
6. Authorized actual reserve creation, a successful burn binding R, the native
   P2WPKH connector q, user destination, amount and burn ID, and the actual
   operator payment to that destination. The payout must also be covered by the
   protected endpoint in this conservative relation.

This is a substantial proving task. A succinct proof may compress its output;
it does not remove the data, computation, canonicality or timing requirements.
The adaptation of the paper's induction to independently selected compatible
certificates and a widened cutoff race remains a formal proof obligation.
Selection among P candidates per epoch must be covered by a uniform adversarial
chain/work argument or explicit candidate-count failure accounting. Exact hash
stitching prevents cross-fork splicing; it does not by itself establish that
adaptive candidate selection preserves the original probability bound.

## Ordinary publication, ordering and sequencer failure

Ordinary rollup batches are domain-tagged Bitcoin transactions containing the
complete bounded signed application list, or an explicitly authenticated and
available encoding. They need **zero operator receipt outputs** and do not spend
checkpoint gates. Use the base complete body-data format here; no hash-only
unavailable opening is silently accepted.

Each publication finalizes under the rollup's ordinary Bitcoin confirmation
rule. Checkpoint certificates neither choose its contents nor postpone that
application finality until an epoch boundary. They affect when the Bitcoin
bridge can safely reimburse a withdrawal. Deterministic Bitcoin block order
provides the publication order; sequencer statements do not.

Anyone can publish a valid user request, including a burn. An absent or malicious
sequencer cannot censor an honest publisher with Bitcoin inclusion and fees.
There is no shared sequencer-owned publication head that can be destroyed. A
later bridge proof must execute every tagged record in the covered canonical
blocks, including directly published user requests.

This moves, rather than erases, latency: reimbursement waits for the covering
boundary and its following checkpoint, plus confirmations, proof generation
and the dispute window. It may cross two difficulty epochs depending on when
the burn and payment occur. No fixed-day latency is promised.

## Deposit admission and refund before acceptance

The deposit authority K_deposit is a recognized N-party key pinned in bootstrap,
not a key declared by the depositor's record. It is distinct from the erased
per-reserve custody and absence keys: retaining admission capability for new
deposits must not retain spending authority over accepted reserves.
A Request output uses a recognized
NUMS Taproot tree with exactly:

```text
accept: <K_deposit> OP_CHECKSIG
refund: <d_request> OP_CHECKSEQUENCEVERIFY OP_DROP <user_key> OP_CHECKSIG
```

After validating the complete R/F/P/A exit package, the N parties authorize an
exact MoveToVault with SIGHASH_DEFAULT/ALL semantics. Its Request input has
sequence `0xffffffff`, and it creates reserve R plus an immutable, canonical
record binding recipient, value, deposit ID and setup configuration. The exact
record/script codec must be pinned along with the application VM.
The record also supplies the user's refund key; the public configuration fixes
the positive block-based refund delay d_request with its disable flag unset.
These fields let the verifier reconstruct both Request leaves and the exact
NUMS Taproot output, rather than assuming the hidden alternative leaf.

The canonical block scanner reconstructs the exact Request script, checks its
recognized authority and no-keypath construction, verifies the actual parent
and output values, and requires that final sequence. The BIP 112 disable bit
makes the refund leaf unusable in this transaction. Its actual valid Bitcoin
confirmation therefore implies the admission-authority branch. Merely creating
a reserve-looking output or a forged metadata record cannot mint credit.

Credit this accepted deposit once when the canonical MoveToVault is processed;
no later sequencer-created mint output is required. Enforce uniqueness of R and
the deposit ID, and the signers' policy of one accepted reserve/exit package per
authorized deposit. The setup hash names a nonrecursive public configuration;
it must not demand a circuit or transaction contain its own hash.

Before acceptance, the user can spend Request through its CSV refund path. The
refund's sequence and missing authority branch cannot qualify as MoveToVault,
even if its author copies a deposit-looking record. The two spends conflict on
Request. After accepted credit, there is no unspecified unilateral refund of R;
funds use the proven burn/claim path. A global checkpoint gap can freeze accepted
balances that require that missing epoch.

The admission authority may remain available for new deposits or delete its
key. Deletion stops new admissions; it does not disable existing saved exits.
One honest setup verifier/deleter remains the custody assumption.

## Payout and fixed claim gate

A user makes native P2WPKH connector q and signs an application burn binding its
outpoint, R, destination, amount, nonce and burn ID. Any publisher can include
that request. After confirming valid canonical execution, an operator pays the
user by spending q at input 0 with the user's BIP 143 SINGLE|ANYONECANPAY
signature fixing output 0. The operator signs its own liquidity inputs against
the full body and creates a private payout marker.

For a reserve of denomination u, the admitted burn debits the full u and
consumes that reserve's assignment exactly once. The user explicitly authorizes
a service fee f and receive amount u-f; the connector and proof must enforce
that exact amount. In the graph u is 10 BTC, f is 0.001 BTC and the user receives
9.999 BTC. Burning only 9.999 while releasing a 10 BTC reserve is invalid.
Denominations and fee bounds are part of the fixed application configuration;
no unspecified partial-reserve change mechanism is assumed.

Before fronting funds, the operator checks past global certificate coverage and
retains enough future publisher-gate, deadline, fee and claim capacity to cover
the payout and required lookahead. With P=K it can publish those future
certificates itself. Without that ability it relies on continued global
coverage while its reimbursement is pending. All such horizons are finite.

For each prepared reserve/operator/claim alternative, R is the reserve, F a
fresh Binohash instance and P the mandatory native-SegWit proof/bitmap chunks.
Fixed Assert A spends only P; dynamic proof labels occur in its witness. The
N signers save exact Reimburse spending R+A:0, and exact MissingCapture spending
F+A:0, with ALL signatures. F belongs to one A only. Capture is not an ancestor
of fixed A, and there is no operator-only F cancellation preserving A:0.

The verifier's actual Binohash input is bound using the mandatory 240-bit
HORS/Lamport adapter: two 120-entry pools, eight selected indices per round,
with the bitmap directly selecting the garbled circuit's input labels. Incorrect
cardinality or invalid complete bridge proof releases L_false. Each of 240
fixed A:0 mismatch leaves accepts an actually selected HORS preimage and
Assert's zero-bit label for that same index. These challenges and
MissingCapture spend only operator collateral/gates, never R.

This composition uses the source Appendix D polyglot variant, with 20-byte
preimages and RIPEMD160 commitments. A representative mismatch leaf is:

```text
OP_SIZE <32> OP_EQUALVERIFY
OP_SHA256 <SHA256(L[r,i,0])> OP_EQUALVERIFY
OP_SIZE <20> OP_EQUALVERIFY
OP_RIPEMD160 <RIPEMD160(x[r,i])> OP_EQUAL
```

Use RIPEMD160 consistently; copying HASH160 from the separate-pool variant is
incorrect. The naive absence branch added to a roughly 199-opcode non-polyglot
script exceeds the legacy 201-opcode limit. The proposed polyglot t=8 baseline
has approximately 167 counted operations; estimates of about 171 on the normal
branch and 153+N on a legacy N-of-N absence branch suggest space for N<=20.
These estimates are not interpreter validation. Exact scriptCode/FindAndDelete,
stack behavior, counted/skipped operations, serialization and mining policy
remain compiler obligations.

The adapter proves subset consistency, not the source Binohash work-binding
claim against arbitrary malformed actual spends. Failure to decode a spent F
must never silently disable both absence and disproof paths. Verified garbling,
one-time material discipline, fresh claim slots and that cryptographic binding
remain inherited assumptions.

When A appears, challengers immediately attempt MissingCapture if F is unspent;
if Capture wins, they compare its actual subset to A's claimed bitmap. Garbled
proof evaluation can start eagerly from A's mandatory labels. In consistent
block units with observation/inclusion/reorg margins included, require:

```text
Delta > max(B_GC, B_presence + B_match) + B_disprove
```

A conservative additive budget is also possible. At least one timely public
challenger, available circuits/data, computation and fees are necessary. The
separate B_cutoff assumption applies to historical checkpoint gates as well.
Deep reorganization of Capture/payment independently of fixed Reimburse is
excluded by explicit common-prefix/stability assumptions.

## Result, costs and remaining trust

The liveness quantifier changes from one operator maintaining every epoch of its
own chain to **for every required epoch, some honest publisher supplies a
compatible timely certificate readable by every honest operator**. Publishers
may rotate. A withdrawing operator still needs its own key, data, liquidity,
fees and prepared claims; offline does not mean those resources can disappear.

| Dimension | Result and limit |
| --- | --- |
| Ordinary finalized rollup batch | Zero operator-specific read outputs; full data/VM costs remain. |
| Shared Bitcoin certificate | One gate input and K independent receipts approximately once per 2016-block epoch for a single covering publisher. P2TR output serialization alone is 43*K bytes; this is accounting, not a benchmark. |
| Redundant candidates | If all P publishers publish, cost can reach P*K receipts per epoch. Independence aids liveness but does not make that worst case disappear. |
| Bootstrap | P*E actual prefunded gates, fixed reader/publisher rosters, finite claim packages. No late-funded backdated gates. |
| Public maintenance | Every unused epoch gate must be settled after its deadline within B_cutoff. No private authorizing watcher key, but recurring public activity remains essential. |
| Offline operator | Can collect historical own receipts from other publishers and join them at withdrawal; need not have made its own periodic checkpoint transaction. |
| Missing global epoch | No retrospective repair. Claims crossing the gap cannot proceed. Previously covered burns/payments can still use adequate existing claim capacity. |
| Withdrawal latency | Covering epoch plus lookahead, proof generation, confirmation and dispute bounds. Normal rollup publication finality is independent. |
| Safety | Honest checked setup/deletion, source PoW/common-prefix/timing assumptions, timely public cutoff and claim challengers, Binohash/garbling security. |
| Proof completeness | Full canonical block scanning and VM execution, not selected publication membership. Large unbenchmarked proving/data requirements. |
| End of finite schedule | Reserve future covering/lookahead epochs for final claims. Unexited balances beyond usable coverage have no invented renewal or escape. |

This solves the specific per-rollup-publication operator-output problem while
retaining global epoch checkpoints. It is stronger against an individual
operator going offline than the per-operator checkpoint chain, but does not
claim checkpoint-free security or eliminate all maintenance/finality costs.

## Graph conventions

The graph shows two readers A/B, a certificate by publisher A for boundary i,
a lookahead certificate by publisher B for i+1, and public burning of B's unused
epoch-i lane. The ordinary burn publication has no reader outputs. Its
relationship to the certificate is proved through complete Bitcoin blocks,
not invented as a spending edge. The payout is before the protected boundary i.
Amounts illustrate transaction roles, not measured fee/security parameters.

```bridgeflow
color_groups:
  committee: blue
  state_thread: teal
  operator: green
  user: purple
  binohash: pink
  disproof: red
  timeout: orange
```

## tx: deposit_request

```bridgeflow
label: Deposit Request; recognized admission key or delayed user refund
inputs:
  - label: User funds 10.00020000 BTC
outputs:
  - amount: "10.00010000"
    label: Exact NUMS Request tree
    spending_paths:
      - id: committee_deposit
        label: Recognized N-party admission authority
      - id: user_refund
        label: User signature + CSV(200 blocks)
```

## tx: deposit_refund

```bridgeflow
label: Refund before acceptance
inputs:
  - tx: deposit_request
    output: 0
    spending_path: user_refund
    color: timeout
    arrow_label: Non-disabled relative sequence; 200 blocks
outputs:
  - amount: "10.00000000"
    spending_paths:
      - id: user
        label: User signature
```

## tx: move_to_vault

```bridgeflow
label: Authority accepts reserve; canonical scanner credits once
inputs:
  - tx: deposit_request
    output: 0
    spending_path: committee_deposit
    color: committee
    sighash_flag: sighash_all
    arrow_label: Sequence 0xffffffff excludes CSV refund branch
outputs:
  - amount: "10.00000000"
    label: R; custody shares deleted after verified exit setup
    spending_paths:
      - id: committee_reimburse
        label: Saved N-of-N Reimburse binds R and fixed A gate
  - amount: "0.00000000"
    label: Immutable authorized deposit record and recipient
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
```

## tx: user_connector

```bridgeflow
label: Unique user payout connector q
inputs:
  - label: User funds 0.00002000 BTC
outputs:
  - amount: "0.00001000"
    label: Native P2WPKH q; named by signed rollup burn
    spending_paths:
      - id: user_payout
        label: User signature
```

## tx: publish_batch

```bridgeflow
label: Ordinary finalized rollup batch; zero operator read outputs
note: Complete canonical block scanner verifies this publication and its order
inputs:
  - label: Any publisher funds 0.00010000 BTC
outputs:
  - amount: "0.00000000"
    label: Domain-tagged complete signed application list including burn(R,q)
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
  - amount: "0.00008000"
    label: Publisher change; no bridge reader role
    spending_paths:
      - id: publisher
        label: Publisher signature
```

## tx: fund_checkpoint_gates

```bridgeflow
label: Actual confirmed bootstrap funding for independent epoch gates
note: All finite manifest gates exist before their deadlines
inputs:
  - label: Bootstrap metadata funding 0.00014000 BTC
outputs:
  - amount: "0.00001000"
    label: V[A,i]
    spending_paths:
      - id: publish
        label: Publisher A signature
      - id: cutoff
        label: Anyone after height CLTV(D_i)
  - amount: "0.00001000"
    label: V[B,i]
    spending_paths:
      - id: publish
        label: Publisher B signature
      - id: cutoff
        label: Anyone after height CLTV(D_i)
  - amount: "0.00001000"
    label: V[A,i+1]
    spending_paths:
      - id: publish
        label: Publisher A signature
      - id: cutoff
        label: Anyone after height CLTV(D_(i+1))
  - amount: "0.00001000"
    label: V[B,i+1]
    spending_paths:
      - id: publish
        label: Publisher B signature
      - id: cutoff
        label: Anyone after height CLTV(D_(i+1))
```

## tx: checkpoint_i

```bridgeflow
label: Shared certificate i; publisher A
note: Timestamp nLockTime=T_i-7200; exact gate sequence 0xfffffffe
inputs:
  - tx: fund_checkpoint_gates
    output: 0
    spending_path: publish
    color: operator
    sighash_flag: sighash_all
    arrow_label: Live publisher DEFAULT signature; direct gate spender
  - label: Publisher metadata and fee funding 0.00010000 BTC
outputs:
  - amount: "0.00000000"
    label: One body record (domain,i,Hprev,H_i,T_i)
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
  - amount: "0.00001000"
    label: Reader A certificate receipt
    spending_paths:
      - id: reader
        label: Reader A signature
  - amount: "0.00001000"
    label: Reader B certificate receipt
    spending_paths:
      - id: reader
        label: Reader B signature
```

## tx: checkpoint_lookahead

```bridgeflow
label: Shared certificate i+1; publisher B supplies lookahead
note: Timestamp nLockTime=T_(i+1)-7200; headers must link to H_i
inputs:
  - tx: fund_checkpoint_gates
    output: 3
    spending_path: publish
    color: operator
    sighash_flag: sighash_all
    arrow_label: Publisher B direct gate spend; sequence 0xfffffffe
  - label: Publisher metadata and fee funding 0.00010000 BTC
outputs:
  - amount: "0.00000000"
    label: One body record (domain,i+1,H_i,H_(i+1),T_(i+1))
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
  - amount: "0.00001000"
    label: Reader A lookahead receipt
    spending_paths:
      - id: reader
        label: Reader A signature
  - amount: "0.00001000"
    label: Reader B lookahead receipt
    spending_paths:
      - id: reader
        label: Reader B signature
```

## tx: burn_unused_lane

```bridgeflow
label: Public cutoff of unused gates; never an eligible certificate
note: Height-mode locktime; timely inclusion and retries required
inputs:
  - tx: fund_checkpoint_gates
    output: 1
    spending_path: cutoff
    color: timeout
    arrow_label: Burn epoch i lane by its own D_i+1+B_cutoff bound
  - label: Public burner fee contribution
outputs:
  - amount: "0.00000000"
    label: Gate irreversibly consumed; no reserve principal
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
```

The unused A lane for epoch i+1 also needs its own timely public cutoff; it is
not left available merely because B supplied that epoch's good certificate.
Separate deadlines must each be respected when aggregating burns.

## tx: collect_certificates

```bridgeflow
label: Offline reader A joins shared historical certificates
inputs:
  - tx: checkpoint_i
    output: 1
    spending_path: reader
    color: operator
    sighash_flag: sighash_all
    arrow_label: Actual certificate body for epoch i
  - tx: checkpoint_lookahead
    output: 1
    spending_path: reader
    color: operator
    sighash_flag: sighash_all
    arrow_label: Actual next epoch; protects preceding boundary
  - label: Reader A collection fee funding 0.00010000 BTC
outputs:
  - amount: "0.00001000"
    label: Certificate accumulator; all earlier required epochs also mandatory
    spending_paths:
      - id: reader
        label: Reader A signature
```

For a full claim every epoch since bootstrap is represented. A collector tree
may join a long history; an unauthenticated summary hash cannot replace those
actual paths. Different publishers' selected headers must stitch exactly.

## tx: payout

```bridgeflow
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
```

## tx: fund_binohash

```bridgeflow
label: Fund fresh Binohash instance j
inputs:
  - label: Operator funds 0.01010000 BTC
outputs:
  - amount: "0.01000000"
    label: F; fresh polyglot RIPEMD160 HORS commitments
    spending_paths:
      - id: binohash
        label: Polyglot Binohash and selected 20-byte secrets
      - id: missing_capture
        label: Deposit-time N-of-N MissingCapture presignature
```

## tx: read_and_grind

```bridgeflow
label: Import shared certificates and actual payout; grind
inputs:
  - tx: collect_certificates
    output: 0
    spending_path: reader
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
    label: Read output importing actual certificate bodies and payout
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
```

Finish grinding before publishing read-and-grind. Changing its nonce changes
its txid without changing the confirmed payout or certificate history. Produce
ordinary owner signatures after selecting the relevant transaction fields.

## tx: capture

```bridgeflow
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
```

Use the primitive's four pinning stages and both extraction rounds. No single
sighash annotation represents its multiple checks. Auxiliary sequences and
other grinding fields must remain within valid consensus/locktime ranges.

## tx: assert_funding

```bridgeflow
label: Fixed proof funding prepared at deposit
note: Fixed bitmap and proof keys; manifest and R context; no Capture txid
inputs:
  - label: Operator funds 0.01020000 BTC
outputs:
  - amount: "0.01010000"
    label: P; mandatory 240 bitmap labels and proof chunks
    spending_paths:
      - id: forced_proof
        label: |-
          Compiled CheckGS for bitmap b and proof pi_j
          All one-time chunks mandatory in fixed Assert
          Bitmap selects circuit input labels directly
```

The bitmap and proof may require several chunks. Every chunk is fixed and
mandatory in the deposit-time Assert body. Future labels occur only in witness.
The circuit verifies the claimed bitmap/proof; public mismatch leaves bind the
bitmap to the actual Capture selections, under the stated Binohash assumptions.

## tx: assert_tx

```bridgeflow
label: Fixed Assert; spends only proof funding P
note: No Capture input; body fixed at deposit; proof is in SegWit witness
inputs:
  - tx: assert_funding
    output: 0
    spending_path: forced_proof
    arrow_label: Mandatory 240 bitmap labels and verifier proof labels
outputs:
  - amount: "0.00990000"
    label: Operator-funded disputed reimbursement connector
    spending_paths:
      - id: false_label
        label: Anyone with verifier false-output label L_false
      - id: subset_mismatch
        label: Actual polyglot secret x[r,i] plus zero-bit label L[r,i,0]
      - id: operator_delay
        label: Operator signature + CSV(Delta)
      - id: missing_capture
        label: Deposit-time N-of-N MissingCapture presignature
  - amount: "0.00010000"
    label: Operator fee anchor
    spending_paths:
      - id: operator
        label: Operator signature
```

## tx: missing_capture

```bridgeflow
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
```

Both inputs carry complete deposit-time signatures. The transaction has no
additional timeout and requires no operator cooperation. Its fixed output is
anyone-spendable so a broadcaster can attach a fee-paying child; this does not
let anyone take reserve principal. Adequate package inclusion remains assumed.

## tx: disprove_mismatch

```bridgeflow
label: Public actual-subset mismatch
inputs:
  - tx: assert_tx
    output: 0
    spending_path: subset_mismatch
    color: disproof
    arrow_label: RIPEMD160 secret selected in Capture; Assert bit is zero
outputs:
  - amount: "0.00980000"
    label: Challenger reward; reserve principal untouched
    spending_paths:
      - id: challenger
        label: Challenger signature
```

One of 240 fixed leaves is shown. It consumes the same gate required by
Reimburse. Matching honest disclosures do not supply this witness.

## tx: disprove

```bridgeflow
label: Disprove invalid forced bitmap or proof
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
```

Disprove and Reimburse conflict on exactly the same Assert output. Disprove
does not consume, burn, or release R. The reward destination is chosen by the
disprover; no restriction on that destination is needed for reserve safety.

## tx: reimburse

```bridgeflow
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
```
