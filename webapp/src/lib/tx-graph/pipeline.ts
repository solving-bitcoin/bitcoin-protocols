import { createExcalidrawScene } from "@/lib/tx-graph/excalidraw"
import { parseTxGraph } from "@/lib/tx-graph/parse"
import { placeTxGraph } from "@/lib/tx-graph/layout"

function hashSource(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `${hash >>> 0}`
}

export function compileTxGraphToExcalidraw(rawSource: string) {
  const parsed = parseTxGraph(rawSource)
  if (parsed.errors.length > 0) {
    return {
      title: parsed.title,
      elements: [],
      diagnostics: [...parsed.diagnostics, ...parsed.errors],
      errors: parsed.errors,
      signature: `invalid-${hashSource(rawSource)}`,
      valid: false,
    }
  }

  const positioned = placeTxGraph(
    parsed.nodes,
    parsed.title,
    parsed.colorGroups
  )
  const scene = createExcalidrawScene(positioned)

  const mergedDiagnostics = [...parsed.diagnostics, ...scene.diagnostics]
  const mergedErrors = [...parsed.errors, ...scene.errors]

  if (mergedErrors.length > 0) {
    return {
      ...scene,
      title: parsed.title,
      diagnostics: mergedDiagnostics,
      errors: mergedErrors,
      signature: scene.signature || `invalid-${hashSource(rawSource)}`,
      valid: false,
    }
  }

  return {
    ...scene,
    title: parsed.title,
    diagnostics: mergedDiagnostics,
    errors: mergedErrors,
  }
}
