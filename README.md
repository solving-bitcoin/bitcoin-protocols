# Bitcoin Protocols Research

Bitcoin protocol transaction graphs live in [`protocols/`](protocols/). Each graph is a Markdown file containing its title, transaction names, `bridgeflow` YAML definitions, and saved layout. Smaller reusable graphs live in [`protocols/primitives/`](protocols/primitives/).

Research and graph-format guidance lives in the [Bitcoin Protocols Research skill](protocols/skills/bitcoin-protocols-research/SKILL.md).

New protocols requiring extra consensus, relay, or cryptographic capabilities
live in named assumption folders. Folder READMEs describe the requirements;
nested folders combine them. See [native ZK verification](protocols/native-zk-verifier/README.md)
and [template-hash covenants](protocols/op-templatehash/README.md). Future designs
depending on witness encryption or functional encryption should similarly live
in their own assumption folders.

The [`webapp/`](webapp/) folder contains BridgeFlow, the React visualiser for these protocol files.

```bash
cd webapp
pnpm install
pnpm dev
```

Open the local URL shown by Vite and choose **Load default**. Edits to files in `protocols/` are picked up by the development server.
