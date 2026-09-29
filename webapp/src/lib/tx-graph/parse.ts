import { parseDocument, stringify } from "yaml"

import type {
  ParsedGraphResult,
  RawTxGraph,
  RawTxNode,
  RawTxOutput,
  RawTxRef,
  TxInput,
  TxNode,
  TxOutput,
  TxSpendingPath,
} from "@/lib/tx-graph/types"

const BRIDGEFLOW_LAYOUT_BLOCK_PATTERN =
  /<!--\s*bridgeflow:layout[ \t]*\n([\s\S]*?)\n?-->/i
const TX_HEADING_PATTERN = /^##[ \t]+tx:[ \t]*(.+?)[ \t]*$/gim

interface BridgeflowFence {
  content: string
  start: number
  end: number
}

interface TxSection {
  id: string
  bodyStart: number
  bodyEnd: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toStringSafe(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function toAmountString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`
  }

  return toStringSafe(value) ?? undefined
}

function firstStringSafe(...values: unknown[]): string | undefined {
  for (const value of values) {
    const parsed = toStringSafe(value)
    if (parsed) {
      return parsed
    }
  }

  return undefined
}

function normalizeSourceIndex(
  raw: number | string | undefined,
  fallback: number
): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw))
  }

  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10)
    return Number.isNaN(parsed) ? Math.max(0, fallback) : Math.max(0, parsed)
  }

  return Math.max(0, fallback)
}

function normalizePositiveNumber(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw
  }

  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }

  return undefined
}

function normalizeCoordinate(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw
  }

  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function normalizeMarkdownSource(source: string) {
  return source.replace(/\r\n?/g, "\n")
}

function stripClosingHeadingHashes(value: string) {
  return value.replace(/[ \t]+#+[ \t]*$/, "").trim()
}

function parseColorGroups(
  raw: unknown,
  diagnostics: string[]
): Record<string, string> {
  if (raw === undefined) {
    return {}
  }

  if (!isRecord(raw)) {
    diagnostics.push("Ignored color groups: expected an object.")
    return {}
  }

  return Object.fromEntries(
    Object.entries(raw).flatMap(([name, value]) => {
      const color = toStringSafe(value)
      if (!color) {
        diagnostics.push(`Ignored color group ${name}: expected a color string.`)
        return []
      }

      return [[name, color]]
    })
  )
}

function parseLayoutPositions(
  raw: unknown,
  diagnostics: string[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  if (raw === undefined) {
    return positions
  }

  if (!isRecord(raw)) {
    diagnostics.push("Ignored layout: expected an object.")
    return positions
  }

  const rawTxs = raw.txs
  if (!isRecord(rawTxs)) {
    diagnostics.push("Ignored layout.txs: expected an object.")
    return positions
  }

  Object.entries(rawTxs).forEach(([id, value]) => {
    if (!isRecord(value)) {
      diagnostics.push(`Ignored layout for tx ${id}: expected an object.`)
      return
    }

    const x = normalizeCoordinate(value.x)
    const y = normalizeCoordinate(value.y)
    if (x === undefined || y === undefined) {
      diagnostics.push(`Ignored layout for tx ${id}: expected numeric x and y.`)
      return
    }

    positions.set(id, { x, y })
  })

  return positions
}

function parseTxInput(
  raw: RawTxRef,
  fallback: number,
  defaultSighashFlag?: string
): TxInput | null {
  if (typeof raw === "string") {
    const idx = raw.lastIndexOf(":")
    if (idx === -1) {
      return {
        sourceTxId: raw.trim(),
        sourceOutput: Math.max(0, fallback),
        sighashFlag: defaultSighashFlag,
      }
    }

    const sourceTxId = raw.slice(0, idx).trim()
    const sourceOutput = normalizeSourceIndex(raw.slice(idx + 1), fallback)

    if (!sourceTxId) {
      return null
    }

    return { sourceTxId, sourceOutput, sighashFlag: defaultSighashFlag }
  }

  if (!isRecord(raw)) {
    return null
  }

  const sourceTxId = firstStringSafe(
    raw.tx,
    raw.source,
    raw.sourceTxId,
    raw.source_tx_id
  )
  const label = firstStringSafe(raw.label, raw.text, raw.description, raw.name)
  const sighashFlag =
    firstStringSafe(raw.sighash_flag, raw.sighashFlag, raw.sighash) ??
    defaultSighashFlag
  const spendingPath = firstStringSafe(
    raw.spending_path,
    raw.spendingPath,
    raw.path
  )
  const arrowLabel = firstStringSafe(
    raw.arrow_label,
    raw.arrowLabel,
    raw.arrow_text,
    raw.arrowText
  )
  const colorGroup = firstStringSafe(raw.color, raw.color_group, raw.colorGroup)

  if (!sourceTxId) {
    if (!label) {
      return null
    }

    return {
      label,
      arrowLabel,
      sighashFlag,
      spendingPath,
      colorGroup,
    }
  }

  return {
    sourceTxId,
    sourceOutput: normalizeSourceIndex(
      raw.output as number | string | undefined,
      fallback
    ),
    label,
    arrowLabel,
    sighashFlag,
    spendingPath,
    colorGroup,
  }
}

function slugifyPathId(value: string, fallback: number): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || `path-${fallback + 1}`
}

function parseSpendingPath(
  raw: unknown,
  fallback: number
): TxSpendingPath | null {
  if (typeof raw === "string") {
    const label = raw.trim()
    if (!label) {
      return null
    }

    return {
      id: slugifyPathId(label, fallback),
      label,
    }
  }

  if (!isRecord(raw)) {
    return null
  }

  const label = firstStringSafe(
    raw.label,
    raw.text,
    raw.description,
    raw.name,
    raw.condition
  )
  if (!label) {
    return null
  }

  return {
    id:
      firstStringSafe(raw.id, raw.key, raw.path) ??
      slugifyPathId(label, fallback),
    label,
  }
}

function parseSpendingPaths(values: unknown): TxSpendingPath[] {
  if (!Array.isArray(values)) {
    return []
  }

  return values.flatMap((entry, index) => {
    const parsed = parseSpendingPath(entry, index)
    return parsed ? [parsed] : []
  })
}

function parseTxOutput(raw: RawTxOutput, fallback: number): TxOutput | null {
  if (typeof raw === "string") {
    const label = raw.trim()
    if (!label) {
      return null
    }

    return {
      label,
      spendingPaths: [
        {
          id: "default",
          label,
        },
      ],
    }
  }

  if (!isRecord(raw)) {
    return null
  }

  const label = firstStringSafe(raw.label, raw.text, raw.description, raw.name)
  const amount = toAmountString(raw.amount ?? raw.value)
  const spendingPaths = parseSpendingPaths(
    raw.spending_paths ??
      raw.spendingPaths ??
      raw.paths ??
      raw.spending_conditions ??
      raw.spendingConditions ??
      raw.conditions
  )

  if (!label && !amount && !spendingPaths.length) {
    return null
  }

  return {
    label,
    amount,
    spendingPaths: spendingPaths.length
      ? spendingPaths
      : [
          {
            id: "default",
            label: label ?? `output ${fallback + 1}`,
          },
        ],
  }
}

function parseTxOutputs(
  rawOutputs: unknown,
  diagnostics: string[],
  txId: string
): TxOutput[] {
  if (!Array.isArray(rawOutputs)) {
    return []
  }

  return rawOutputs.flatMap((entry, index) => {
    const parsed = parseTxOutput(entry as RawTxOutput, index)
    if (!parsed) {
      diagnostics.push(
        `Tx ${txId}: ignored malformed output entry at position ${index + 1}`
      )
      return []
    }
    return [parsed]
  })
}

function parseTx(
  raw: RawTxNode,
  diagnostics: string[],
  seen: Set<string>,
  defaultWidth?: number,
  layoutPosition?: { x: number; y: number }
): TxNode | null {
  const id = toStringSafe(raw.id)
  if (!id) {
    diagnostics.push("Skipped tx with invalid or empty id")
    return null
  }

  if (seen.has(id)) {
    diagnostics.push(`Skipped duplicate tx id: ${id}`)
    return null
  }
  seen.add(id)

  const label = toStringSafe(raw.label) ?? id
  const note = toStringSafe(raw.note) ?? undefined
  const description = toStringSafe(raw.description) ?? undefined
  const sighashFlag = firstStringSafe(
    raw.sighash_flag,
    raw.sighashFlag,
    raw.sighash
  )

  const rawInputs = Array.isArray(raw.inputs) ? raw.inputs : []
  const inputs = rawInputs.flatMap((entry, index) => {
    const parsed = parseTxInput(entry as RawTxRef, index, sighashFlag)
    if (!parsed) {
      diagnostics.push(
        `Tx ${id}: ignored malformed input entry at position ${index + 1}`
      )
      return []
    }
    return [parsed]
  })

  return {
    id,
    label,
    note,
    description,
    inputs,
    outputs: parseTxOutputs(raw.outputs, diagnostics, id),
    width:
      normalizePositiveNumber(
        raw.t_shape_width ??
          raw.tShapeWidth ??
          raw.t_width ??
          raw.tWidth ??
          raw.tx_witdh ??
          raw.txWitdh ??
          raw.width
      ) ?? defaultWidth,
    x: layoutPosition?.x ?? normalizeCoordinate(raw.x),
    y: layoutPosition?.y ?? normalizeCoordinate(raw.y),
  }
}

function normalizePathToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function validateGraphReferences(
  nodes: TxNode[],
  colorGroups: Record<string, string>,
  diagnostics: string[]
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  nodes.forEach((node) => {
    node.inputs.forEach((input, index) => {
      if (input.colorGroup && !(input.colorGroup in colorGroups)) {
        diagnostics.push(
          `Tx ${node.id} input ${index + 1}: color group ${input.colorGroup} is not defined.`
        )
      }

      if (!input.sourceTxId) {
        return
      }

      const source = nodeById.get(input.sourceTxId)
      if (!source) {
        diagnostics.push(
          `Tx ${node.id} input ${index + 1}: source tx ${input.sourceTxId} was not found.`
        )
        return
      }

      const outputIndex = input.sourceOutput ?? 0
      const output = source.outputs[outputIndex]
      if (!output) {
        diagnostics.push(
          `Tx ${node.id} input ${index + 1}: source output ${input.sourceTxId}:${outputIndex} was not found.`
        )
        return
      }

      if (!input.spendingPath) {
        return
      }

      const validPathTokens = new Set(
        output.spendingPaths.flatMap((path) => [
          path.id,
          path.label,
          normalizePathToken(path.id),
          normalizePathToken(path.label),
        ])
      )
      if (!validPathTokens.has(input.spendingPath)) {
        diagnostics.push(
          `Tx ${node.id} input ${index + 1}: spending path ${input.spendingPath} was not found on ${input.sourceTxId}:${outputIndex}.`
        )
      }
    })
  })
}

function parseRawTxGraph(
  parsed: RawTxGraph,
  diagnostics: string[]
): ParsedGraphResult {
  const rawTxs = Array.isArray(parsed.txs) ? parsed.txs : []
  const seen = new Set<string>()
  const nodes: TxNode[] = []
  const layoutPositions = parseLayoutPositions(parsed.layout, diagnostics)
  const colorGroups = parseColorGroups(
    parsed.color_groups ?? parsed.colorGroups,
    diagnostics
  )
  const defaultWidth = normalizePositiveNumber(
    parsed.t_shape_width ??
      parsed.tShapeWidth ??
      parsed.t_width ??
      parsed.tWidth ??
      parsed.tx_witdh ??
      parsed.txWitdh ??
      parsed.tx_width ??
      parsed.txWidth
  )

  rawTxs.forEach((entry, index) => {
    if (!isRecord(entry)) {
      diagnostics.push(`Skipped tx at index ${index + 1}: entry is not an object`)
      return
    }

    const parsedNode = parseTx(
      entry as RawTxNode,
      diagnostics,
      seen,
      defaultWidth,
      layoutPositions.get(toStringSafe((entry as RawTxNode).id) ?? "")
    )
    if (!parsedNode) {
      return
    }
    nodes.push(parsedNode)
  })

  if (!nodes.length) {
    diagnostics.push("No valid tx nodes were found in payload.")
  }

  validateGraphReferences(nodes, colorGroups, diagnostics)

  return {
    title: toStringSafe(parsed.title) ?? "Transaction graph",
    nodes,
    colorGroups,
    diagnostics,
    errors: nodes.length ? [] : ["At least one valid tx is required."],
  }
}

function parseYamlMapping(
  source: string,
  label: string,
  diagnostics: string[]
): Record<string, unknown> | null {
  const document = parseDocument(source, { prettyErrors: false })
  if (document.errors.length > 0) {
    diagnostics.push(`${label}: ${document.errors[0]?.message ?? "invalid YAML"}`)
    return null
  }

  const value = document.toJSON()
  if (value === null) {
    return {}
  }

  if (!isRecord(value)) {
    diagnostics.push(`${label}: expected a YAML mapping.`)
    return null
  }

  return value
}

function findBridgeflowFences(
  source: string,
  start = 0,
  end = source.length
): BridgeflowFence[] {
  const fences: BridgeflowFence[] = []
  const fencePattern =
    /^(`{3,}|~{3,})[ \t]*bridgeflow[ \t]*\n([\s\S]*?)^\1[ \t]*$/gim
  const segment = source.slice(start, end)
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(segment)) !== null) {
    const raw = match[0] ?? ""
    const content = match[2] ?? ""
    fences.push({
      content,
      start: start + match.index,
      end: start + match.index + raw.length,
    })
  }

  return fences
}

