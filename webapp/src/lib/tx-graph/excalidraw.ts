import type {
  ExcalidrawRenderResult,
  PositionedGraphResult,
  PositionedTxNode,
  TxOutput,
} from "@/lib/tx-graph/types"

const AUTO_SIDE_TEXT_MIN_WIDTH = 84
const NODE_H_MIN = 156
const NODE_PADDING_X = 10
const NODE_TITLE_Y = 8
const NODE_TITLE_SIZE = 17
const NODE_BAR_Y = 38
const ROW_MIN_HEIGHT = 15
const ROW_CELL_PADDING_Y = 14
const EMPTY_OUTPUT_CELL_HEIGHT = ROW_MIN_HEIGHT
const OUTPUT_LINE_HEIGHT = 15
const OUTPUT_OR_GAP = 18
const NODE_FOOTER_PADDING = 57
const SIGHASH_RECT_PADDING_X = 6
const SIGHASH_RECT_Y_OFFSET = -12
const SIGHASH_RECT_MIN_H = 34
const SIGHASH_SINGLE_ANYONECANPAY = "sighash_single|anyonecanpay"
const SIGHASH_NONE = "sighash_none"
const TEXT_COLOR = "#1e1e1e"
const BG_COLOR = "transparent"
const BOX_STROKE_COLOR = "transparent"
const ROW_LINE_STROKE = "#1e1e1e"
const OR_TEXT_COLOR = "#f08c00"
const DEFAULT_ARROW_COLOR = "#000000"
const ARROW_STROKE_WIDTH = 1
const FIELD_FONT_SIZE = 12
const ROW_TEXT_LEFT_X = 12
const CHAR_WIDTH = 7
const TITLE_CHAR_WIDTH = 12

const COLOR_WORDS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#e03131",
  orange: "#f08c00",
  yellow: "#f59f00",
  green: "#2f9e44",
  blue: "#1971c2",
  purple: "#9c36b5",
  pink: "#d6336c",
  gray: "#868e96",
  grey: "#868e96",
  brown: "#8c6d3f",
  teal: "#0f766e",
  cyan: "#1098ad",
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

interface Point {
  x: number
  y: number
}

interface BoundElementRef {
  id: string
  type: "arrow"
}

interface BindableElement extends Record<string, unknown> {
  id: string
  boundElements: BoundElementRef[]
}

interface Port extends Point {
  element: BindableElement
}

interface OutputPortSet extends Port {
  spendingPaths: Map<string, Port>
}

interface TxPortLayout {
  inputPorts: Port[]
  outputPorts: OutputPortSet[]
}

interface TextRow {
  input?: PositionedTxNode["inputs"][number]
  output?: TxOutput
  inputLabel: string
  labelText: string
  amountText: string
  amountYOffset: number
  outputPaths: OutputPathRow[]
  inputHeight: number
  outputHeight: number
  sighashFlag?: string
}

interface OutputPathRow {
  id: string
  label: string
  yOffset: number
  height: number
}

interface RowMetrics {
  contentHeight: number
  contentY: number
  centerY: number
  bottomLineY: number
  height: number
}

interface TxGraphEdgeBinding {
  startAnchorId: string
  endAnchorId: string
  colorGroup?: string
}

