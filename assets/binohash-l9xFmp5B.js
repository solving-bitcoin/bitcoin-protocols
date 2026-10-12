const n=`# Binohash introspection primitive

Fund Binohash script creates an output committing to the operator's HORS
verification key. Spending that output in transaction \`T\` forces the operator
to reveal a HORS signature on \`H\`, the Binohash of \`T\`. The revealed signature
can later be used as input to a prepared garbled circuit to assert conditions
on \`T\` and its ancestor transactions. This forced signature is the interface
between the Bitcoin spend and the circuit's introspection.

The connection to ancestry is transitive: \`H\` binds the spending transaction's
prevouts, each prevout names a parent txid, and each parent commits to its own
prevouts. With the corresponding transaction data or a proof, the circuit can
authenticate this history and check a predicate over it. The ancestry includes
both the Binohash funding branch and every other input branch of \`T\`.

Source: Robin Linus, [Binohash: Transaction Introspection Without Softforks](https://robinlinus.com/binohash.pdf),
33-page PDF retrieved 2026-10-11; sections 2.7, 3–7 and appendices A–C.
PDF SHA-256: \`1be2b63034a86db1f9f4a35c7963248d307583723079ff25284a9fc4affee94a\`.

## Garbled-circuit assertion

The enclosing protocol binds the garbled-circuit instance to the HORS
commitments in the funding output and uses the signature revealed by this
specific spend. Its verification relation must:

1. Authenticate \`H\` through that HORS signature and check that the supplied
   spending transaction has Binohash \`H\`, including the pinning and sighash
   checks below.
2. Authenticate supplied ancestors by checking their txids against the
   prevout references, recursively. A claim covering all ancestors requires
   complete ancestry for the claim, or a proof of that completeness.
3. Check the desired condition \`P(T, ancestors)\` directly or verify a proof
   of it. For example, reconstruct a rollup state from data in the ancestors
   and assert that the state authorizes the operator's withdrawal.

The signature supplies the authenticated digest; transaction data or proofs
must also be available. Txids commit to ancestor transaction bodies; predicates
about SegWit witness data need an additional binding because witness data is
excluded from txids ([BIP 141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#transaction-id)).
Circuit preparation, correct garbling, and any challenge or settlement path
are supplied by the enclosing protocol. The graph annotates this off-chain
use at the spend; it does not introduce a Bitcoin transaction for evaluation.

## Assumptions

Binohash requires miners to include consensus-valid transactions that ordinary
relay policy rejects. This is a mining/liveness dependency, not a required soft
fork or a guarantee of miner access.

Bitcoin Core v30.0 rejects nonstandard output scripts and spends of them in
[\`IsStandardTx\` / \`AreInputsStandard\`](https://github.com/bitcoin/bitcoin/blob/v30.0/src/policy/policy.cpp).
Its [standard script flags](https://github.com/bitcoin/bitcoin/blob/v30.0/src/policy/policy.h)
include \`CONST_SCRIPTCODE\` and \`CLEANSTACK\`. Binohash's bare scripts,
signature deletion, and residual stack therefore require a suitable direct
mining path or modified policy; \`acceptnonstdtxn\` alone is insufficient.

Required assumptions are classical secp256k1/signature-puzzle hardness,
SHA-256/HASH160 security, and the construction's work-binding argument.
HORS secrets must remain private until use and the commitments must not be
reused for different messages. There is no deleted-key ceremony in this
isolated primitive. The operator needs grinding capacity and available preimages.

The garbled-circuit verification relation must check the full transaction, pinning, subset
signature, and canonical \`SIGHASH_ALL\` (\`0x01\`) for both extraction rounds
(sections 7.1–7.2). These flag restrictions are off-chain checks. Binding the
correct script instance and digest into an enclosing proof/dispute protocol
remains that protocol's responsibility; Bitcoin does not directly verify its
application claim. This graph adds no native ZK verifier or general covenant.

## Construction details

The graph uses the two-round construction with separate dummy-signature and
HORS-commitment pools, excluding Appendix D's polyglot optimization. Four short
ECDSA signatures make transaction changes expensive. Two \`FindAndDelete\`
searches each select eight of 120 embedded signatures; the selections form
\`H\`. Revealing the 16 matching HORS preimages signs \`H\`, and the spending
script verifies those preimages against the operator's commitments.

This is an illustrative funding topology, not the paper's complete bridge.
All puzzle checks occur inside one input of \`binohash_spend\`; the grinding
stages are not separate transactions. The representative ancestor transaction
\`fund_auxiliary\` supplies the read output and a second auxiliary output; earlier
ancestors are collapsed into its input label. These occupy indices 0 and 1,
leaving Binohash at index 2 with two outputs. That satisfies the legacy
[\`SIGHASH_SINGLE\` out-of-range condition](https://github.com/bitcoin/bitcoin/blob/v30.0/src/script/interpreter.cpp#L1473-L1485)
used by the dummy signatures. Keeping auxiliary funding separate allows its
txid to change without changing the Binohash prevout.

Pinning proceeds through \`NONE|ANYONECANPAY\`, \`NONE\`, \`ALL|ANYONECANPAY\`,
then \`ALL\`, using transaction fields, the separate ancestor's txid, OP_RETURN
data, and auxiliary sequences respectively (section 3.1.1). This example assumes
the operator can vary that ancestor before publication; an already fixed history
needs a separate grinding input or another supported source of variation.
Auxiliary owner signatures are produced after grinding. A single input-level sighash annotation cannot
represent Binohash's multiple checks, so that input has none.

Amounts are illustrative BTC. The two auxiliary outputs contribute 20,000 sats
to the spend's fee; funding fees are omitted and fee adequacy is unspecified.
The destination is an example chosen before grinding, not a script-enforced
fixed recipient. \`unspendable\` labels OP_RETURN's terminal status, not an
executable spending path. No timeout or recovery branch is specified here.

The paper's approximately 84-bit collision resistance and compute prices are
estimates, not independently validated guarantees. A direct combinatorial
check gives \`log2(C(120,8)) = 39.612\` bits per round, below the 42-bit puzzle
target; a fixed transaction may exhaust its subsets without success. Retry
costs and the full security argument require separate implementation review.

\`\`\`bridgeflow
tx_width: 600
color_groups:
  auxiliary_signature: blue
  binohash: purple
\`\`\`

## tx: fund_binohash

\`\`\`bridgeflow
label: Fund Binohash script
inputs:
  - label: Operator funds / funding ancestry
outputs:
  - amount: "0.01000000"
    label: Binohash output + operator HORS commitments
    spending_paths:
      - id: binohash
        label: |-
          Operator must HORS-sign H = Binohash(spending tx)
          Reveal matching HORS preimages
          Satisfy the Binohash signature puzzles
\`\`\`

## tx: fund_auxiliary

\`\`\`bridgeflow
label: Ancestor transaction / read output
note: Its prevouts commit recursively to earlier ancestors
inputs:
  - label: Earlier ancestor transactions / operator funds
outputs:
  - amount: "0.00010000"
    label: Read output carrying the ancestry commitment
    spending_paths:
      - id: owner
        label: Operator signature
  - amount: "0.00010000"
    label: Auxiliary input
    spending_paths:
      - id: owner
        label: Operator signature
\`\`\`

## tx: binohash_spend

\`\`\`bridgeflow
label: Spend and reveal Binohash
note: |-
  Reveals the operator's HORS signature on H = Binohash(this tx)
  Later: feed that signature into the prepared garbled circuit
  Assert conditions on this transaction and its ancestors
inputs:
  - tx: fund_auxiliary
    output: 0
    spending_path: owner
    sighash_flag: sighash_all
    color: auxiliary_signature
    arrow_label: Input 0; imports the ancestor txid
  - tx: fund_auxiliary
    output: 1
    spending_path: owner
    sighash_flag: sighash_all
    color: auxiliary_signature
    arrow_label: Input 1
  - tx: fund_binohash
    output: 0
    spending_path: binohash
    color: binohash
    arrow_label: Input 2; forces HORS signature on this spend
    label: |-
      H = Binohash(this transaction)
      Operator HORS signature on H
outputs:
  - amount: "0.01000000"
    label: Example destination chosen before grinding
    spending_paths:
      - id: owner
        label: Operator signature
  - amount: "0.00000000"
    label: OP_RETURN grinding nonce
    spending_paths:
      - id: unspendable
        label: Unspendable (OP_RETURN)
\`\`\`

<!-- bridgeflow:layout
txs:
  binohash_spend:
    x: 1009
    y: 91
  fund_auxiliary:
    x: -33
    y: -42
  fund_binohash:
    x: -67
    y: 405
-->
`;export{n as default};
