# Bitcoin Protocols Research

Bitcoin protocol transaction graphs live in [`protocols/`](protocols/). Each graph is a Markdown file containing its description, sources, assumptions, transaction names, `bridgeflow` YAML definitions, and saved layout. Smaller reusable graphs live in [`protocols/primitives/`](protocols/primitives/).

Research and graph-format guidance lives in the [Bitcoin Protocols Research skill](protocols/skills/bitcoin-protocols-research/SKILL.md).

Create new protocol or primitive folders only for required Bitcoin consensus
changes, such as `op-cat/`, `op-templatehash/`, or `native-zk-verifier/`.
Reuse matching folders and nest them only when consensus requirements combine.
Relay-policy, mining, and cryptographic assumptions alone do not require a
separate folder. Keep descriptions, sources, and all assumptions in each
protocol or primitive's own Markdown file; do not add new documentation READMEs.

The [`webapp/`](webapp/) folder contains BridgeFlow, the React visualiser for these protocol files.

```bash
cd webapp
pnpm install
pnpm dev
```

Open the local URL shown by Vite and choose **Load default**. Edits to files in `protocols/` are picked up by the development server.