interface TxGraphArrowLabelBinding {
  arrowId: string
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getSideTextWidth(bodyWidth: number): number {
  return Math.max(8, Math.floor(bodyWidth / 2 - ROW_TEXT_LEFT_X * 2))
}

function estimateNaturalTextWidth(value: string): number {
  const longestLine = value
    .split("\n")
    .reduce((max, line) => Math.max(max, line.trim().length), 0)
  return Math.max(8, Math.ceil(longestLine * CHAR_WIDTH))
}

function estimateTitleTextWidth(value: string): number {
  const longestLine = value
    .split("\n")
    .reduce((max, line) => Math.max(max, line.trim().length), 0)
  return Math.max(56, Math.ceil(longestLine * TITLE_CHAR_WIDTH))
}

function estimateTextHeight(value: string, width: number): number {
  const lines = value.split("\n")
  const availableChars = Math.max(1, Math.floor(width / CHAR_WIDTH))
  const wrappedLines = lines.reduce(
    (count, line) =>
      count + Math.max(1, Math.ceil(line.trim().length / availableChars)),
    0
  )
  return Math.max(15, wrappedLines * 15)
}

function estimateTextWidth(value: string, width: number): number {
  return Math.min(width, estimateNaturalTextWidth(value))
}

function makeShapeId(prefix: string, nodeId: string, type: string): string {
  return `${prefix}:${nodeId}:${type}:${hashSeed(`${prefix}${nodeId}${type}`)}`
}

function makeArrowGeometry(from: Point, to: Point) {
  const left = Math.min(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const points: Array<[number, number]> = [
    [from.x - left, from.y - top],
    [to.x - left, to.y - top],
  ]

  return {
    x: left,
    y: top,
    width: Math.max(1, Math.abs(to.x - from.x)),
    height: Math.max(1, Math.abs(to.y - from.y)),
    points,
    lastCommittedPoint: points[points.length - 1],
  }
}

function makeLine(args: {
  id: string
  x: number
  y: number
  p1: Point
  p2: Point
  stroke?: string
  dashed?: boolean
  groupId?: string
}): Record<string, unknown> {
  const { id, p1, p2, stroke = "#334155", dashed = false, groupId } = args
  const left = Math.min(p1.x, p2.x)
  const top = Math.min(p1.y, p2.y)

  return {
    id,
    type: "line",
    x: left,
    y: top,
    width: Math.max(1, Math.abs(p2.x - p1.x)),
    height: Math.max(1, Math.abs(p2.y - p1.y)),
    angle: 0,
    strokeColor: stroke,
    backgroundColor: "transparent",
    fillStyle: dashed ? "dashed" : "solid",
    strokeWidth: dashed ? 1.5 : 1,
    strokeStyle: dashed ? "dashed" : "solid",
    roughness: 0,
    opacity: 100,
    seed: hashSeed(id),
    version: 2,
    versionNonce: hashSeed(`${id}-seed`),
    isDeleted: false,
    groupIds: groupId ? [groupId] : [],
    frameId: null,
    roundness: { type: 3 },
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    points: [
      [p1.x - left, p1.y - top],
      [p2.x - left, p2.y - top],
    ],
    lastCommittedPoint: [p2.x - left, p2.y - top],
    startBinding: null,
    endBinding: null,
    index: null,
  }
}

function makeArrow({
  id,
  from,
  to,
  stroke,
  edgeBinding,
}: {
  id: string
  from: Point
  to: Point
  stroke: string
  edgeBinding: TxGraphEdgeBinding
}): Record<string, unknown> {
  const geometry = makeArrowGeometry(from, to)

  return {
    id,
    type: "arrow",
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: ARROW_STROKE_WIDTH,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    seed: hashSeed(id),
    version: 2,
    versionNonce: hashSeed(`${id}-seed`),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    points: geometry.points,
    lastCommittedPoint: geometry.lastCommittedPoint,
    startArrowhead: null,
    endArrowhead: "arrow",
    startBinding: null,
    endBinding: null,
    elbowed: false,
    customData: {
      txGraphEdge: edgeBinding,
    },
    index: null,
  }
}

function makeArrowLabelPosition({
  from,
  to,
  value,
  width,
}: {
  from: Point
  to: Point
  value: string
  width?: number
}): Point {
  const labelWidth = width ?? Math.max(32, estimateNaturalTextWidth(value))
  const labelHeight = estimateTextHeight(value, labelWidth)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  return {
    x: midX - labelWidth / 2,
    y: midY - labelHeight - 6,
  }
}

function makeText({
  id,
  x,
  y,
  size,
  color,
  value,
  align = "left",
  width,
  groupId,
  customData,
}: {
  id: string
  x: number
  y: number
  size: number
  color: string
  value: string
  align?: "left" | "center"
  width?: number
  groupId?: string
  customData?: Record<string, unknown>
}): BindableElement {
  const resolvedWidth = width ?? Math.max(40, value.length * 6)

  return {
    id,
    type: "text",
    x,
    y,
    width: resolvedWidth,
    height: estimateTextHeight(value, resolvedWidth),
    angle: 0,
    strokeColor: color,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    seed: hashSeed(id),
    version: 2,
    versionNonce: hashSeed(`${id}-seed`),
    isDeleted: false,
    groupIds: groupId ? [groupId] : [],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    fontSize: size,
    fontFamily: 6,
    textAlign: align,
    verticalAlign: "top",
    baseline: size,
    text: value,
    originalText: value,
    autoResize: false,
    lineHeight: 1.2,
    containerId: null,
    customData,
    index: null,
  }
}

function makeArrowLabel({
  id,
  arrowId,
  from,
  to,
  value,
  color,
}: {
  id: string
  arrowId: string
  from: Point
  to: Point
  value: string
  color: string
}): BindableElement {
  const width = Math.max(32, estimateNaturalTextWidth(value))
  const position = makeArrowLabelPosition({ from, to, value, width })

  return makeText({
    id,
    x: position.x,
    y: position.y,
    size: FIELD_FONT_SIZE,
    color,
    value,
    width,
    customData: {
      txGraphArrowLabel: {
        arrowId,
      },
    },
  })
}

function makePortAnchor({
  id,
  center,
  groupId,
}: {
  id: string
  center: Point
  groupId: string
}): BindableElement {
  return {
    id,
    type: "rectangle",
    x: center.x - 1,
    y: center.y - 1,
    width: 2,
    height: 2,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 1,
    seed: hashSeed(id),
    version: 2,
    versionNonce: hashSeed(`${id}-seed`),
    isDeleted: false,
    groupIds: [groupId],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    index: null,
  }
}

function makeRect({
  id,
  x,
  y,
  width,
  height,
  stroke,
  fill,
  strokeStyle = "solid",
  strokeWidth = 1,
  groupId,
}: {
  id: string
  x: number
  y: number
  width: number
  height: number
  stroke: string
  fill: string
  strokeStyle?: "solid" | "dashed" | "dotted"
  strokeWidth?: number
  groupId?: string
}): Record<string, unknown> {
  return {
    id,
    type: "rectangle",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: fill,
    fillStyle: "solid",
    strokeWidth,
    strokeStyle,
    roughness: strokeStyle === "solid" ? 1 : 0,
    opacity: 100,
    seed: hashSeed(id),
    version: 2,
    versionNonce: hashSeed(`${id}-seed`),
    isDeleted: false,
    groupIds: groupId ? [groupId] : [],
    frameId: null,
    roundness: { type: 3 },
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    index: null,
  }
}

function normalizeArrowColor(value: string): string | null {
  const trimmed = value.trim()
  const wordColor = COLOR_WORDS[trimmed.toLowerCase()]
  if (wordColor) {
    return wordColor
  }

  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null
}

function resolveArrowColor(
  colorGroup: string | undefined,
  colorGroups: Record<string, string>,
  diagnostics: string[]
): string {
  if (!colorGroup) {
    return DEFAULT_ARROW_COLOR
  }

  const rawColor = colorGroups[colorGroup]
  if (!rawColor) {
    diagnostics.push(
      `Arrow color group ${colorGroup} was not found; using black.`
    )
    return DEFAULT_ARROW_COLOR
  }

  const color = normalizeArrowColor(rawColor)
  if (!color) {
    diagnostics.push(
      `Arrow color group ${colorGroup} has invalid color ${rawColor}; using black.`
    )
    return DEFAULT_ARROW_COLOR
  }

  return color
}

function formatBtcAmount(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.includes(".")) {
    return trimmed
  }

  return trimmed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

function estimateOutputTextHeight(value: string, width?: number): number {
  return width
    ? estimateTextHeight(value, width)
    : Math.max(OUTPUT_LINE_HEIGHT, value.split("\n").length * OUTPUT_LINE_HEIGHT)
}

function buildOutputDisplay(
  output: TxOutput | undefined,
  textWidth?: number
): {
  labelText: string
  amountText: string
  amountYOffset: number
  paths: OutputPathRow[]
  height: number
} {
  if (!output) {
    return {
      labelText: "",
      amountText: "",
      amountYOffset: 0,
      paths: [],
      height: 0,
    }
  }

  const isLegacyOnlyLine =
    !output.amount &&
    output.label &&
    output.spendingPaths.length === 1 &&
    output.label === output.spendingPaths[0]?.label

  const labelText =
    output.label && !isLegacyOnlyLine ? output.label : ""
  const amountText = output.amount ? `₿ ${formatBtcAmount(output.amount)}` : ""
  const paths: OutputPathRow[] = []

  let nextYOffset = 0
  if (labelText) {
    nextYOffset = estimateOutputTextHeight(labelText, textWidth) + 4
  }

  const amountYOffset = nextYOffset
  const amountHeight = amountText
    ? estimateOutputTextHeight(amountText, textWidth)
    : 0
  if (amountText) {
    nextYOffset = amountYOffset + amountHeight + 4
  }

  output.spendingPaths.forEach((path, pathIndex) => {
    const pathHeight = estimateOutputTextHeight(path.label, textWidth)
    paths.push({
      id: path.id,
      label: path.label,
      yOffset: isLegacyOnlyLine ? 0 : nextYOffset,
      height: pathHeight,
    })
    if (!isLegacyOnlyLine) {
      nextYOffset += pathHeight
      if (pathIndex < output.spendingPaths.length - 1) {
        nextYOffset += OUTPUT_OR_GAP
      }
    }
  })

  const labelHeight = labelText
    ? estimateOutputTextHeight(labelText, textWidth)
    : 0
  const outputHeight = Math.max(
    labelHeight,
    amountText ? amountYOffset + amountHeight : 0,
    paths.length
      ? paths[paths.length - 1].yOffset + paths[paths.length - 1].height
      : labelText
        ? labelHeight
        : 0
  )

  return {
    labelText,
    amountText,
    amountYOffset,
    paths,
    height: outputHeight,
  }
}

function estimateOutputDisplayWidth(output: TxOutput): number {
  const outputDisplay = buildOutputDisplay(output)
  const candidates = [
    outputDisplay.labelText,
    outputDisplay.amountText,
    ...outputDisplay.paths.map((path) => path.label),
  ].filter(Boolean)

  return candidates.reduce(
    (max, value) => Math.max(max, estimateNaturalTextWidth(value)),
    0
  )
}

function resolveNodeBodyWidth(node: PositionedTxNode): number {
  if (node.width) {
    return node.width
  }

  const widestOutput = node.outputs.reduce(
    (max, output) => Math.max(max, estimateOutputDisplayWidth(output)),
    0
  )
  const sideWidth = Math.max(AUTO_SIDE_TEXT_MIN_WIDTH, widestOutput)

  return (sideWidth + ROW_TEXT_LEFT_X * 2) * 2
}

function buildRows(node: PositionedTxNode, textWidth: number): TextRow[] {
  const rowCount = Math.max(1, node.inputs.length, node.outputs.length)
  return Array.from({ length: rowCount }, (_, index) => {
    const input = node.inputs[index]
    const output = node.outputs[index]
    const outputDisplay = buildOutputDisplay(output, textWidth)
    const inputLabel = input?.label ?? ""
    return {
      input,
      output,
      inputLabel,
      labelText: outputDisplay.labelText,
      amountText: outputDisplay.amountText,
      amountYOffset: outputDisplay.amountYOffset,
      outputPaths: outputDisplay.paths,
      inputHeight: inputLabel ? estimateTextHeight(inputLabel, textWidth) : 0,
      outputHeight: outputDisplay.height,
      sighashFlag: input?.sighashFlag,
    }
  })
}

function getRowMetrics(row: TextRow): RowMetrics {
  const inputOnlyEmptyOutputHeight =
    row.input && !row.output ? EMPTY_OUTPUT_CELL_HEIGHT : 0
  const contentHeight = Math.max(
    ROW_MIN_HEIGHT,
    row.inputHeight,
    row.outputHeight,
    inputOnlyEmptyOutputHeight
  )
  const contentY = ROW_CELL_PADDING_Y
  const centerY = contentY + contentHeight / 2
  const bottomLineY = contentY + contentHeight + ROW_CELL_PADDING_Y

  return {
    contentHeight,
    contentY,
    centerY,
    bottomLineY,
    height: bottomLineY,
  }
}

function normalizeSighashFlag(value?: string): string {
  return value?.replace(/\s+/g, "").toLowerCase() ?? ""
}

function usesSingleAnyoneCanPay(value?: string): boolean {
  return normalizeSighashFlag(value) === SIGHASH_SINGLE_ANYONECANPAY
}

function usesSighashNone(value?: string): boolean {
  const normalized = normalizeSighashFlag(value)
  if (!normalized) {
    return false
  }

  return normalized
    .split("|")
    .some((part) => part === SIGHASH_NONE || part.endsWith("_none"))
}

function normalizeSpendingPath(value?: string): string {
  return value?.trim().toLowerCase() ?? ""
}

function pickSpendingPathPort(
  outputPort: OutputPortSet | undefined,
  spendingPath?: string
): Port | undefined {
  if (!outputPort) {
    return undefined
  }

  if (!spendingPath) {
    return outputPort
  }

  return (
    outputPort.spendingPaths.get(spendingPath) ??
    outputPort.spendingPaths.get(normalizeSpendingPath(spendingPath)) ??
    outputPort
  )
}

export function createExcalidrawScene(
  graph: PositionedGraphResult
): ExcalidrawRenderResult {
  if (!graph.valid || !graph.nodes.length) {
    return {
      title: graph.title,
      elements: [],
      diagnostics: [...graph.diagnostics, ...graph.errors],
      errors: graph.errors,
      signature: graph.signature,
      valid: false,
    }
  }

  const elements: Record<string, unknown>[] = []
  const diagnostics = [...graph.diagnostics]
  const nodePorts = new Map<string, TxPortLayout>()

  for (const node of graph.nodes) {
    const txGroupId = `tx:${node.id}`
    const bodyWidth = resolveNodeBodyWidth(node)
    const isInputOnlyNode = node.inputs.length > 0 && node.outputs.length === 0

    if (isInputOnlyNode) {
      const titleWidth = estimateTitleTextWidth(node.label)
      const titleX = node.x
      const titleY = node.y
      const titleHeight = estimateTextHeight(node.label, titleWidth)
      const titleTarget = {
        x: titleX,
        y: titleY + titleHeight / 2,
      }
      const inputPorts = node.inputs.map((_, index) => {
        const inputAnchor = makePortAnchor({
          id: makeShapeId("tx", node.id, `input-anchor-${index}`),
          center: titleTarget,
          groupId: txGroupId,
        })
        elements.push(inputAnchor)
        return {
          ...titleTarget,
          element: inputAnchor,
        }
      })

      elements.push(
        makeText({
          id: makeShapeId("tx", node.id, "title"),
          x: titleX,
          y: titleY,
          size: NODE_TITLE_SIZE,
          color: "#f08c00",
          value: node.label,
          width: titleWidth,
          groupId: txGroupId,
        })
      )

      nodePorts.set(node.id, {
        inputPorts,
        outputPorts: [],
      })
      continue
    }

    const textWidth = getSideTextWidth(bodyWidth)
    const rows = buildRows(node, textWidth)
    const contentBottomY = rows.reduce(
      (acc, row) => {
        const metrics = getRowMetrics(row)
        return {
          height: Math.max(acc.height, acc.cursorY + metrics.bottomLineY),
          cursorY: acc.cursorY + metrics.height,
        }
      },
      { height: NODE_BAR_Y, cursorY: NODE_BAR_Y }
    ).height
    const nodeHeight = Math.max(
      NODE_H_MIN,
      contentBottomY + NODE_FOOTER_PADDING
    )
    const stemBottomY = contentBottomY

    const inputPorts: Port[] = []
    const outputPorts: OutputPortSet[] = []
    const centerLineX = node.x + bodyWidth / 2
    let layoutCursorY = node.y + NODE_BAR_Y
    const rowLayouts = rows.map((row) => {
      const rowMetrics = getRowMetrics(row)
      const layout = {
        row,
        rowMetrics,
        contentY: layoutCursorY + rowMetrics.contentY,
        lineY: layoutCursorY + rowMetrics.bottomLineY,
        cursorY: layoutCursorY,
      }
      layoutCursorY += rowMetrics.height
      return layout
    })

    const hasSighashNoneHighlight = rowLayouts.some(
      ({ row }) => row.input && usesSighashNone(row.sighashFlag)
    )

    if (hasSighashNoneHighlight) {
      const inputLayouts = rowLayouts.filter(({ row }) => row.input)
      const firstInput = inputLayouts[0]
      const lastInput = inputLayouts.at(-1)
      if (firstInput && lastInput) {
        const topY = firstInput.contentY + SIGHASH_RECT_Y_OFFSET
        const bottomY = lastInput.lineY
        elements.push(
          makeRect({
            id: makeShapeId("tx", node.id, "sighash-none"),
            x: node.x + SIGHASH_RECT_PADDING_X,
            y: topY,
            width: centerLineX - node.x - SIGHASH_RECT_PADDING_X * 2,
            height: Math.max(
              SIGHASH_RECT_MIN_H,
              bottomY - topY - SIGHASH_RECT_Y_OFFSET
            ),
            fill: "transparent",
            stroke: ROW_LINE_STROKE,
            strokeStyle: "dotted",
            strokeWidth: 1.5,
            groupId: txGroupId,
          })
        )
      }
    }

    for (let index = 0; index < rowLayouts.length; index += 1) {
      const layout = rowLayouts[index]
      if (!layout) {
        continue
      }
      const { row, rowMetrics, contentY, lineY, cursorY } = layout
      const hasInput = Boolean(row?.input)
      const hasOutput = Boolean(
        row?.labelText || row?.amountText || row?.outputPaths.length
      )
      const rowLeftX = node.x + ROW_TEXT_LEFT_X
      const rowRightX = node.x + bodyWidth / 2 + ROW_TEXT_LEFT_X
      const rowHasContent = hasInput || hasOutput
      const hasFollowingInput = index < node.inputs.length - 1
      const hasFollowingOutput = index < node.outputs.length - 1
      const shouldHighlightSighash =
        hasInput && hasOutput && usesSingleAnyoneCanPay(row?.sighashFlag)

      if (shouldHighlightSighash) {
        elements.push(
          makeRect({
            id: makeShapeId("tx", node.id, `sighash-${index}`),
            x: node.x + SIGHASH_RECT_PADDING_X,
            y: contentY + SIGHASH_RECT_Y_OFFSET,
            width: bodyWidth - SIGHASH_RECT_PADDING_X * 2,
            height:
              Math.max(
                SIGHASH_RECT_MIN_H,
                row?.inputHeight ?? 0,
                row?.outputHeight ?? 0
              ) -
              SIGHASH_RECT_Y_OFFSET * 2,
            fill: "transparent",
            stroke: ROW_LINE_STROKE,
            strokeStyle: "dotted",
            strokeWidth: 1.5,
            groupId: txGroupId,
          })
        )
      }

      if (hasInput) {
        const inputLabel = rows[index]?.inputLabel ?? ""
        const inputWidth = estimateTextWidth(inputLabel, textWidth)
        const inputPort = inputLabel
          ? {
              x: rowLeftX,
              y: contentY + 10,
            }
          : {
              x: node.x + bodyWidth / 4,
              y: cursorY + rowMetrics.centerY,
            }
        const inputElement = makeText({
          id: makeShapeId("tx", node.id, `input-${index}`),
          x: rowLeftX,
          y: contentY,
          size: FIELD_FONT_SIZE,
          color: TEXT_COLOR,
          value: inputLabel,
          width: inputWidth,
          groupId: txGroupId,
        })
        const inputAnchor = makePortAnchor({
          id: makeShapeId("tx", node.id, `input-anchor-${index}`),
          center: inputPort,
          groupId: txGroupId,
        })
        inputPorts.push({
          ...inputPort,
          element: inputAnchor,
        })
        elements.push(inputAnchor)
        if (inputLabel) {
          elements.push(inputElement)
        }
        if (rowHasContent && hasFollowingInput) {
          elements.push(
            makeLine({
              id: makeShapeId("tx", node.id, `inline-${index}`),
              x: rowLeftX,
              y: lineY,
              p1: {
                x: rowLeftX,
                y: lineY,
              },
              p2: {
                x: centerLineX,
                y: lineY,
              },
              stroke: ROW_LINE_STROKE,
              groupId: txGroupId,
            })
          )
        }
      }

      if (hasOutput) {
        const spendingPathPorts = new Map<string, Port>()
        if (row?.labelText) {
          elements.push(
            makeText({
              id: makeShapeId("tx", node.id, `output-label-${index}`),
              x: rowRightX,
              y: contentY,
              size: FIELD_FONT_SIZE,
              color: TEXT_COLOR,
              value: row.labelText,
              width: estimateTextWidth(row.labelText, textWidth),
              groupId: txGroupId,
            })
          )
        }
        if (row?.amountText) {
          elements.push(
            makeText({
              id: makeShapeId("tx", node.id, `output-amount-${index}`),
              x: rowRightX,
              y: contentY + row.amountYOffset,
              size: FIELD_FONT_SIZE,
              color: TEXT_COLOR,
              value: row.amountText,
              width: estimateTextWidth(row.amountText, textWidth),
              groupId: txGroupId,
            })
          )
        }
        row?.outputPaths.forEach((path, pathIndex) => {
          if (pathIndex > 0) {
            elements.push(
              makeText({
                id: makeShapeId("tx", node.id, `output-or-${index}-${path.id}`),
                x: rowRightX,
                y: contentY + path.yOffset - OUTPUT_OR_GAP,
                size: FIELD_FONT_SIZE,
                color: OR_TEXT_COLOR,
                value: "OR",
                width: 18,
                groupId: txGroupId,
              })
            )
          }
          const outputPort = {
            x: rowRightX + estimateTextWidth(path.label, textWidth),
            y: contentY + path.yOffset + 10,
          }
          const outputAnchor = makePortAnchor({
            id: makeShapeId("tx", node.id, `output-anchor-${index}-${path.id}`),
            center: outputPort,
            groupId: txGroupId,
          })
          elements.push(
            makeText({
              id: makeShapeId("tx", node.id, `output-path-${index}-${path.id}`),
              x: rowRightX,
              y: contentY + path.yOffset,
              size: FIELD_FONT_SIZE,
              color: TEXT_COLOR,
              value: path.label,
              width: estimateTextWidth(path.label, textWidth),
              groupId: txGroupId,
            })
          )
          const port = {
            ...outputPort,
            element: outputAnchor,
          }
          spendingPathPorts.set(path.id, port)
          spendingPathPorts.set(path.label, port)
          spendingPathPorts.set(normalizeSpendingPath(path.id), port)
          spendingPathPorts.set(normalizeSpendingPath(path.label), port)
          elements.push(outputAnchor)
        })
        const outputPort =
          spendingPathPorts.values().next().value ??
          ({
            x: rowRightX,
            y: cursorY + rowMetrics.centerY,
            element: makePortAnchor({
              id: makeShapeId("tx", node.id, `output-anchor-${index}`),
              center: {
                x: rowRightX,
                y: cursorY + rowMetrics.centerY,
              },
              groupId: txGroupId,
            }),
          } satisfies Port)
        if (!spendingPathPorts.size) {
          elements.push(outputPort.element)
        }
        outputPorts.push({
          ...outputPort,
          spendingPaths: spendingPathPorts,
        })
        if (rowHasContent && hasFollowingOutput) {
          elements.push(
            makeLine({
              id: makeShapeId("tx", node.id, `outline-${index}`),
              x: rowRightX,
              y: lineY,
              p1: {
                x: centerLineX,
                y: lineY,
              },
              p2: {
                x: node.x + bodyWidth - ROW_TEXT_LEFT_X,
                y: lineY,
              },
              stroke: ROW_LINE_STROKE,
              groupId: txGroupId,
            })
          )
        }
      }
    }

    const bodyX = node.x
    const bodyY = node.y

    elements.push(
      makeRect({
        id: makeShapeId("tx", node.id, "body"),
        x: bodyX,
        y: bodyY,
        width: bodyWidth,
        height: nodeHeight,
        fill: BG_COLOR,
        stroke: BOX_STROKE_COLOR,
        groupId: txGroupId,
      }),
      makeLine({
        id: makeShapeId("tx", node.id, "top-bar"),
        x: bodyX,
        y: bodyY + NODE_BAR_Y,
        p1: {
          x: bodyX,
          y: bodyY + NODE_BAR_Y,
        },
        p2: {
          x: bodyX + bodyWidth,
          y: bodyY + NODE_BAR_Y,
        },
        stroke: ROW_LINE_STROKE,
        groupId: txGroupId,
      }),
      makeLine({
        id: makeShapeId("tx", node.id, "stem"),
        x: bodyX,
        y: bodyY + NODE_BAR_Y,
        p1: {
          x: bodyX + bodyWidth / 2,
          y: bodyY + NODE_BAR_Y,
        },
        p2: {
          x: bodyX + bodyWidth / 2,
          y: bodyY + stemBottomY,
        },
        stroke: ROW_LINE_STROKE,
        groupId: txGroupId,
      }),
      makeText({
        id: makeShapeId("tx", node.id, "title"),
        x: bodyX + NODE_PADDING_X,
        y: bodyY + NODE_TITLE_Y,
        size: NODE_TITLE_SIZE,
        color: "#f08c00",
        value: node.label,
        align: "center",
        width: bodyWidth - NODE_PADDING_X * 2,
        groupId: txGroupId,
      })
    )

    if (node.note) {
      elements.push(
        makeText({
          id: makeShapeId("tx", node.id, "note"),
          x: bodyX + NODE_PADDING_X,
          y: bodyY + nodeHeight - 24,
          size: 11,
          color: TEXT_COLOR,
          value: node.note,
          width: bodyWidth - NODE_PADDING_X * 2,
          groupId: txGroupId,
        })
      )
    }

    nodePorts.set(node.id, {
      inputPorts,
      outputPorts,
    })
  }

  for (const node of graph.nodes) {
    const fromPorts = nodePorts.get(node.id)
    if (!fromPorts) continue

    node.inputs.forEach((input, index) => {
      if (!input.sourceTxId) {
        return
      }

      const source = nodePorts.get(input.sourceTxId)
      if (!source) {
        return
      }

      const sourceOutputPort =
        source.outputPorts[input.sourceOutput ?? 0] ?? source.outputPorts.at(-1)
      const sourcePort = pickSpendingPathPort(
        sourceOutputPort,
        input.spendingPath
      )
      const targetPort =
        fromPorts.inputPorts[index] ?? fromPorts.inputPorts.at(-1)
      if (!sourcePort || !targetPort) {
        return
      }

      const arrowId = `edge:${input.sourceTxId}->${node.id}:${index}`
      const arrowColor = resolveArrowColor(
        input.colorGroup,
        graph.colorGroups,
        diagnostics
      )
      const from = {
        x: sourcePort.x,
        y: sourcePort.y,
      }
      const to = {
        x: targetPort.x,
        y: targetPort.y,
      }
      elements.push(
        makeArrow({
          id: arrowId,
          from,
          to,
          stroke: arrowColor,
          edgeBinding: {
            startAnchorId: sourcePort.element.id,
            endAnchorId: targetPort.element.id,
            colorGroup: input.colorGroup,
          },
        })
      )
      if (input.arrowLabel) {
        elements.push(
          makeArrowLabel({
            id: `edge-label:${input.sourceTxId}->${node.id}:${index}`,
            arrowId,
            from,
            to,
            value: input.arrowLabel,
            color: arrowColor,
          })
        )
      }
    })
  }

  return {
    title: graph.title,
    elements,
    diagnostics,
    errors: graph.errors,
    signature: graph.signature,
    valid: graph.valid,
  }
}

function readTxGraphEdgeBinding(
  element: Record<string, unknown>
): TxGraphEdgeBinding | null {
  const customData = element.customData
  if (!customData || typeof customData !== "object") {
    return null
  }

  const edge = (customData as Record<string, unknown>).txGraphEdge
  if (!edge || typeof edge !== "object") {
    return null
  }

  const startAnchorId = (edge as Record<string, unknown>).startAnchorId
  const endAnchorId = (edge as Record<string, unknown>).endAnchorId
  const colorGroup = (edge as Record<string, unknown>).colorGroup
  if (typeof startAnchorId !== "string" || typeof endAnchorId !== "string") {
    return null
  }

  return {
    startAnchorId,
    endAnchorId,
    colorGroup: typeof colorGroup === "string" ? colorGroup : undefined,
  }
}

function readTxGraphArrowLabelBinding(
  element: Record<string, unknown>
): TxGraphArrowLabelBinding | null {
  const customData = element.customData
  if (!customData || typeof customData !== "object") {
    return null
  }

  const label = (customData as Record<string, unknown>).txGraphArrowLabel
  if (!label || typeof label !== "object") {
    return null
  }

  const arrowId = (label as Record<string, unknown>).arrowId
  return typeof arrowId === "string" ? { arrowId } : null
}

function readElementCenter(element: Record<string, unknown> | undefined) {
  if (!element) {
    return null
  }

  const { x, y, width, height } = element
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null
  }

  return {
    x: x + width / 2,
    y: y + height / 2,
  }
}

function numbersEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001
}

