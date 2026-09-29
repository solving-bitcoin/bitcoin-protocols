# Subchains using OP_CAT and the Taproot annex

These graphs model Robin Linus's [Bitcoin Subchains via OP_CAT and the Taproot
Annex](https://gist.github.com/RobinLinus/8183bec5040e75d57642e69bfaa22a6f/33a4129d75f9ae6ee2c686e2f09c284e9087ed61),
revision `33a4129d75f9ae6ee2c686e2f09c284e9087ed61` (updated 2026-05-05).

The combined assumptions are:

- The parent folder's single-transaction ZK verifier, instantiated as a STARK
  verifier whose concrete resource requirements still need to be established.
- A consensus change enabling OP_CAT for the recursive covenant and the
  transaction-field checks using the BIP-341 sighash construction.
- Relay-policy support for the Taproot annex. Annex relay is a separate
  requirement from enabling OP_CAT; it is not described as a new consensus field.
- Correct proof statements binding the prior state, annex commitment, reserve
  accounting, and withdrawal outputs, plus Bitcoin data availability and liveness.

| Graph | Bitcoin verification rule |
| --- | --- |
| [Clean ledger](subchains-clean-ledger.md) | Verify a STARK for every subblock's state transition. |
| [Dirty ledger](subchains-dirty-ledger.md) | Require a STARK for withdrawals; a carry-forward subblock does not require proof of valid subchain execution. |

Each publishing transaction carries its data in the annex, advances the rolling
commitment `state_next = H(state_prev || sha_annex)`, and recreates the funds
covenant. Its funds input enforces a one-block relative delay. Publishing is
permissionless. Competing carry-forward and withdrawal transactions in a graph
are alternative spends of the same funds UTXO.

The dirty-ledger sketch also uses recursive Groth16 proofs for subchain light
clients, with the proof system's setup and soundness assumptions. Those proofs
are checked off-chain, not by the Bitcoin carry-forward path. Invalid subblocks
remain in Bitcoin's annex history even when subchain execution ignores them;
the history commitment is not itself a validated application state.

Deposit recognition, aggregation, and crediting are explicitly unfinished in the
gist. Their graph paths are marked **TBD** and only show the intended dependency
between the deposit UTXO and the funds UTXO. No concrete deposit script, refund,
or completed peg-in protocol is claimed. Publisher fee funding and the concrete
verifier/covenant resource budget are also unresolved. The graphs omit fees and
use illustrative BTC balances: 1 BTC already in reserve, a 0.1 BTC deposit, and
a 0.25 BTC withdrawal, leaving 0.85 BTC. The zero-value OP_RETURN outputs are
unspendable history commitments, not additional reserves.
