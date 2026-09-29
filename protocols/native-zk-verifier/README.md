# Native ZK verifier assumption

Protocols in this folder assume Bitcoin can verify a ZK proof in a single
transaction and enforce the proved statement as a spending condition. The
verifier may be an opcode or a Script construction; the required proof must fit
the applicable transaction and Script resource limits.

This is an explicit modeling assumption, not a claim that the verifier is
available under current Bitcoin rules. It is different from verifying a proof
off-chain and relying on an optimistic fraud-proof challenge window.

Additional requirements belong in named subfolders. The
[OP_CAT subchains](op-cat/README.md) additionally assume OP_CAT and relay support
for transactions carrying a Taproot annex.
