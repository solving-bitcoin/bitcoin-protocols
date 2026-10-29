# Binohash bridge with independent publication cells

**A malicious publisher can waste its own batch slot, but cannot destroy every
future publication path or block every later honest publisher.**
Each prepared slot has an independent Bitcoin ticket for every bridge operator.
A complete publication must spend all those tickets together. A withdrawing
operator can close its own unused ticket after a deadline and prove that the
missing publication can never subsequently become valid. Replay this complete,
ordered sequence of publications and proved no-ops to obtain rollup state.

This is a new conditional protocol construction. It preserves batched account
rollup execution, removes per-operator periodic Bitcoin checkpoints, gives every
prepared operator enforced publication access, and allows a new burn through an
honest prepared publisher after the sequencer disappears. All N setup-signing
keys can be deleted after the authorized deposits and publication schedule are
prepared. It retains Binohash's cryptographic/mining assumptions, verified
BitVM3 garbling, finite preparation, and a timely permissionless challenger.
It is not implemented bridge bytecode or a claim of unconditional liveness.

## Sources, deductions, and validation scope

Research checked 2026-10-29. Bitcoin Knowledge API searches supplied primary
sources; a search for the complete publication-cell/no-op construction returned
no matching construction. The publication cells, complete-prefix theorem,
mint integration, and their bridge composition below are new deductions.

