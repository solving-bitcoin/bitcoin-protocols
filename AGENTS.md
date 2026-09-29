# AGENTS.md

This repository is a Bitcoin protocols research workspace.

- For protocol research or transaction graph changes, work in `protocols/` and read `protocols/skills/bitcoin-protocols-research/SKILL.md`.
- For webapp improvements, work in `webapp/` and read `webapp/AGENTS.md`.
- Keep protocol definitions in `protocols/`; the webapp reads them from there.
- Comments are not allowed inside `bridgeflow` code blocks, including full-line and inline YAML comments.
- Put new protocols that require a soft fork, a relay-policy change, or an additional cryptographic capability in a named assumption folder under `protocols/`, rather than at its root. Examples include `native-zk-verifier/`, `op-cat/`, `op-templatehash/`, `witness-encryption/`, and `functional-encryption/`. Nest folders when requirements combine, and document every required assumption in the relevant folder README. Create folders as needed; do not classify an optimistic fraud-proof protocol as a native ZK verifier.
- Keep existing protocol and primitive Markdown files focused on graph titles, transaction names, graph definitions, and layouts. Add explanatory prose only when requested.
