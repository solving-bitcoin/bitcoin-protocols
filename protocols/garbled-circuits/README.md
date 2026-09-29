# Garbled-circuit conditional disclosure

This folder contains protocols that assume a practical garbled-circuit scheme
with conditional disclosure of secrets (CDS), together with a way to verify the
garbling without exposing its embedded secrets. This is an additional
cryptographic capability, not a native Bitcoin proof-verification opcode.

## FLEX source and scope

Source: Sergio Demian Lerner and Ariel Futoransky,
[FLEX - Capital-Efficient Optimistic Bridges with On-Demand Security Bonds for Bitcoin](https://eprint.iacr.org/2025/1392),
revision dated 2025-08-21. The downloaded PDF has 16 pages.

- [Basic FLEX](flex-basic.md) models Sections 6.1-6.10 and Figure 1.
- [FLEX with Bob's predeposit](flex-predeposit.md) models Section 6.13 and
  Figure 2, followed by the basic dispute. Alice's input-publication cost is
  prepaid by Bob.
- [FLEX2 bridge](flex2-bridge.md) expands the component in Figure 3 inside the
  bridge in Figure 4, with delay parameters A = B = 0 as specified in Section 7.
  One Alice/Bob dispute is shown; this is not a complete multiparty bridge.

The graphs follow the paper's simplified burn-proof setting. Counter-proofs,
canonical-chain selection, and the additional commitments and cross-signatures
described in Section 6 are not included. Peg-in acceptance, side-system minting
and burning, proof generation, and replacement of a disabled operator are
outside these transaction graphs. Method 1's persistent deposit is discussed in
Section 6.12 but lacks a complete transaction graph and is not instantiated here.

## Required assumptions

- **Cryptography:** Section 5.1 assumes a practical GC construction without
  selecting or costing one. Alice's circuit releases Pb for an invalid burn
  SNARK; Bob's circuit releases Pa for a valid one. Setup must prove circuit
  correctness and the association of Lamport verification hashes with input
  labels, while preserving the secrets (Sections 6.2 and 6.6). The SNARK and
  side-system burn predicate must themselves be sound. Garbled circuits and
  Lamport keys must be used consistently with their one-time setup.
- **Bitcoin consensus:** The intended construction uses Taproot script paths,
  hashlocks, signatures, relative CSV timelocks, and ANYONECANPAY signatures.
  It does not request a soft fork or SIGHASH_NOINPUT. SNARK verification and
  garbled-circuit evaluation occur off-chain; Bitcoin enforces publication of
  OTS inputs and the resulting secret-dependent spending conditions.
- **Relay and resources:** The paper does not request a relay-policy change.
  Its transaction diagrams are not serialized Script implementations or a
  demonstration that the complete witnesses fit consensus and standardness
  limits. Section 6.10 estimates a substantial Lamport-signed input witness;
  Bob must also include Alice's OTS signature on the same message. A concrete
  implementation must establish resource and relay feasibility.
- **Setup trust:** Alice and Bob exchange setup signatures for an emulated
  covenant transaction DAG. Enforcement assumes they cannot subsequently sign
  an unauthorized spend together. The paper does not specify the setup-key
  lifecycle or an exact deletion ceremony. The bond pots explicitly have
  unspendable Taproot internal keys and three script leaves (Section 6.5).
- **Operation:** Challenges are permissioned. An honest challenger must remain
  available, evaluate the circuits, fund its on-demand bond, and confirm its
  response before the relevant deadline. Timelock periods must cover these
  operations and confirmation risk. On-demand dispute bonds do not replace
  persistent liveness collateral where the surrounding bridge requires it
  (Section 3).

## Graph conventions and source limits

`v` denotes the peg amount, `d` each party's agreed dispute bond, and `c` the
input-publication prepayment. Amounts are symbolic BTC values. `*` marks control
amounts or outputs that the source does not quantify. Fees, change and dust
funding are omitted; these are transaction-structure models, not balanced PSBTs.
Control-result outputs whose scripts are not given are explicitly unspecified.

`TL` is one relative timelock period, measured from the confirmation of the
specific output consumed by that input. Each graph labels that source and
period count. The ANYONECANPAY annotation records the flag specified by the
paper; its base sighash type is unspecified. The partial setup signatures must
fix the designated deposit output while allowing a funding input to be added.
Deposit txids are therefore dynamic, and their pot spends are constructed later.
Fixed control transactions never depend on a dynamic deposit txid.

In basic FLEX and the predeposit variant, AliceDeposit publishes Alice's
Lamport-signed proof. BobDeposit checks both parties' signatures over the same
proof. This is a witness dependency, not an input spending AliceDeposit.
Each pot is separately claimable by Alice with her signature and Pa, by Bob
with his signature and Pb, or by its owner after its own timeout.

For Method 2, Section 6.11 calls for adding the prepayment to AliceDeposit and
subtracting it from BobDeposit to equalize deposits after completion. Figure 2
does not specify the resulting pot amounts, fee/change outputs, or routing of
the prepayment into subsequent funding. The graph marks that accounting as
unspecified and leaves funding as label-only inputs, without adding a
presigned dependency on BobPreDeposit's dynamic txid.

In FLEX2, bond posting precedes proof publication operationally; the figures do
not connect the pots to AliceInput. The close output is a single conflicting
UTXO shared by completion, timeout, and StillOpen transactions. StillOpen also
consumes the early-refund attempt, blocking EarlyRefund while leaving the ordinary
refund subject to the surviving reimbursement enabler. Alice must close Bob's
challenge opportunity (for example with NoBobChallenge or MissingBobDeposit)
before relying on the two-period early refund. Merely broadcasting
TryEarlyRefund does not establish a win. BobWasDisabled uses a global preimage
whose creation and distribution the paper does not specify.

The generalized component also permits other asserters to close stalled
disputes. Those transactions are retained, but the paper does not give their
full authorization scripts. In a deployment with only Alice and Bob, there
are no additional asserters to exercise those paths.