function extractLayout(
  source: string,
  diagnostics: string[]
): { sourceWithoutLayout: string; layout?: Record<string, unknown> } {
  const match = source.match(BRIDGEFLOW_LAYOUT_BLOCK_PATTERN)
  if (!match) {
    return { sourceWithoutLayout: source }
  }

  const layout = parseYamlMapping(match[1] ?? "", "Layout block", diagnostics)
  return {
    sourceWithoutLayout: source.replace(BRIDGEFLOW_LAYOUT_BLOCK_PATTERN, ""),
    layout: layout ?? undefined,
  }
}

function extractGraphTitle(source: string) {
  const match = source.match(/^#[ \t]+(.+?)[ \t]*$/m)
  return match?.[1] ? stripClosingHeadingHashes(match[1]) : undefined
}

function findTxSections(source: string): TxSection[] {
  TX_HEADING_PATTERN.lastIndex = 0
  const matches = Array.from(source.matchAll(TX_HEADING_PATTERN))

  return matches.flatMap((match, index) => {
    const id = match[1] ? stripClosingHeadingHashes(match[1]) : ""
    if (!id) {
      return []
    }

    const headingEnd = match.index + (match[0]?.length ?? 0)
    const bodyStart =
      source[headingEnd] === "\n" ? headingEnd + 1 : headingEnd
    const nextMatch = matches[index + 1]
    const bodyEnd = nextMatch?.index ?? source.length

    return [{ id, bodyStart, bodyEnd }]
  })
}

function buildRawGraphFromMarkdown(
  source: string,
  diagnostics: string[]
): RawTxGraph {
  const { sourceWithoutLayout, layout } = extractLayout(source, diagnostics)
  const title = extractGraphTitle(sourceWithoutLayout) ?? "Transaction graph"
  const txSections = findTxSections(sourceWithoutLayout)
  const firstTxStart = txSections[0]?.bodyStart ?? sourceWithoutLayout.length
  const graphConfigFence = findBridgeflowFences(
    sourceWithoutLayout,
    0,
    firstTxStart
  )[0]
  const graphConfig = graphConfigFence
    ? parseYamlMapping(graphConfigFence.content, "Graph config", diagnostics)
    : {}

  if (!txSections.length) {
    diagnostics.push("Expected at least one `## tx: <id>` section.")
  }

  const txs = txSections.flatMap((section) => {
    const metadataFence = findBridgeflowFences(
      sourceWithoutLayout,
      section.bodyStart,
      section.bodyEnd
    )[0]

    if (!metadataFence) {
      diagnostics.push(`Tx ${section.id}: missing bridgeflow metadata block.`)
      return []
    }

    const metadata = parseYamlMapping(
      metadataFence.content,
      `Tx ${section.id} metadata`,
      diagnostics
    )
    if (!metadata) {
      return []
    }

    const description = sourceWithoutLayout
      .slice(metadataFence.end, section.bodyEnd)
      .trim()

    return [
      {
        ...metadata,
        id: section.id,
        ...(description ? { description } : {}),
      },
    ]
  })

  return {
    ...(graphConfig ?? {}),
    title,
    txs,
    ...(layout ? { layout } : {}),
  }
}

export function isBridgeFlowMarkdown(source: string) {
  TX_HEADING_PATTERN.lastIndex = 0
  return TX_HEADING_PATTERN.test(normalizeMarkdownSource(source))
}

export function mergeTxLayoutIntoMarkdownSource(
  rawSource: string,
  positions: readonly { id: string; x: number; y: number }[]
) {
  const layoutSource = stringify(
    {
      txs: Object.fromEntries(
        positions.map((position) => [
          position.id,
          {
            x: position.x,
            y: position.y,
          },
        ])
      ),
    },
    { lineWidth: 0 }
  ).trimEnd()
  const layoutBlock = `<!-- bridgeflow:layout\n${layoutSource}\n-->`

  if (BRIDGEFLOW_LAYOUT_BLOCK_PATTERN.test(rawSource)) {
    return rawSource.replace(BRIDGEFLOW_LAYOUT_BLOCK_PATTERN, layoutBlock)
  }

  const separator = rawSource.endsWith("\n") ? "\n" : "\n\n"
  return `${rawSource}${separator}${layoutBlock}\n`
}

export function parseTxGraph(source: string): ParsedGraphResult {
  const diagnostics: string[] = []
  const normalizedSource = normalizeMarkdownSource(source)
  const rawGraph = buildRawGraphFromMarkdown(normalizedSource, diagnostics)

  return parseRawTxGraph(rawGraph, diagnostics)
}
