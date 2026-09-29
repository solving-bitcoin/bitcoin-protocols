import type {
  PositionedGraphResult,
  PositionedTxNode,
  TxNode,
  TxInput,
  TxOutput,
} from "@/lib/tx-graph/types"

function hashSource(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `${hash >>> 0}`
}

interface PositionedNodeState {
  node: TxNode
  layer: number
  lane: number
  x: number
  y: number
}

class PriorityQueue<T> {
  private values: T[] = []
  private readonly compare: (left: T, right: T) => number

  constructor(compare: (left: T, right: T) => number) {
    this.compare = compare
  }

  get length() {
    return this.values.length
  }

  push(value: T) {
    this.values.push(value)
    this.bubbleUp(this.values.length - 1)
  }

  pop(): T | undefined {
    const first = this.values[0]
    const last = this.values.pop()

    if (last !== undefined && this.values.length > 0) {
      this.values[0] = last
      this.sinkDown(0)
    }

    return first
  }

  private bubbleUp(index: number) {
    let childIndex = index

    while (childIndex > 0) {
      const parentIndex = Math.floor((childIndex - 1) / 2)
      const child = this.values[childIndex]
      const parent = this.values[parentIndex]

      if (
        child === undefined ||
        parent === undefined ||
        this.compare(child, parent) >= 0
      ) {
        return
      }

      this.values[childIndex] = parent
      this.values[parentIndex] = child
      childIndex = parentIndex
    }
  }

  private sinkDown(index: number) {
    let parentIndex = index

    while (true) {
      const leftIndex = parentIndex * 2 + 1
      const rightIndex = leftIndex + 1
      let nextIndex = parentIndex

      const left = this.values[leftIndex]
      const right = this.values[rightIndex]
      const next = this.values[nextIndex]

      if (
        left !== undefined &&
        next !== undefined &&
        this.compare(left, next) < 0
      ) {
        nextIndex = leftIndex
      }

      const smallest = this.values[nextIndex]
      if (
        right !== undefined &&
        smallest !== undefined &&
        this.compare(right, smallest) < 0
      ) {
        nextIndex = rightIndex
      }

      if (nextIndex === parentIndex) {
        return
      }

      const parent = this.values[parentIndex]
      const child = this.values[nextIndex]
      if (parent === undefined || child === undefined) {
        return
      }

      this.values[parentIndex] = child
      this.values[nextIndex] = parent
      parentIndex = nextIndex
    }
  }
}

function cloneInputs(inputs: TxInput[]): TxInput[] {
  return inputs.map((input) => ({ ...input }))
}

function cloneOutputs(outputs: TxOutput[]): TxOutput[] {
  return outputs.map((output) => ({
    ...output,
    spendingPaths: output.spendingPaths.map((path) => ({ ...path })),
  }))
}

function topologicalOrder(nodes: TxNode[]): {
  order: string[]
  warnings: string[]
} {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))
  const outDegree = new Map<string, string[]>(
    nodes.map((node) => [node.id, []])
  )
  const indegree = new Map(nodes.map((node) => [node.id, 0]))
  const warnings: string[] = []

  for (const node of nodes) {
    for (const input of node.inputs) {
      if (!input.sourceTxId) {
        continue
      }
      if (!nodeById.has(input.sourceTxId)) {
        warnings.push(
          `Warning: ${node.id} references missing tx ${input.sourceTxId}`
        )
        continue
      }
      if (input.sourceTxId === node.id) {
        warnings.push(`Warning: self-reference ignored on ${node.id}`)
        continue
      }
      outDegree.get(input.sourceTxId)?.push(node.id)
      indegree.set(node.id, (indegree.get(node.id) ?? 0) + 1)
    }
  }

  const compareByInputOrder = (left: string, right: string) =>
    (indexById.get(left) ?? 0) - (indexById.get(right) ?? 0)
  const queue = new PriorityQueue<string>(compareByInputOrder)

  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id)
    }
  }

  const order: string[] = []
  const orderedIds = new Set<string>()
  while (queue.length > 0) {
    const id = queue.pop()
    if (!id) {
      break
    }
    order.push(id)
    orderedIds.add(id)

    const children = outDegree.get(id) ?? []
    for (const childId of children) {
      const next = Math.max(0, (indegree.get(childId) ?? 0) - 1)
      indegree.set(childId, next)
      if (next === 0) {
        queue.push(childId)
      }
    }
  }

  if (order.length < nodes.length) {
    warnings.push(
      "Warning: cyclic or disconnected structure detected. Falling back to input order for remaining nodes."
    )
    const remaining = nodes
      .map((node) => node.id)
      .filter((id) => !orderedIds.has(id))
      .sort(compareByInputOrder)
    order.push(...remaining)
  }

  return { order, warnings }
}

