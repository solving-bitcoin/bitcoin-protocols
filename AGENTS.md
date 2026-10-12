# AGENTS.md

This repository is a Bitcoin protocols research workspace.

- For protocol research or transaction graph changes, work in `protocols/` and read `protocols/skills/bitcoin-protocols-research/SKILL.md`.
- For webapp improvements, work in `webapp/` and read `webapp/AGENTS.md`.
- Keep protocol definitions in `protocols/`; the webapp reads them from there.
- Comments are not allowed inside `bridgeflow` code blocks, including full-line and inline YAML comments.
- Create a new protocol or primitive folder only when the construction requires a new Bitcoin consensus rule, such as `op-cat/`, `op-templatehash/`, or `native-zk-verifier/`. Reuse a matching folder when available; nest folders only for combined consensus changes. Relay-policy changes, mining requirements, or additional cryptographic assumptions alone do not justify a new folder. Do not classify an optimistic fraud-proof protocol as a native ZK verifier.
- Keep each protocol or primitive's description, sources, and required assumptions in the same Markdown file as its graph, outside `bridgeflow` code blocks. Do not create new README files for protocol or primitive documentation.
