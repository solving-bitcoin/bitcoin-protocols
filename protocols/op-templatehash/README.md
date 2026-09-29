# OP_TEMPLATEHASH covenant assumption

Protocols in this folder assume a consensus change providing the template-hash
covenants they use. They do not assume a native ZK verifier unless another
assumption folder explicitly says so.

## BitVM-448

Source: Robin Linus, [BitVM-448: Covenant-Based BitVM3 Bridges](https://robinlinus.com/bitvm448.pdf),
seven-page PDF retrieved 2026-09-27. PDF SHA-256:
`c23530fe7a644dae8cf0dda78c189e02cb1a71e28017cf7e0058378a5aac24d4`.

The paper uses the OP_TEMPLATEHASH component of the proposed BIP-448 package.
The enumeration variants need TH; they do not need CHECKSIGFROMSTACK or a
deleted-key ceremony for covenant recursion. BitVM3-core's separate garbling,
assertion-artifact setup and cryptographic assumptions still apply. Verification
is optimistic: a false assertion reveals a global operator secret to an
off-chain evaluator, who must get a cancellation confirmed before Delta.

| Graph | Reserve after a failed assertion | Recursion requirement |
| --- | --- | --- |
| [Strict enumeration](bitvm448-enumeration.md) | Remove the cheating operator from that slot's Taptree. | A finite precomputed subset graph using TH. |
| [Semantic unrolling](bitvm448-semantic-unrolling.md) | Keep the operator set, advance the attempt depth. | A finite precomputed depth graph using TH. |
| [Deleted-key recursion](checksigfromstack/bitvm448-deleted-key.md) | Recreate the same reserve covenant. | TH, CSFS, and per-template deleted-key setup. |

Deposits pay into unused prepared slots with fixed amounts, operator sets,
scripts, slot identifiers, and assertion parameters. The side system must track
valid slot allocation. This is not arbitrary-amount or unlimited-capacity
deposit support. The assertion must bind the completed peg-out and the reserve
slot to prevent a valid claim from reimbursing against multiple reserves.

The graphs use `D = 1 BTC` and `B = 0.01 BTC`; ordinary mining fees are omitted.
An operator supplies an arbitrary additional input funding B (and the actual
kickoff fee), so Assert has one covenant-controlled output worth D+B. TH does
not identify a particular bond input or constrain a sibling UTXO. Cancellation
returns D to the bridge; B is the cancellation transaction's miner fee, not an
OP_RETURN burn or a challenger payment. Withdrawal follows Section 2's D+B
accounting, including bond recovery; Figure 1 labels its withdrawal output D.
The graphs follow the text where that illustration differs.

The strict graph fully expands a two-operator example. Its two all-slashed
outputs represent the same logical empty operator-set state reached by
alternative histories, not two simultaneously spendable reserves. The source
does not specify an exit from that state or the migration/recovery transaction
at a bounded-depth limit; those outputs are marked accordingly.

Semantic unrolling shows a selected A-first history with a limit of two failed
attempts, including a repeat attempt by A after its secret is public. Each such
attempt still supplies a fresh bond. Unexpanded operator branches are labeled
as prepared templates. At the depth limit, no recovery spending rule is invented.
These are illustrative parameters, not deployment recommendations.

All variants require available public assertion artifacts, timely challengers,
and Bitcoin ledger safety and liveness. A recurring covenant does not make
single-use garbled-circuit or adaptor-signature artifacts reusable. The paper
leaves their per-slot/per-claim provisioning separate from covenant recursion.
Fee adequacy and confirmation within Delta remain operational assumptions.