function hashGraphStructure(nodes: TxNode[]): string {
  let hash = 2166136261

  const add = (value: string | number | undefined) => {
    const input = String(value ?? "")
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }

  for (const node of nodes) {
    add(node.id)
    add(node.label)
    add(node.note)
    add(node.description)
    add(node.width)
    add(node.x)
    add(node.y)
    for (const input of node.inputs) {
      add(input.sourceTxId)
      add(input.sourceOutput)
      add(input.label)
      add(input.arrowLabel)
      add(input.sighashFlag)
      add(input.spendingPath)
      add(input.colorGroup)
    }
    for (const output of node.outputs) {
      add(output.label)
      add(output.amount)
      for (const path of output.spendingPaths) {
        add(path.id)
        add(path.label)
      }
    }
  }

  return `${hash >>> 0}`
}

function computeLayerMap(
  nodesById: Map<string, TxNode>,
  order: string[]
): Map<string, number> {
  const layerById = new Map<string, number>()

  for (const id of order) {
    const node = nodesById.get(id)
    if (!node) continue

    let layer = 0
    for (const input of node.inputs) {
      if (!input.sourceTxId) {
        continue
      }
      if (!nodesById.has(input.sourceTxId)) {
        continue
      }
      const parentLayer = layerById.get(input.sourceTxId)
      if (parentLayer === undefined) {
        continue
      }
      if (parentLayer + 1 > layer) {
        layer = parentLayer + 1
      }
    }
    layerById.set(id, layer)
  }

  return layerById
}

export function placeTxGraph(
  nodes: TxNode[],
  title = "Transaction graph",
  colorGroups: Record<string, string> = {}
): PositionedGraphResult {
  const diagnostics: string[] = []
  const warnings: string[] = []

  if (!nodes.length) {
    const error = "No tx nodes to place"
    return {
      title,
      nodes: [],
      colorGroups,
      diagnostics: [error],
      errors: [error],
      signature: "empty",
      valid: false,
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const { order, warnings: topoWarnings } = topologicalOrder(nodes)
  warnings.push(...topoWarnings)

  const layerById = computeLayerMap(nodeById, order)

  const lanes = new Map<number, number>()
  const positioned: PositionedNodeState[] = []

  for (const id of order) {
    const node = nodeById.get(id)
    if (!node) continue

    const layer = layerById.get(id) ?? 0
    const lane = lanes.get(layer) ?? 0
    lanes.set(layer, lane + 1)

    const x = typeof node.x === "number" ? node.x : 120 + layer * 520
    const y = typeof node.y === "number" ? node.y : 80 + lane * 340

    positioned.push({
      node,
      layer,
      lane,
      x,
      y,
    })

    node.inputs.forEach((input, index) => {
      if (!input.sourceTxId) {
        return
      }
      if (nodeById.has(input.sourceTxId)) {
        return
      }
      diagnostics.push(
        `Node ${node.id} input ${index + 1} points to unknown tx ${input.sourceTxId}`
      )
    })
  }

  const colorGroupSignature = Object.entries(colorGroups)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, color]) => `${name}:${color}`)
    .join(",")
  const signature = `${order.join(",")}-${nodes.length}-${hashGraphStructure(nodes)}-${hashSource(title)}-${hashSource(colorGroupSignature)}`

  return {
    title,
    nodes: positioned.map(({ node, layer, lane, x, y }) => ({
      ...node,
      inputs: cloneInputs(node.inputs),
      outputs: cloneOutputs(node.outputs),
      x,
      y,
      layer,
      lane,
    })) as PositionedTxNode[],
    colorGroups,
    diagnostics: [...diagnostics, ...warnings],
    errors: [],
    signature,
    valid: true,
  }
}
