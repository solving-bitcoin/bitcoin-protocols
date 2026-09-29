export type RawTxRef =
  | string
  | {
      tx?: unknown
      source?: unknown
      sourceTxId?: unknown
      source_tx_id?: unknown
      output?: number | string
      label?: unknown
      text?: unknown
      description?: unknown
      name?: unknown
      sighash?: unknown
      sighashFlag?: unknown
      sighash_flag?: unknown
      spendingPath?: unknown
      spending_path?: unknown
      path?: unknown
      arrowLabel?: unknown
      arrow_label?: unknown
      arrowText?: unknown
      arrow_text?: unknown
      color?: unknown
      colorGroup?: unknown
      color_group?: unknown
    }

export type RawTxOutput =
  | string
  | {
      label?: unknown
      text?: unknown
      description?: unknown
      name?: unknown
      amount?: unknown
      value?: unknown
      spendingConditions?: unknown
      spending_conditions?: unknown
      spendingPaths?: unknown
      spending_paths?: unknown
      paths?: unknown
      conditions?: unknown
    }

export interface RawTxNode {
  id?: unknown
  label?: unknown
  note?: unknown
  description?: unknown
  inputs?: unknown
  outputs?: unknown
  sighash?: unknown
  sighashFlag?: unknown
  sighash_flag?: unknown
  width?: unknown
  tWidth?: unknown
  t_width?: unknown
  tShapeWidth?: unknown
  t_shape_width?: unknown
  txWitdh?: unknown
  tx_witdh?: unknown
  x?: unknown
  y?: unknown
}

export interface RawTxGraph {
  title?: unknown
  txs?: unknown
  layout?: unknown
  txWidth?: unknown
  tx_width?: unknown
  tWidth?: unknown
  t_width?: unknown
  tShapeWidth?: unknown
  t_shape_width?: unknown
  txWitdh?: unknown
  tx_witdh?: unknown
  colorGroups?: unknown
  color_groups?: unknown
}

export interface TxInput {
  sourceTxId?: string
  sourceOutput?: number
  label?: string
  arrowLabel?: string
  sighashFlag?: string
  spendingPath?: string
  colorGroup?: string
}

export interface TxSpendingPath {
  id: string
  label: string
}

export interface TxOutput {
  label?: string
  amount?: string
  spendingPaths: TxSpendingPath[]
}

export interface TxNode {
  id: string
  label: string
  note?: string
  description?: string
  inputs: TxInput[]
  outputs: TxOutput[]
  width?: number
  x?: number
  y?: number
}

export interface PositionedTxNode extends TxNode {
  x: number
  y: number
  layer: number
  lane: number
}

export interface ParsedGraphResult {
  title: string
  nodes: TxNode[]
  colorGroups: Record<string, string>
  diagnostics: string[]
  errors: string[]
}

export interface PositionedGraphResult {
  title: string
  nodes: PositionedTxNode[]
  colorGroups: Record<string, string>
  diagnostics: string[]
  errors: string[]
  signature: string
  valid: boolean
}

export interface ExcalidrawRenderResult {
  title: string
  elements: Record<string, unknown>[]
  diagnostics: string[]
  errors: string[]
  signature: string
  valid: boolean
}