function pointsEqual(left: unknown, right: Array<[number, number]>): boolean {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every(
      (point, index) =>
        Array.isArray(point) &&
        numbersEqual(point[0], right[index][0]) &&
        numbersEqual(point[1], right[index][1])
    )
  )
}

function arrowGeometryMatches(
  element: Record<string, unknown>,
  geometry: ReturnType<typeof makeArrowGeometry>
): boolean {
  return (
    numbersEqual(element.x as number, geometry.x) &&
    numbersEqual(element.y as number, geometry.y) &&
    numbersEqual(element.width as number, geometry.width) &&
    numbersEqual(element.height as number, geometry.height) &&
    pointsEqual(element.points, geometry.points)
  )
}

export function syncTxGraphArrowAttachments<T extends Record<string, unknown>>(
  elements: readonly T[]
): readonly T[] {
  const elementsById = new Map(
    elements
      .filter((element) => typeof element.id === "string")
      .map((element) => [element.id as string, element])
  )
  const labelAnchorsByArrowId = new Map<string, { from: Point; to: Point }>()
  let changed = false

  const arrowSyncedElements = elements.map((element) => {
    if (element.type !== "arrow") {
      return element
    }

    const edgeBinding = readTxGraphEdgeBinding(element)
    if (!edgeBinding) {
      return element
    }

    const start = readElementCenter(elementsById.get(edgeBinding.startAnchorId))
    const end = readElementCenter(elementsById.get(edgeBinding.endAnchorId))
    if (!start || !end) {
      return element
    }

    if (typeof element.id === "string") {
      labelAnchorsByArrowId.set(element.id, { from: start, to: end })
    }

    const geometry = makeArrowGeometry(start, end)
    if (arrowGeometryMatches(element, geometry)) {
      return element
    }

    changed = true
    const version =
      typeof element.version === "number" ? element.version + 1 : 2
    return {
      ...element,
      ...geometry,
      startBinding: null,
      endBinding: null,
      version,
      versionNonce: hashSeed(
        `${element.id}:${version}:${geometry.x}:${geometry.y}:${geometry.width}:${geometry.height}`
      ),
      updated: Date.now(),
    }
  })

  const nextElements = arrowSyncedElements.map((element) => {
    if (element.type !== "text") {
      return element
    }

    const labelBinding = readTxGraphArrowLabelBinding(element)
    if (!labelBinding) {
      return element
    }

    const anchors = labelAnchorsByArrowId.get(labelBinding.arrowId)
    const value =
      typeof element.text === "string"
        ? element.text
        : typeof element.originalText === "string"
          ? element.originalText
          : ""
    const width =
      typeof element.width === "number"
        ? element.width
        : Math.max(32, estimateNaturalTextWidth(value))
    if (!anchors || !value) {
      return element
    }

    const position = makeArrowLabelPosition({
      ...anchors,
      value,
      width,
    })
    if (
      typeof element.x === "number" &&
      typeof element.y === "number" &&
      numbersEqual(element.x, position.x) &&
      numbersEqual(element.y, position.y)
    ) {
      return element
    }

    changed = true
    const version =
      typeof element.version === "number" ? element.version + 1 : 2
    return {
      ...element,
      x: position.x,
      y: position.y,
      version,
      versionNonce: hashSeed(
        `${element.id}:${version}:${position.x}:${position.y}`
      ),
      updated: Date.now(),
    }
  })

  return changed ? nextElements : elements
}