| Primary source | Mechanism used |
| --- | --- |
| [BIP 341](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki) and [BIP 342](https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki) | Taproot signature scopes, leaf binding, fixed corresponding outputs under SINGLE\|ANYONECANPAY, and ordinary script checks. |
| [BIP 65](https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki), [BIP 68](https://github.com/bitcoin/bips/blob/master/bip-0068.mediawiki), and [BIP 112](https://github.com/bitcoin/bips/blob/master/bip-0112.mediawiki) | Absolute closure thresholds and the separate pre-mint refund delay. A timelock is not an expiry. |
| [BIP 141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki) and [BIP 143](https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki) | Txid/witness distinction, optional P2WSH data commitments, and the SegWit-v0 paired payout signature. |
| [BIP 327](https://github.com/bitcoin/bips/blob/master/bip-0327.mediawiki) | A secure MuSig2 implementation can aggregate N-of-N template signing; nonce and key-aggregation rules remain required. |
| [LND required-output/locktime support](https://github.com/lightningnetwork/lnd/pull/4750) | Concrete existing use of presigned SINGLE\|ANYONECANPAY input/output pairs with fixed locktimes; not this rollup construction. |
| [Binohash](https://robinlinus.com/binohash.pdf), sections 6.4–7 and Appendices C–D | Forced subset revelations, ancestry interface, and the polyglot parameterization discussed below. Retrieved 33-page PDF SHA-256 `1be2b63034a86db1f9f4a35c7963248d307583723079ff25284a9fc4affee94a`. |
| [BitVM3](https://bitvm.org/bitvm3.pdf), sections 3–4 | Garbled verification and mandatory signature-derived inputs. Retrieved 29-page PDF SHA-256 `1f446acde8fdacd5c622ee079b85cc6dd0b7eb98743a4c0593a841a288247cf8`. |

The local [Binohash ancestry bridge](binohash-ancestry-bridge.md) supplies the
fixed reserve/Assert gate and absence-penalty pattern. The
[HORS/Lamport mismatch adapter](primitives/hors-lamport-mismatch.md) supplies
an explicit optimistic subset-binding rule; the polyglot variant below changes
its HORS commitment hash consistently to RIPEMD160.

The executable [publication-cell model](binohash-publication-cells-model.py)
checks 139,338 bounded ledger cases with two readers/three slots or three
readers/two slots, including spend partitions, slot classifications, receiver
agreement, positive closure, paired outputs, and omitted-prefix attacks. Run
`python3 protocols/binohash-publication-cells-model.py` from the repository root.
It is a finite abstract model, not a Bitcoin Script interpreter, VM implementation,
cryptographic proof, or scalability benchmark.

A separate research prototype (`/tmp/publication_cell_final.py`, results
`/tmp/publication-cell-final-results.json`) passed 121 BIP 340/BIP 341
cryptographic signature and mutation checks, including official vectors and
reference comparisons. It used the final live sequence `0xffffffff`, locktime 0,
and fresh reader-key closures. It did not execute full Bitcoin Script, regtest,
DKG/MuSig setup, the application VM, the exact pre-mint refund, or an end-to-end
Binohash bridge. Those temporary research artifacts are not claimed as a
permanent repository test suite.

## Setup registry and key roles

Use N setup signers and K prepared bridge operators/readers. Slot s has one
scheduled publisher P_s, assigned cyclically among those operators, and a
strictly increasing block-height deadline `0 < D_s < 500000000`. Prepare S finite slots,
numbered 0 through S-1. Each slot has K **distinct fixed** ticket outpoints
U[s,o], one for every reader o. The manifest fixes their amounts, scripts,
publisher keys, reader keys, deadlines, network, rollup program, and slot order.
The manifest hash is pinned in the bridge/rollup verifier; no live registry
replacement is assumed for old reserves.

Every U[s,o] has a NUMS Taproot internal key with no usable key-path bypass and
exactly two recognized leaves. The committee template key K[s,o] is an N-of-N
aggregate key deleted after presigning. P_s and the reader's O_o are separate
operating roles; deleting setup keys does not mean deleting all users' and
operators' ordinary spending keys. Future deposits require their own allowed
N-of-N setup, but an existing withdrawal never requires a fresh setup signature.

The first model funds the fixed ticket set before use. A lazy presigned funding
tree might reduce contemporaneous UTXOs, but its complete authorization and fee
rules are not supplied here and its savings are not included in the claim.

## Publication leaf: force access without asking every reader

The live leaf is:

```text
OP_SIZE <64> OP_EQUALVERIFY
<P_s> OP_CHECKSIGVERIFY
<K[s,o]> OP_CHECKSIG
```

The witness puts the saved committee signature below the publisher signature.
The top signature must be exactly 64 bytes, making it Taproot
SIGHASH_DEFAULT (ALL semantics). The publisher signs the complete assembled transaction.
No reader signature is requested for publication.

At setup, K[s,o] signs one 65-byte `0x83` SINGLE|ANYONECANPAY template with:

| Field | Fixed value |
| --- | --- |
| Version and locktime | `nVersion=2`, `nLockTime=0`, for every live slot. |
| This input | Exact U[s,o], amount, scriptPubKey, and `nSequence=0xffffffff`. |
| Corresponding output | Exact receipt value and script C_o controlled by reader o. |
| Script context | This publication leaf, key version 0, no code separator and no annex. |

The saved signature permits adding other inputs and outputs, including other
slot tickets, fee sponsors, mint capabilities and a dynamic batch. Its output
commitment is a real Bitcoin signature check, not a rollup promise that a
publisher will later create the receipt. The publisher's final DEFAULT
signature binds all those assembled fields.

SINGLE|ANYONECANPAY permits moving an input/output pair to another index. The
application therefore identifies each U by its exact outpoint and checks its
required output at that input's **actual** index. Identical receipt scripts or
values in different slots do not make their ticket identities interchangeable.
Every distinct ticket input has its own corresponding output position.

There is no earliest-publication rule. A publisher may fill its own future
slots early; the application interprets them only after the preceding prefix
is resolved. Other actors cannot spend an honest publisher's live tickets.
Its deadline enables a separate closure path; it does not invalidate a late
publication. This avoids a hidden dependency on Bitcoin inclusion timestamps.

## Reader closure: positive evidence of an empty slot

The other leaf is:

```text
<D_s> OP_CHECKLOCKTIMEVERIFY OP_DROP
<O_o> OP_CHECKSIG
```

After maturity, reader o can close its own still-unspent tickets without any
setup or publisher signature. It can aggregate many overdue tickets in one
transaction with `nLockTime=max(D_s)` and nonfinal input sequences `0xfffffffe`, paying its
own fees and creating a reader-controlled accumulator output. Bitcoin normally
requires the inclusion height to exceed this block-height nLockTime; D_s is
not an inclusive upper bound on publication.

Aggregation is an optimization, not a constant-time catch-up guarantee. A late
publication can consume one selected ticket and invalidate an entire pending
closure aggregate. Retry without that spent ticket and import its forced
receipt, or shard/parallelize closures so one conflict does not invalidate
unrelated inputs. Among g selected tickets, at most g distinct confirmed
conflicting spends can cause such losses, and each supplies another piece of
evidence. Unconfirmed replacement churn has no such bound. Fees, confirmed
race resolution and retries must fit the honest operator's remaining schedule.

The forced-receipt theorem applies to the **publication** branch. An honest
reader voluntarily preserves its ancestry on closure. A malicious reader may
destroy its own closure output, but cannot destroy another reader's distinct
ticket or force that reader to use the malicious output. This is why direct
reader closure permits aggregation without another committee presignature.

Closing even one ticket conflicts with every complete publication of that
slot. If a complete publication wins first, its saved signatures guarantee
each reader a receipt. Never infer a no-op from elapsed time or an unspentness
observation: the proof needs an actual authenticated ticket spend. Reorg and
confirmation margins apply to both possible outcomes.

## Total admission rule and complete ordered execution

Let RegisteredInputs(T) include **every** input matching any ticket in this
bridge's fixed manifest. A transaction is a publication candidate for slot s
only if all the following hold:

1. RegisteredInputs(T) is exactly `{U[s,0], ..., U[s,K-1]}`, each once, with
   no registered ticket from any other slot. Fee, data and mint inputs are
   allowed only as additional non-ticket inputs.
2. Version is 2, locktime is zero, every ticket sequence is `0xffffffff`, and
   each ticket has its exact required receipt at its actual paired output index.
3. There is exactly one canonical, domain-separated descriptor naming this
   network, bridge, program version and s, followed by a bounded self-contained
   signed user-transaction list. Duplicate/mixed descriptors, unknown versions,
   ambiguous encodings and oversize payloads are malformed.
4. Every mint input/record obeys the exact admission rules below. Arbitrary
   unmatched mint-looking outputs do not create credit.

Every other authenticated spend is a **no-op for the affected slot**. This
includes partial publications, malformed full publications, direct closures,
and transactions mixing tickets from different slots. Parsing is total:
malformed bytes are a defined no-op, not a reason that the proof must stop.
Mode is determined from authenticated transaction-body fields; the proof does
not need to inspect an unauthenticated SegWit witness to distinguish the two
Taproot branches. Since all D_s are positive, a closure cannot have locktime 0.

For a valid candidate, execute its transaction list in byte order against the
state derived from slots 0 through s-1. Apply explicit deterministic VM rules
for invalid signatures, nonces, insufficient balances and execution reverts.
A publisher-supplied state root does not override this execution. A concrete
VM, canonical codec, gas/resource limits and proof program must be pinned in
the setup manifest; the graph does not choose a specific EVM or zkVM compiler.

```text
state[s+1] = Execute(state[s], Classify(actual_ticket_spend[s]))
```

Execute and Classify are total functions. Ordinary account transfers, contract
calls and many withdrawals can be batched in one publication. Their order is
slot order followed by list order, not sequencer-provided sorting instructions
or the order of unrelated Bitcoin transactions. This is a deliberately new
rollup admission rule, not a silent reinterpretation of an existing rollup's
block-scanning consensus.

For every slot through the claimed burn, reader o must import an actual spend
of its own U[s,o], or a descendant retaining that spend's ancestry. For an
unspent expired ticket it first creates a real closure. An ordinary collector
transaction joins these receipts; a collector tree can handle larger prefixes.
Binohash then authenticates the collector through actual prevouts.

**Agreement argument.** If a full candidate exists, it consumes all K tickets
in one transaction, so every reader's actual ticket spend identifies the same
candidate. If any ticket has a partial spend, no full candidate can coexist on
that Bitcoin chain; the remaining readers either have partial spends too or
can close their untouched tickets. Different garbage transactions consequently
produce the same no-op. An omitted previous slot is never accepted as empty.
This proves the needed log completeness without a canonical-header oracle or
a proof that arbitrary unrelated Bitcoin publications do not exist.

## Deposit minting binds actual backing and setup authorization

MoveToVault co-creates reserve R and a small mint capability m. Its prospective
txid is stable before the deposit signatures are issued. The recognized mint
key K_mint is controlled by the N-of-N deposit authority pinned in bootstrap.
It signs only after checking R's amount, custody/exit setup and configuration.
This is explicitly allowed deposit-time trust, not a replacement withdrawal
watchtower. Merely creating a reserve-looking Bitcoin output does not authorize
minting.

m uses a NUMS, single-leaf Taproot output with the exact script:

```text
OP_SIZE <64> OP_EQUALVERIFY
<user_mint_key> OP_CHECKSIGVERIFY
<K_mint> OP_CHECKSIG
```

At deposit time K_mint supplies a saved `0x83` SINGLE|ANYONECANPAY signature
committing to version 2, locktime 0, m's exact outpoint/value/script, sequence
`0xffffffff`, and the corresponding zero-value output:

```text
OP_RETURN CanonicalMint(network, bridge, R, amount, recipient,
                        user_mint_key, deposit_id, setup_config_hash)
```

Use a pinned domain-separated canonical encoding with fixed integer widths and
unambiguous length-prefixed byte strings. The signed m outpoint commits to its
MoveToVault body and sibling R; the signed output fixes the credit and setup
configuration. The same saved authorization fits any future live slot because
all live templates have locktime 0. It cannot authorize a different m.

The setup configuration hash names the nonrecursive public protocol manifest
and verification program. It must not require a circuit, funding output, or
transaction to contain a hash of itself. The deposit authority separately
checks the completed per-deposit exit package before releasing the capability;
no self-referential commitment is needed to authenticate that authorization.

The user supplies its 64-byte DEFAULT (ALL semantics) signature **only on a completed
canonical full-slot publication**, after validating the stable complete prior
prefix and the whole batch's inputs, outputs, descriptor, mint records and
available payload, or checking an authenticated proof of those conditions.
A publisher's claimed root alone is insufficient. A malicious publisher may separately
poison one of that slot's cells, making the transaction unusable; m then remains
unspent and can be retried. It cannot change the user-signed body into a partial
or malformed spend of m. A blanket user SINGLE|ANYONECANPAY signature would
lose this protection and is not the mint authorization described here.

Application admission scans **all** outputs with the reserved Mint record magic,
never a publisher-declared subset. Each record supplies user_mint_key, resolves
its input at the same actual index, authenticates that input's parent output and
MoveToVault/R ancestry, and reconstructs the exact NUMS single-leaf m tree from
that public key and K_mint. It checks a one-to-one pairing with the immutable
records. It does not pretend to invert arbitrary Taproot outputs into scripts.
Every legitimately authorized live m spend must create its visible immutable
record under the saved `0x83` signature; the sole other K_mint authorization is
the exact ALL refund, which cannot include cell inputs. Thus no real live m can
hide outside this exhaustive record scan under the deposit signing policy.
K_mint's outpoint-bound signature authenticates setup approval; an attacker
copying the public script lacks a signature for its fake outpoint. Extra
attacker leaves or a usable key path fail exact script recognition. The program credits the fresh authorized deposit independently of
account transaction nonces, then executes the user list. R/deposit ID/m are
registered once, amounts are conserved, and any duplicate or unmatched mint
record makes the candidate malformed. Competing earlier slots cannot have
already consumed the same m in this canonical Bitcoin history.

For every admitted mint the committee's authorization policy must name one
unique m for R; it must not sign a second issuance capability for the same
reserve. The state also rejects already-registered R/deposit IDs. This combines
explicit deposit-time honesty with Bitcoin single-spend exclusion, rather
than pretending Script recognizes a correct garbling package on its own.

### Pre-mint refund

At deposit setup, also sign the exact Refund spending **both R and m** after
a relative delay fixed on R's input. Save the reserve's SIGHASH_ALL signature
and a separate K_mint SIGHASH_ALL signature for that exact body and fixed user
refund output. The user adds its required DEFAULT signature on m. There is no
user-only m bypass. K_mint's signing policy authorizes only the live mint pair
and this exact refund for m.

Refund cannot append slot inputs or change its destination because its ALL
signatures bind the complete transaction. It is not an admitted publication.
After a mint consumes m, Refund is impossible. If Refund wins first, no valid
mint can subsequently spend m. Its output is controlled by the user and can
fund CPFP; confirmation/fee availability remains assumed. This lets an unminted
depositor recover after publisher failure or schedule exhaustion. A minted
balance cannot use this refund and still needs an admitted burn and claim.

No Bitcoin header-chain verifier is introduced for deposits: a valid mint's
actual transaction ancestry includes the confirmed reserve funding, while the
recognized mint signature supplies deposit setup authorization. If mint-authority
keys are later deleted, new deposits stop; existing mint authorizations and
withdrawals remain usable.

## New burns, payment and bridge verification

A user creates a native P2WPKH Bitcoin payout connector q and signs a rollup burn
request binding `(R, q, recipient_script, payout_amount, account_nonce, burn_id)`.
Any honest scheduled publisher can include it in its own remaining slot. The
canonical VM checks balances, authorization, reserve assignment and one-use
burn/reserve nullifiers. Burned funds cannot be restored by a later valid slot.
Use a request-derived burn ID; no body needs to contain its own future txid.

After confirming that the burn executes in the complete closed prefix, a
prepared liquid operator pays the user by spending q. The user's BIP 143 payout
SINGLE|ANYONECANPAY signature at input 0 fixes the exact recipient script and
amount at output 0;
the operator signs its liquidity inputs against the full payout and creates
an operator-owned marker. Unlike the earlier receipt design, publication cells
already guarantee operator access, so q need not be created by a publisher.

ReadAndGrind consumes the operator's complete-prefix collector and the actual
payout marker. It creates two auxiliary outputs plus a carry output; Capture
uses auxiliaries at inputs 0/1, F at input 2, and exactly two outputs. The proof
checks the fixed manifest, all preceding slot classifications/execution,
actual reserve admission, irreversible burn, exact R/q/payment/operator binding,
and actual prevout ancestry. It never accepts a bare txid reference as evidence
of publication. An old prefix containing a valid irreversible burn is enough;
no periodic checkpoint or newest-tip proof is required.

## Reserve gate and mandatory public mismatch adapter

For every reserve/operator/claim slot, prepare fixed outpoints R, F and P and a
fixed Assert A at deposit time. R is the reserve; F funds a fresh Binohash
instance; P comprises every mandatory native-SegWit proof/bitmap encoding chunk.
A spends only P and puts dynamic labels in its witness. Its body is fixed before
signing Reimburse. Capture and its mutable legacy txid are never ancestors of A.

| Saved transaction | Exact inputs and commitment |
| --- | --- |
| Reimburse | R and A:0, fixed operator output; reserve signature SIGHASH_ALL. |
| MissingCapture | F and that same A:0, fully signed on both inputs with SIGHASH_ALL. |
| Pre-mint Refund | R and m, exact user refund body; separate reserve and mint-authority ALL signatures. |

R's custody shares and F/A absence shares are deleted after the complete
approved set is verified. F belongs to one A only. There is no operator-only
cancellation of F leaving A:0 intact. Neither MissingCapture nor either
challenge spends reserve principal. Disproof can destroy only the operator's
gate/collateral; the operator's knowledge of false labels does not grant a
principal spend.

Assert must reveal the actual circuit's 240 Lamport input labels for a bitmap
b[r,i], two rounds of 120 entries, plus its mandatory proof encoding. Exactly
eight distinct entries are selected in each round. The circuit checks cardinality,
canonical Binohash candidate transcript and extraction flags, and the complete
bridge statement. Invalid evaluation releases L_false.

For every fixed `(r,i)`, A:0 additionally has a mismatch leaf accepting the
actual revealed HORS preimage x[r,i] together with Assert's zero-bit label
L[r,i,0]. For the polyglot parameterization selected below, use:

```text
OP_SIZE <32> OP_EQUALVERIFY
OP_SHA256 <SHA256(L[r,i,0])> OP_EQUALVERIFY
OP_SIZE <20> OP_EQUALVERIFY
OP_RIPEMD160 <RIPEMD160(x[r,i])> OP_EQUAL
```

The bottom witness item is x and the top is L. An honest equal bitmap never
reveals both values of any mismatch leaf. If two size-eight subsets differ,
there is an actually selected index marked zero, so any observer gets a public
mismatch witness. Incorrect cardinality fails the garbled verifier. These 240
leaves are fixed **before** A's txid and its saved transactions are authorized;
there is no late gate modification or independently signed bitmap substitute.
No claimant-provided arbitrary HORS signature establishes actual-spend binding.

### Binohash parameterization and real compiler boundary

This composition uses the paper's Appendix D polyglot variant with two
120-entry pools and eight selections per round. Its 20-byte secrets map through
RIPEMD160 to the embedded DER signature/commitment values. Therefore the above
mismatch leaves use RIPEMD160 consistently; copying the separate-pool adapter's
HASH160 leaves would be wrong. Fresh pools, secrets and labels are per claim
slot. Polyglot grinding must keep the secrets private.

A naive IF/ELSE absence branch added to the local approximately 199-opcode
non-polyglot script would exceed the 201-opcode legacy limit. Source-level
counting for the polyglot t=8 variant gives approximately 167 baseline opcodes,
leaving room for the proposed branch; a nonaggregated legacy N-of-N
CHECKMULTISIG absence branch is restricted to N<=20. Estimates of roughly 171
normal-path and 153+N absence-path counted operations do **not** establish
bytecode correctness. Exact serialization, executed/skipped-branch counting,
stack behavior, legacy scriptCode/FindAndDelete semantics and consensus limits
still require interpreter validation. This is an identified compiler boundary,
not an invented opcode or a claimed tested implementation.

Bitmap equality proves subset consistency. It does not itself prove Binohash's
work-binding claim against adversarial flags/transcripts. The application still
assumes the source construction binds the relevant actual transaction fields
to a canonical candidate, or provides a complete public refutation for every
malformed actual spend. Failure to decode a spent F must not silently disable
both MissingCapture and all disproofs. This inherited cryptographic obligation
is explicit; the publication-cell theorem does not solve it by assertion.

## Timing and permissionless challenging

An honest operator confirms Capture before asserting. Challengers handle the
reverse order: when A appears, immediately inspect F and broadcast the saved
MissingCapture if it is unspent. If Capture wins that race, extract its actual
selected preimages and compare against A's mandatory bitmap. Independently,
evaluate the garbled verifier from A's already-public bitmap/proof labels.

Let B_presence bound observation, inclusion and stability of that race; B_match
bound transcript retrieval/subset comparison; B_GC bound eager proof evaluation;
and B_disprove bound disproof inclusion and stability. With consistent block
units and reorg/observation margins included, the composed budget is:

```text
Delta > max(B_GC, B_presence + B_match) + B_disprove
```

Eager evaluation is possible because the claimed bitmap and proof are already
forced into A's witness; only comparison to actual Capture waits for F. A
conservative implementation may reserve the larger additive budget instead.
This is a conditional bounded-inclusion argument, not a measured deadline or a
Bitcoin guarantee. Unbounded censorship or fee starvation invalidates it.

Capture/payout are not ancestors of Reimburse. Deep reorganization could remove
their branch while leaving the fixed reimbursement branch. Require explicit
Bitcoin common-prefix/confirmation assumptions and consistent application
rollback. Fresh-slot rules also forbid reusing one-time material after
incompatible disclosures or reorgs. At least one challenger must obtain the
public circuits, labels/transcripts, compute and timely inclusion. No committee
or watchtower private key is needed for either public challenge.

## Liveness, finite resources, and comparison

One honest prepared operator can close missing previous tickets after their
deadlines, reconstruct the canonical prefix, and publish a valid user request
in a remaining slot assigned to it. Malicious publishers cannot consume that
slot before its closure threshold because they lack P_s. Allocate enough slack
between relevant deadlines for catch-up closures, confirmation, computation,
user signing and publication inclusion. A slot assignment by itself does not
prove those timing bounds, and no one-slot or fixed-day latency is claimed.

The user must have sufficient canonical balance and not have authorized
conflicting nonce spends. Malicious parties can still choose their own valid
transaction order and front-run voluntarily signed swaps; they cannot forge a
user debit. The operator pays only after the complete closed prefix establishes
a valid irreversible burn and a usable prepared reimbursement slot.

An operator may be offline for many earlier slots and close its backlog later;
there is no mandatory per-epoch maintenance transaction. It must retain its
operating key, data, funding, and some usable future publication/claim capacity.
Grouping publisher lanes under common deadlines is an optional scheduling
tradeoff; it is not needed for the strictly increasing-deadline argument above.

| Dimension | Result and remaining cost |
| --- | --- |
| N-of-N keys after acceptance | Reserve/absence/cell template keys deleted; saved mint/refund permissions remain. No later N-of-N signing or watchtower key. |
| Sequencer failure | Invalid/partial slots become no-ops; independent later slots survive. One honest prepared publisher can admit a new burn within remaining capacity and timing assumptions. |
| Publication access | Every live ticket spend forces its reader receipt. Honest readers close their own unused tickets after deadline. |
| Ordering/completeness | Fixed slot order with positive evidence for every slot in the claimed prefix, followed by deterministic VM execution. |
| Bitcoin light client | No per-epoch difficulty checkpoint or competing private-header proof for deposits/publications/payouts; actual ancestry plus deposit authorization supplies the required statements. |
| Rollup throughput | Many account transactions per publication; no per-transfer Bitcoin certificate update. Full payload/VM costs and Bitcoin blockspace still constrain throughput. |
| Setup size | S slots and K readers require S*K prefunded tickets and saved cell template signatures; each signature requires the N-party setup procedure. Fixed roster and horizon. |
| On-chain publication | K cell inputs and K mandatory read outputs, plus fees, batch data and any mint inputs/records. No claim that this avoids the physical output cost. |
| Catch-up | One reader can aggregate overdue closures subject to transaction size, then collect actual receipts. Long prefixes require more data/proving/collector resources. |
| Claim gate | Finite prepared operator/claim alternatives, verified garbling, 240 mandatory bitmap labels and 240 mismatch leaves per instance, plus Binohash grinding/mining. |
| After horizon | Already admitted burns can exit with remaining claim capacity. Unminted R+m can refund. Unburned minted balances have no unspecified renewal/escape and can freeze. |
| Failure assumptions | One honest setup verifier/deleter, cryptographic assumptions, one honest liquid publisher/operator for liveness, one timely challenger for optimistic safety, and Bitcoin data/inclusion/finality assumptions. |

Compared with the [mandatory burn-receipt bridge](binohash-burn-receipt-bridge.md),
this changes who can advance the publication log and how gaps are resolved;
merely assigning a receipt to an already accepted burn did not solve those
problems. Compared with [sealed certificates](binohash-sealed-certificate-bridge.md),
it retains batched general rollup state at the cost of a finite prefunded shared
log. It is a stronger sequencer-failure model, not an unconditional domination
of all cost and availability tradeoffs.

## Optional witness-discount data capsules

The base construction places complete batch data in the non-witness body; a
bare commitment with a possibly withheld opening is invalid. An optional
encoding uses native P2WSH capsule outputs whose scripts are exactly canonical
payload chunks of at most 520 bytes, each followed by OP_DROP, ending with the
publisher's compressed public key and OP_CHECKSIG. Their scriptPubKeys are
exactly `0x00 0x20 SHA256(witnessScript)`.

The batch descriptor identifies ordered capsule outpoints and the publication
must actually consume them. Successful Bitcoin spending necessarily reveals
the entire witnessScript. The bridge proof authenticates each ancestor output,
checks its script hash, exact grammar, payload ordering and mandatory consumption.
It authenticates the witness opening through a body-bound hash; it does not
claim arbitrary witnesses are txid-bound. The publisher signs capsule inputs
with ALL, so outsiders cannot front-run an OP_TRUE data coin. Creating an
unspent capsule does not establish publication or availability.

Respect the native P2WSH witnessScript consensus limit and intended policy
limits, per-element push limits, fees and extra inputs/funding outputs. This
optional encoding is not used to silently accept unavailable data in the base
parser. Confirmed Bitcoin data still requires normal retrieval/archival
availability. No benchmarked compression or throughput improvement is claimed.

## Graph conventions

The drawing shows two readers, one missing earlier slot 0, and honest publisher
A's later slot 1. The one published list illustrates a mint and an authorized
burn; real deployments can place arbitrary valid account transitions between
them across many slots. Reader A's closure alone proves slot 0 is not a full
publication; reader B's slot-0 ticket need not be spent. All amounts fund
illustrative fees/markers, not measured security parameters. Every committee
arrow refers to a saved setup signature. No manual layout is supplied.

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
```

## tx: deposit_refund

```bridgeflow
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
```

## tx: move_to_vault

```bridgeflow
label: MoveToVault; co-create reserve and mint capability
inputs:
  - tx: deposit_request
    output: 0
    spending_path: committee_deposit
    sighash_flag: sighash_all
    color: committee
outputs:
  - amount: "10.00000000"
    label: R; custody shares deleted after complete setup
    spending_paths:
      - id: committee_reimburse
        label: Saved N-of-N Reimburse binds R and A gate
      - id: exact_unminted_refund
        label: Saved exact Refund binds R and unspent m
  - amount: "0.00001000"
    label: m; recognized mint-authority and user leaf
    spending_paths:
      - id: mint_pair
        label: Saved Kmint SINGLE|ACP plus user DEFAULT
      - id: exact_refund
        label: Saved Kmint ALL for exact Refund plus user DEFAULT
```

The two m labels describe approved signature templates for the same canonical
single leaf, not alternative user-only script branches. Kmint signs no other
m spends. The reserve signature templates are fixed after R and m are known.

## tx: unminted_refund

```bridgeflow
label: Refund unminted deposit; exact setup-signed body
inputs:
  - tx: move_to_vault
    output: 0
    spending_path: exact_unminted_refund
    color: committee
    sighash_flag: sighash_all
    arrow_label: Fixed relative nSequence refund delay
  - tx: move_to_vault
    output: 1
    spending_path: exact_refund
    color: user
    sighash_flag: sighash_all
    arrow_label: Saved Kmint ALL and live user DEFAULT
outputs:
  - amount: "10.00000000"
    label: Exact depositor refund; can fund a fee-paying child
    spending_paths:
      - id: user
        label: Depositor signature
```

Refund and Mint conflict on m. Refund and Reimburse conflict on R. Its exact
saved ALL signatures forbid adding cell inputs, changing the payout, or treating
it as an authorized full publication. No minted balance receives this refund.

## tx: user_connector

```bridgeflow
label: Unique user payout connector q
inputs:
  - label: User funds 0.00002000 BTC
outputs:
  - amount: "0.00001000"
    label: Native P2WPKH q; named by the rollup burn
    spending_paths:
      - id: user_payout
        label: User signature
```

## tx: fund_cells

```bridgeflow
label: Fixed publication tickets; two readers and two slots
note: Live keys belong to scheduled publisher; readers can close after D_s
inputs:
  - label: Setup funding 0.00014000 BTC
outputs:
  - amount: "0.00001000"
    label: U[0,A]; earlier publisher B slot
    spending_paths:
      - id: publish
        label: Saved K[0,A] SINGLE|ACP plus publisher B DEFAULT
      - id: close
        label: Reader A signature plus CLTV(D_0)
  - amount: "0.00001000"
    label: U[0,B]; same earlier slot
    spending_paths:
      - id: publish
        label: Saved K[0,B] SINGLE|ACP plus publisher B DEFAULT
      - id: close
        label: Reader B signature plus CLTV(D_0)
  - amount: "0.00001000"
    label: U[1,A]; honest publisher A slot
    spending_paths:
      - id: publish
        label: Saved K[1,A] SINGLE|ACP plus publisher A DEFAULT
      - id: close
        label: Reader A signature plus CLTV(D_1)
  - amount: "0.00001000"
    label: U[1,B]; same later slot
    spending_paths:
      - id: publish
        label: Saved K[1,B] SINGLE|ACP plus publisher A DEFAULT
      - id: close
        label: Reader B signature plus CLTV(D_1)
```

Each live template has locktime 0 and sequence 0xffffffff and forces its own
paired reader output. All ticket outpoints/scripts and D_0<D_1 are fixed in the
verified manifest. The entire finite schedule is prepared before key deletion.

## tx: close_previous

```bridgeflow
label: Reader A closes missing earlier slot
note: Can aggregate other overdue A tickets using max deadline
inputs:
  - tx: fund_cells
    output: 0
    spending_path: close
    color: operator
    sighash_flag: sighash_all
    arrow_label: Reader A; nLockTime at least D_0; nonfinal sequence
  - label: Reader A fee funding 0.00010000 BTC
    sighash_flag: sighash_all
outputs:
  - amount: "0.00001000"
    label: A-controlled accumulator proving slot 0 no-op
    spending_paths:
      - id: reader
        label: Reader A signature
```

Closing U[0,A] excludes every full slot-0 publication. U[0,B] may remain unspent.
An honest reader chooses this accumulator; a malicious reader cannot choose it
on behalf of another reader's distinct ticket.

## tx: publish_batch

```bridgeflow
label: Full slot 1 publication; mint and signed rollup requests
note: nVersion 2; nLockTime 0; cell and m sequences 0xffffffff
inputs:
  - tx: fund_cells
    output: 2
    spending_path: publish
    color: committee
    sighash_flag: sighash_single|anyonecanpay
    arrow_label: Input 0; saved pair signature plus publisher DEFAULT
  - tx: fund_cells
    output: 3
    spending_path: publish
    color: committee
    sighash_flag: sighash_single|anyonecanpay
    arrow_label: Input 1; saved pair signature plus publisher DEFAULT
  - tx: move_to_vault
    output: 1
    spending_path: mint_pair
    color: user
    sighash_flag: sighash_single|anyonecanpay
    arrow_label: Input 2; saved Kmint pair plus user DEFAULT on full body
  - label: Publisher fee funding 0.00010000 BTC
    sighash_flag: sighash_all
outputs:
  - amount: "0.00001000"
    label: Forced receipt for reader A; paired with input 0
    spending_paths:
      - id: reader
        label: Reader A signature
  - amount: "0.00001000"
    label: Forced receipt for reader B; paired with input 1
    spending_paths:
      - id: reader
        label: Reader B signature
  - amount: "0.00000000"
    label: Immutable Mint(R, amount, user, deposit ID, setup hash)
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
  - amount: "0.00000000"
    label: Unique slot 1 descriptor and full signed user transaction list
    spending_paths:
      - id: terminal
        label: Unspendable OP_RETURN
```

Both readers get an output without signing this publication. The user signs the
entire exact batch on m. The illustrative signed list includes a burn binding R,
q and the user payment; canonical execution, not the publisher's assertion,
determines whether the burn succeeds. Pair signatures do not authorize R.

## tx: collect_prefix

```bridgeflow
label: Reader A collects complete prefix through slot 1
inputs:
  - tx: close_previous
    output: 0
    spending_path: reader
    color: operator
    sighash_flag: sighash_all
    arrow_label: Actual closure proves slot 0 no-op
  - tx: publish_batch
    output: 0
    spending_path: reader
    color: operator
    sighash_flag: sighash_all
    arrow_label: Actual full publication supplies slot 1
  - label: Reader A collection fee funding 0.00010000 BTC
    sighash_flag: sighash_all
outputs:
  - amount: "0.00001000"
    label: Complete-prefix accumulator; omitted slots forbidden
    spending_paths:
      - id: reader
        label: Reader A signature
```

For a longer claimed prefix, every preceding slot must be represented by its
own authenticated ticket-spend evidence. Intermediate collector trees are
allowed; an arbitrary summary hash without the proved input ancestry is not.

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
label: Import complete slot prefix and actual payout; grind
inputs:
  - tx: collect_prefix
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
    label: Read output importing complete prefix and payout
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
its txid without changing the confirmed payout or closed-prefix history. Produce
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
