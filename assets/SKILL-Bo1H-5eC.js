const n=`---
name: bitcoin-protocols-research
description: Research, explain, compare, and model Bitcoin protocols and transaction primitives. Use for Bitcoin protocol design questions, interpreting transaction graphs, or creating and revising BridgeFlow graph Markdown.
---

# Bitcoin Protocols Research

Study Bitcoin protocols through their transaction graphs, spending conditions,
setup requirements, and off-chain interactions. The scope includes payment
channels, swaps, custody, vaults, bridges, and other Bitcoin constructions.

## Research Approach

- Start with the user's question and supplied artifacts. For graph interpretation,
  distinguish what the graph explicitly encodes from inferences and missing
  information. A transaction name alone does not establish its behavior.
- Derive parties, trust assumptions, amounts, proof systems, and chain dependencies
  from the protocol being studied. Establish the network and consensus or relay
  rules it requires, including any proposed changes.
- Trace outputs through their alternative spends. Identify authorization,
  required witness data, signature scope, relative or absolute timelocks, and
  which inputs must be consumed together.
- Distinguish setup signatures from live signatures, key-deletion assumptions
  from script enforcement, and off-chain commitments from on-chain checks.
  Treat omitted information as unknown.
- When relevant to the question, analyze normal completion, conflicting spends,
  timeouts, recovery, safety, liveness, and setup or operating costs. State which
  conclusions depend on assumptions beyond the graph.
- For source-based research, use primary specifications, papers, or implementation
  code and identify the version or revision supporting a claim. Keep sourced
  facts, deductions, and proposed changes distinct.

## Workspace and Deliverables

- Keep protocol graphs in \`protocols/\` and isolated reusable transaction
  primitives in \`protocols/primitives/\`.
- For each new protocol, identify any required soft fork, relay-policy change,
  or additional cryptographic capability before choosing its location. Put it
  in a descriptive assumption folder, such as \`native-zk-verifier/\`, \`op-cat/\`,
  \`op-templatehash/\`, \`witness-encryption/\`, or \`functional-encryption/\`.
  Nest folders for combined requirements and document all of them in the folder
  README, distinguishing consensus changes, policy changes, cryptographic
  assumptions, and setup trust. Do not imply these capabilities are available
  under current Bitcoin rules. An optimistic fraud-proof system does not belong
  under \`native-zk-verifier/\` merely because it uses a ZK proof off-chain.
- Split materially different protocol variants into separate graph files.
  Keep unresolved source mechanisms explicitly marked as unspecified rather
  than inventing scripts, refund paths, or recovery transactions.
- Reuse an existing graph when revising that protocol. Preserve transaction IDs,
  names, labels, amounts, spending paths, arrows, and layout unless the requested
  change affects them.
- Keep existing graph files limited to their title, transaction headings,
  \`bridgeflow\` metadata, and hidden layout. Explain findings in the response;
  add protocol descriptions to Markdown only when requested.
- Keep this skill focused on research methods and graph syntax. Protocol-specific
  explanations and preferred-design assumptions do not belong here.

## File Shape

For a graph deliverable, use one Markdown file per protocol or primitive.
The first H1 is the graph title. A top-level
\`bridgeflow\` YAML fence may define graph settings:

\`\`\`\`md
# Graph title

\`\`\`bridgeflow
color_groups:
  refund: orange
\`\`\`
\`\`\`\`

Each transaction is a \`## tx: <stable_tx_id>\` section. The first \`bridgeflow\`
YAML fence inside the section defines the transaction. Optional prose outside
that fence becomes its description; omit it unless requested.

\`\`\`\`md
## tx: funding_tx

\`\`\`bridgeflow
label: Funding tx
inputs:
  - label: user funds
outputs:
  - amount: "1.23450000"
    spending_paths:
      - id: key-path
        label: owner key
      - id: timeout-path
        label: timeout refund
\`\`\`
\`\`\`\`

Use lowercase snake_case tx IDs. Keep IDs stable because inputs reference them.

## Outputs

Every output must include an amount and at least one spending path:

\`\`\`yaml
outputs:
  - amount: "1.23450000"
    spending_paths:
      - id: key-path
        label: owner key
      - id: timeout-path
        label: timeout refund
\`\`\`

Rules:

- Amounts are strings in BTC units. The renderer adds the BTC symbol.
- \`spending_paths\` are the spendable conditions for that output.
- Each path needs a stable \`id\`; inputs use this id for arrow routing.
- Multiple spending paths render as separate text boxes with orange \`OR\` labels between them.
- A tx that only consumes inputs and creates no outputs may use \`outputs: []\`.

## Inputs

Inputs consume a previous tx output and name the spending path being taken:

\`\`\`yaml
inputs:
  - tx: funding_tx
    output: 0
    spending_path: timeout-path
\`\`\`

Rules:

- \`tx\` is the source tx id.
- \`output\` is the zero-based index in that tx's \`outputs\` array.
- \`spending_path\` should match a path \`id\` on the referenced output.
- Label-only inputs such as \`- label: User funds\` are accepted as unconnected input-side text with no arrow.
- Add \`arrow_label\` when text belongs on the arrow rather than in the tx input cell.

## Colored Arrows

Define named color groups in the top-level \`bridgeflow\` fence and reference a
group from an input:

\`\`\`yaml
color_groups:
  user_signed: blue
  counterparty_signed: green
  refund: orange
\`\`\`

\`\`\`yaml
inputs:
  - tx: funding_tx
    output: 0
    spending_path: timeout-path
    color: refund
\`\`\`

Rules:

- \`color\` belongs on an input because each input renders one arrow.
- Group names are case-sensitive.
- Color words are case-insensitive. Accepted words: \`black\`, \`white\`, \`red\`, \`orange\`, \`yellow\`, \`green\`, \`blue\`, \`purple\`, \`pink\`, \`gray\`, \`brown\`, \`teal\`, \`cyan\`.
- Direct hex colors are accepted as \`#rgb\` or \`#rrggbb\`.

## Sighash Flags

Add a sighash flag on an input, or on a tx to default all of its inputs:

\`\`\`yaml
sighash_flag: sighash_single|anyonecanpay
inputs:
  - tx: funding_tx
    output: 0
    spending_path: key-path
\`\`\`

Any Bitcoin sighash flag is allowed, including combinations joined with \`|\`.

## Layout

Do not hand-edit layout unless the user explicitly asks. The visualizer manages
layout in a hidden block at the end of the file:

\`\`\`md
<!-- bridgeflow:layout
txs:
  funding_tx:
    x: 120
    y: 80
-->
\`\`\`

## Checklist

- Every tx has a unique \`id\` from its \`## tx: <id>\` heading.
- Every connected input references an existing tx id; label-only inputs may omit it.
- Every input \`output\` index exists on the source tx.
- Every input \`spending_path\` matches a path id on that source output.
- Every input \`color\`, when present, matches a top-level \`color_groups\` entry.
- Every non-empty output has an \`amount\`.
- Every non-empty output has at least one spending path.
`;export{n as default};
