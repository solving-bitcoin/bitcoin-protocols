import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react"
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import {
  Bitcoin,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Download,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Link,
  Maximize2,
  PanelLeft,
  Play,
  Save,
  TriangleAlert,
  X,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { parseDocument } from "yaml"
import "@excalidraw/excalidraw/index.css"
import "katex/dist/katex.min.css"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { compileTxGraphToExcalidraw } from "@/lib/tx-graph/pipeline"
import { syncTxGraphArrowAttachments } from "@/lib/tx-graph/excalidraw"
import {
  isBridgeFlowMarkdown,
  mergeTxLayoutIntoMarkdownSource,
  parseTxGraph,
} from "@/lib/tx-graph/parse"
import {
  createDefaultWorkspace,
  createDefaultWorkspaceZipBlob,
  DEFAULT_BUNDLED_GRAPH_PATH,
  DEFAULT_WORKSPACE_ZIP_NAME,
  findFileByPath,
  findFirstFile,
  getWorkspaceEntriesSignature,
  readDirectoryWorkspace,
  supportsFileSystemAccess,
  type DirectoryPickerWindow,
  type Workspace,
  type WorkspaceFileEntry,
  type WorkspaceTreeEntry,
} from "@/lib/workspace"
import {
  clearDefaultWorkspaceLink,
  createDefaultWorkspaceLink,
  readDefaultWorkspaceLink,
  type WorkspaceHistoryMode,
} from "@/lib/workspace-links"

const ExcalidrawCanvas = lazy(async () => {
  const { Excalidraw } = await import("@excalidraw/excalidraw")
  return { default: Excalidraw }
})

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    saveAsImage: false,
    loadScene: false,
    saveToActiveFile: false,
    clearCanvas: false,
    changeViewBackgroundColor: false,
    toggleTheme: false,
    import: false,
    export: false,
    resetZoom: false,
  },
  tools: {
    image: false,
  },
} as const

const APP_NAME = "BridgeFlow"
const APP_TAGLINE = "Bitcoin bridge transaction map"
const GRAPH_VIEWPORT_ZOOM_FACTOR = 0.95
const LOCAL_WORKSPACE_SYNC_INTERVAL_MS = 1500
const SIDEBAR_DEFAULT_WIDTH = 400
const SIDEBAR_MIN_WIDTH = 280
const SIDEBAR_MAX_WIDTH = 720
const BRIDGEFLOW_LAYOUT_BLOCK_PATTERN =
  /<!--\s*bridgeflow:layout[ \t]*\n[\s\S]*?\n?-->/gi
const BRIDGEFLOW_FENCE_PATTERN =
  /^(`{3,}|~{3,})[ \t]*bridgeflow[ \t]*\n([\s\S]*?)^\1[ \t]*$/gim
const TX_HEADING_PATTERN = /^##[ \t]+tx:[ \t]*(.+?)[ \t]*$/im
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

interface CompiledSceneState {
  title: string
  elements: ExcalidrawElement[]
  diagnostics: string[]
  signature: string
  valid: boolean
}

interface TxLayoutPosition {
  id: string
  x: number
  y: number
}

interface BridgeflowFence {
  content: string
  start: number
  end: number
}

interface ColorGuideItem {
  name: string
  color: string
  rawColor: string
}

interface PreparedMarkdownReader {
  source: string
  colorGuide: ColorGuideItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeGuideColor(value: string) {
  const trimmed = value.trim()
  const wordColor = COLOR_WORDS[trimmed.toLowerCase()]
  if (wordColor) {
    return wordColor
  }

  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : trimmed
}

function parseBridgeflowMapping(source: string) {
  try {
    const document = parseDocument(source, { prettyErrors: false })
    if (document.errors.length > 0) {
      return null
    }

    const value = document.toJSON()
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function findGraphConfigFence(source: string): BridgeflowFence | null {
  const firstTxStart = source.match(TX_HEADING_PATTERN)?.index ?? source.length
  const segment = source.slice(0, firstTxStart)
  BRIDGEFLOW_FENCE_PATTERN.lastIndex = 0
  const match = BRIDGEFLOW_FENCE_PATTERN.exec(segment)

  if (!match) {
    return null
  }

  return {
    content: match[2] ?? "",
    start: match.index,
    end: match.index + (match[0]?.length ?? 0),
  }
}

function parseColorGuide(content: string): ColorGuideItem[] {
  const mapping = parseBridgeflowMapping(content)
  const colorGroups = mapping?.color_groups ?? mapping?.colorGroups
  if (!isRecord(colorGroups)) {
    return []
  }

  return Object.entries(colorGroups).flatMap(([name, value]) => {
    if (typeof value !== "string" || !value.trim()) {
      return []
    }

    const rawColor = value.trim()
    return [
      {
        name,
        rawColor,
        color: normalizeGuideColor(rawColor),
      },
    ]
  })
}

function formatColorGuideName(name: string) {
  return name.replace(/[_-]+/g, " ")
}

function buildSceneConfig(elements: readonly ExcalidrawElement[]) {
  return JSON.stringify(
    {
      type: "excalidraw/clipboard",
      elements,
      files: {},
    },
    null,
    2
  )
}

function extractTxLayoutPositions(
  elements: readonly ExcalidrawElement[]
): TxLayoutPosition[] {
  const positionsById = new Map<string, TxLayoutPosition>()

  elements.forEach((element) => {
    const match = element.id.match(/^tx:(.+):body:[^:]+$/)
    if (!match?.[1]) {
      return
    }

    positionsById.set(match[1], {
      id: match[1],
      x: Math.round(element.x),
      y: Math.round(element.y),
    })
  })

  elements.forEach((element) => {
    const match = element.id.match(/^tx:(.+):title:[^:]+$/)
    if (!match?.[1] || positionsById.has(match[1])) {
      return
    }

    positionsById.set(match[1], {
      id: match[1],
      x: Math.round(element.x),
      y: Math.round(element.y),
    })
  })

  return Array.from(positionsById.values()).sort((left, right) =>
    left.id.localeCompare(right.id)
  )
}

function compileSceneState(rawSource: string): CompiledSceneState {
  const result = compileTxGraphToExcalidraw(rawSource)
  const elements = result.elements as ExcalidrawElement[]

  return {
    title: result.title,
    elements,
    diagnostics: result.diagnostics,
    signature: result.signature,
    valid: result.valid,
  }
}

function createEmptySceneState(): CompiledSceneState {
  return {
    title: "No graph",
    elements: [],
    diagnostics: [],
    signature: "empty",
    valid: false,
  }
}

function syncVisibleScene(
  api: ExcalidrawImperativeAPI,
  elements: readonly ExcalidrawElement[],
  isCompact = false
) {
  api.updateScene({ elements })
  if (elements.length === 0) {
    return
  }

  window.requestAnimationFrame(() => {
    api.scrollToContent(elements, {
      fitToViewport: true,
      viewportZoomFactor: isCompact ? 0.8 : GRAPH_VIEWPORT_ZOOM_FACTOR,
      minZoom: 0.01,
      maxZoom: isCompact ? 1.2 : 1,
      animate: false,
    })
    api.refresh()
  })
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(max-width: 960px)")
    const handleChange = () => {
      setIsMobile(query.matches)
    }

    handleChange()
    query.addEventListener("change", handleChange)

    return () => query.removeEventListener("change", handleChange)
  }, [])

  return isMobile
}

interface ExcalidrawHostProps {
  elements: ExcalidrawElement[]
  isCompact?: boolean
  onApi: (api: ExcalidrawImperativeAPI | null) => void
  onChange: (elements: readonly ExcalidrawElement[]) => void
}

const ExcalidrawHost = memo(function ExcalidrawHost({
  elements,
  isCompact = false,
  onApi,
  onChange,
}: ExcalidrawHostProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const hasLoadedInitialDataRef = useRef(false)
  const isSyncingAttachmentsRef = useRef(false)

  const handleApi = useCallback(
    (nextApi: ExcalidrawImperativeAPI | null) => {
      setApi(nextApi)
      onApi(nextApi)
    },
    [onApi]
  )

  const handleChange = useCallback(
    (nextElements: readonly ExcalidrawElement[]) => {
      const syncedElements = syncTxGraphArrowAttachments(nextElements)
      onChange(syncedElements as readonly ExcalidrawElement[])

      if (
        api &&
        syncedElements !== nextElements &&
        !isSyncingAttachmentsRef.current
      ) {
        isSyncingAttachmentsRef.current = true
        api.updateScene({
          elements: syncedElements as readonly ExcalidrawElement[],
        })
        window.requestAnimationFrame(() => {
          isSyncingAttachmentsRef.current = false
        })
      }
    },
    [api, onChange]
  )

  useEffect(() => {
    if (!api) {
      return
    }

    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current)
    }

    const syncDelay = hasLoadedInitialDataRef.current ? 80 : 500
    hasLoadedInitialDataRef.current = true
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null
      syncVisibleScene(api, elements, isCompact)
    }, syncDelay)

    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [api, elements, isCompact])

  return (
    <div className="excalidraw-host h-full w-full">
      <Suspense
        fallback={
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading canvas...
          </div>
        }
      >
        <ExcalidrawCanvas
          excalidrawAPI={handleApi}
          UIOptions={EXCALIDRAW_UI_OPTIONS}
          theme="light"
          renderTopRightUI={() => null}
          zenModeEnabled={!isCompact}
          handleKeyboardGlobally={false}
          initialData={{ elements, scrollToContent: true }}
          onChange={handleChange}
        />
      </Suspense>
    </div>
  )
})

function fileIconFor(entry: WorkspaceFileEntry) {
  if (entry.type === "json") {
    return <FileJson />
  }

  return <FileText />
}

interface FileTreeProps {
  entries: WorkspaceTreeEntry[]
  activePath?: string
  onOpenFile: (entry: WorkspaceFileEntry) => void
}

function FileTree({ entries, activePath, onOpenFile }: FileTreeProps) {
  if (entries.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No files found.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-2">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          activePath={activePath}
          depth={0}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  )
}

interface FileTreeNodeProps {
  entry: WorkspaceTreeEntry
  activePath?: string
  depth: number
  onOpenFile: (entry: WorkspaceFileEntry) => void
}

function FileTreeNode({
  entry,
  activePath,
  depth,
  onOpenFile,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)

  if (entry.kind === "directory") {
    const FolderIcon = expanded ? FolderOpen : Folder

    return (
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          className="flex h-9 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:h-7"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
          <FolderIcon />
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded ? (
          <div className="flex flex-col gap-0.5">
            {entry.children.map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                activePath={activePath}
                depth={depth + 1}
                onOpenFile={onOpenFile}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const selected = entry.path === activePath

  return (
    <button
      type="button"
      className={`flex h-9 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs md:h-7 ${
        selected
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted"
      }`}
      style={{ paddingLeft: `${24 + depth * 14}px` }}
      onClick={() => onOpenFile(entry)}
    >
      {fileIconFor(entry)}
      <span className="truncate">{entry.name}</span>
    </button>
  )
}

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))
}

function updateWorkspaceUrl(url: URL, mode: WorkspaceHistoryMode) {
  if (mode === "none" || url.href === window.location.href) return
  if (mode === "replace") {
    window.history.replaceState(null, "", url)
  } else {
    window.history.pushState(null, "", url)
  }
}

function prepareMarkdownForReader(source: string) {
  const sourceWithoutLayout = source.replace(
    BRIDGEFLOW_LAYOUT_BLOCK_PATTERN,
    ""
  )
  const graphConfigFence = findGraphConfigFence(sourceWithoutLayout)
  const colorGuide = graphConfigFence
    ? parseColorGuide(graphConfigFence.content)
    : []
  const readerSource =
    graphConfigFence && colorGuide.length > 0
      ? `${sourceWithoutLayout.slice(
          0,
          graphConfigFence.start
        )}${sourceWithoutLayout.slice(graphConfigFence.end)}`
      : sourceWithoutLayout

  return {
    source: readerSource.replace(/\n{3,}/g, "\n\n").trim(),
    colorGuide,
  } satisfies PreparedMarkdownReader
}

function ColorGuide({ items }: { items: ColorGuideItem[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="mb-5 rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Color guide
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
          >
            <span
              className="size-3 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: item.color }}
            />
            <span className="capitalize">
              {formatColorGuideName(item.name)}
            </span>
            <code className="text-[0.72rem] text-muted-foreground">
              {item.rawColor}
            </code>
          </div>
        ))}
      </div>
    </section>
  )
}

function MarkdownPreview({
  source,
  className = "",
  fill = true,
}: {
  source: string
  className?: string
  fill?: boolean
}) {
  const reader = useMemo(() => prepareMarkdownForReader(source), [source])
  const layoutClass = fill ? "h-full overflow-auto" : "h-auto overflow-visible"

  return (
    <article
      className={`markdown-preview ${layoutClass} bg-card p-4 sm:p-6 ${className}`}
    >
      <ColorGuide items={reader.colorGuide} />
      {reader.source ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {reader.source}
        </ReactMarkdown>
      ) : (
        <p>No markdown content.</p>
      )}
    </article>
  )
}

export function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [activeFile, setActiveFile] = useState<WorkspaceFileEntry | null>(null)
  const [source, setSource] = useState("")
  const [compiledScene, setCompiledScene] = useState(createEmptySceneState)
  const [sceneVersion, setSceneVersion] = useState(0)
  const [txLayoutPositions, setTxLayoutPositions] = useState<
    TxLayoutPosition[]
  >([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<"files" | "reader">("files")
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [mobileFilesOpen, setMobileFilesOpen] = useState(false)
  const [workspaceStatus, setWorkspaceStatus] = useState("")
  const [shareLink, setShareLink] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false)

  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const liveElementsRef = useRef<ExcalidrawElement[]>([])
  const compiledElementsRef = useRef<ExcalidrawElement[]>([])
  const workspaceRef = useRef<Workspace | null>(null)
  const activeFileRef = useRef<WorkspaceFileEntry | null>(null)
  const sourceRef = useRef("")
  const workspaceSignatureRef = useRef("")
  const isWritingFileRef = useRef(false)
  const savedLayoutRef = useRef("")
  const fileOpenRequestRef = useRef(0)
  const workspaceLoadRequestRef = useRef(0)
  const isMobile = useIsMobile()

  const isMarkdownFile = activeFile?.type === "markdown"
  const isGraphMarkdown = useMemo(
    () => isMarkdownFile && isBridgeFlowMarkdown(source),
    [isMarkdownFile, source]
  )
  const sceneDiagnostics = useMemo(
    () => compiledScene.diagnostics.slice(0, 8),
    [compiledScene.diagnostics]
  )
  const graphTransactions = useMemo(
    () => (isGraphMarkdown ? parseTxGraph(source).nodes : []),
    [isGraphMarkdown, source]
  )

  const applyScene = useCallback((nextScene: CompiledSceneState) => {
    compiledElementsRef.current = nextScene.elements
    liveElementsRef.current = nextScene.elements
    const positions = extractTxLayoutPositions(nextScene.elements)
    savedLayoutRef.current = JSON.stringify(positions)
    setHasLayoutChanges(false)
    setTxLayoutPositions(positions)
    setCompiledScene(nextScene)
    setSceneVersion((version) => version + 1)
  }, [])

  const runCompile = useCallback(
    (rawSource: string) => {
      applyScene(compileSceneState(rawSource))
    },
    [applyScene]
  )

  const handleSidebarResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = sidebarWidth

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setSidebarWidth(
          clampSidebarWidth(startWidth + moveEvent.clientX - startX)
        )
      }

      const handlePointerUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    [sidebarWidth]
  )

  const handleSidebarResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return
      }

      event.preventDefault()
      const delta = event.key === "ArrowLeft" ? -24 : 24
      setSidebarWidth((current) => clampSidebarWidth(current + delta))
    },
    []
  )

  useEffect(() => {
    workspaceRef.current = workspace
    workspaceSignatureRef.current = workspace
      ? getWorkspaceEntriesSignature(workspace.entries)
      : ""
  }, [workspace])

  useEffect(() => {
    activeFileRef.current = activeFile
  }, [activeFile])

  useEffect(() => {
    sourceRef.current = source
  }, [source])

  const openFileEntry = useCallback(
    async (
      entry: WorkspaceFileEntry,
      historyMode: WorkspaceHistoryMode = "push"
    ) => {
      const request = ++fileOpenRequestRef.current
      try {
        const nextSource = await entry.read()
        if (request !== fileOpenRequestRef.current) return
        sourceRef.current = nextSource
        activeFileRef.current = entry
        setActiveFile(entry)
        setSource(nextSource)
        setSidebarMode("reader")
        setMobileFilesOpen(false)
        setShareLink("")
        setWorkspaceStatus(`Opened ${entry.name}`)
        if (workspaceRef.current?.isDefault) {
          updateWorkspaceUrl(
            createDefaultWorkspaceLink(
              new URL(window.location.href),
              entry.path
            ),
            historyMode
          )
        }

        if (entry.type === "markdown" && isBridgeFlowMarkdown(nextSource)) {
          runCompile(nextSource)
        } else {
          applyScene(createEmptySceneState())
        }
      } catch {
        if (request === fileOpenRequestRef.current) {
          setWorkspaceStatus(`Could not open ${entry.name}`)
        }
      }
    },
    [applyScene, runCompile]
  )

  const openWorkspace = useCallback(
    async (
      nextWorkspace: Workspace,
      filePath?: string | null,
      historyMode: WorkspaceHistoryMode = "push"
    ) => {
      ++fileOpenRequestRef.current
      setWorkspace(nextWorkspace)
      workspaceRef.current = nextWorkspace
      workspaceSignatureRef.current = getWorkspaceEntriesSignature(
        nextWorkspace.entries
      )
      setSidebarCollapsed(false)
      setSidebarMode("files")
      setActiveFile(null)
      activeFileRef.current = null
      sourceRef.current = ""
      setSource("")
      setShareLink("")
      applyScene(createEmptySceneState())

      if (!nextWorkspace.isDefault) {
        updateWorkspaceUrl(
          clearDefaultWorkspaceLink(new URL(window.location.href)),
          historyMode
        )
      }

      const requestedFile = filePath
        ? findFileByPath(nextWorkspace.entries, filePath)
        : null
      const preferredGraph = findFileByPath(
        nextWorkspace.entries,
        DEFAULT_BUNDLED_GRAPH_PATH
      )
      const firstFile =
        requestedFile ?? preferredGraph ?? findFirstFile(nextWorkspace.entries)
      setWorkspaceStatus(
        firstFile
          ? `Opened ${nextWorkspace.name}`
          : `${nextWorkspace.name} has no files`
      )

      if (firstFile) {
        await openFileEntry(firstFile, historyMode)
        if (filePath && !requestedFile) {
          setWorkspaceStatus(
            `File not found: ${filePath}. Opened ${firstFile.name}`
          )
        }
      }
    },
    [applyScene, openFileEntry]
  )

  const handleLoadDefault = useCallback(
    async (
      filePath?: string | null,
      historyMode: WorkspaceHistoryMode = "push"
    ) => {
      const request = ++workspaceLoadRequestRef.current
      ++fileOpenRequestRef.current
      try {
        const nextWorkspace = await createDefaultWorkspace()
        if (request === workspaceLoadRequestRef.current) {
          await openWorkspace(nextWorkspace, filePath, historyMode)
        }
      } catch (error) {
        if (request === workspaceLoadRequestRef.current) {
          setWorkspaceStatus(
            error instanceof Error
              ? error.message
              : "Could not open protocols folder"
          )
        }
      }
    },
    [openWorkspace]
  )

  const resetWorkspace = useCallback(
    (historyMode: WorkspaceHistoryMode = "push") => {
      ++workspaceLoadRequestRef.current
      ++fileOpenRequestRef.current
      updateWorkspaceUrl(
        clearDefaultWorkspaceLink(new URL(window.location.href)),
        historyMode
      )
      setWorkspace(null)
      workspaceRef.current = null
      workspaceSignatureRef.current = ""
      setActiveFile(null)
      setSidebarMode("files")
      activeFileRef.current = null
      sourceRef.current = ""
      setSource("")
      setShareLink("")
      setWorkspaceStatus("")
      setMobileFilesOpen(false)
      applyScene(createEmptySceneState())
    },
    [applyScene]
  )

  useEffect(() => {
    const selection = readDefaultWorkspaceLink(new URL(window.location.href))
    if (import.meta.env.DEV && !selection) return

    const request = ++workspaceLoadRequestRef.current
    let cancelled = false
    void createDefaultWorkspace()
      .then((nextWorkspace) => {
        if (!cancelled && request === workspaceLoadRequestRef.current) {
          return openWorkspace(nextWorkspace, selection?.filePath, "replace")
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && request === workspaceLoadRequestRef.current) {
          setWorkspaceStatus(
            error instanceof Error
              ? error.message
              : "Could not open protocols folder"
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [openWorkspace])

  useEffect(() => {
    const onPopState = () => {
      const selection = readDefaultWorkspaceLink(new URL(window.location.href))
      if (selection) {
        void handleLoadDefault(selection.filePath, "none")
      } else {
        resetWorkspace("none")
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [handleLoadDefault, resetWorkspace])

  const handleCopyLink = useCallback(async () => {
    if (!workspaceRef.current?.isDefault) return
    const url = createDefaultWorkspaceLink(
      new URL(window.location.href),
      activeFileRef.current?.path
    ).href
    try {
      await navigator.clipboard.writeText(url)
      setWorkspaceStatus("Link copied")
    } catch {
      setShareLink(url)
      setWorkspaceStatus("Copy the link below")
    }
  }, [])

  const handleDownloadDefaultZip = useCallback(async () => {
    try {
      const blob = await createDefaultWorkspaceZipBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = DEFAULT_WORKSPACE_ZIP_NAME
      link.rel = "noopener"
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setWorkspaceStatus(`Downloaded ${DEFAULT_WORKSPACE_ZIP_NAME}`)
    } catch {
      setWorkspaceStatus("Could not download default ZIP")
    }
  }, [])

  const handleOpenFolder = useCallback(async () => {
    const request = ++workspaceLoadRequestRef.current
    try {
      const picker = (window as unknown as DirectoryPickerWindow)
        .showDirectoryPicker
      if (!picker) {
        setWorkspaceStatus("Folder access is not available in this browser")
        return
      }

      const directoryHandle = await picker({ mode: "readwrite" })
      const entries = await readDirectoryWorkspace(directoryHandle)
      if (request !== workspaceLoadRequestRef.current) return
      await openWorkspace({
        name: directoryHandle.name,
        readonly: false,
        rootHandle: directoryHandle,
        entries,
      })
    } catch {
      setWorkspaceStatus("Folder was not opened")
    }
  }, [openWorkspace])

  const syncLocalWorkspace = useCallback(async () => {
    const currentWorkspace = workspaceRef.current
    const rootHandle = currentWorkspace?.rootHandle
    const identity = currentWorkspace?.refresh ?? rootHandle
    if (!identity || isWritingFileRef.current) {
      return
    }

    try {
      const nextEntries = currentWorkspace?.refresh
        ? await currentWorkspace.refresh()
        : await readDirectoryWorkspace(rootHandle!)
      if (
        (workspaceRef.current?.refresh ?? workspaceRef.current?.rootHandle) !==
          identity ||
        isWritingFileRef.current
      ) {
        return
      }

      const nextSignature = getWorkspaceEntriesSignature(nextEntries)
      const treeChanged = nextSignature !== workspaceSignatureRef.current
      const currentActiveFile = activeFileRef.current
      const nextActiveFile = currentActiveFile
        ? findFileByPath(nextEntries, currentActiveFile.path)
        : null

      if (treeChanged) {
        workspaceSignatureRef.current = nextSignature
        setWorkspace((current) => {
          if (
            !current ||
            (current.refresh ?? current.rootHandle) !== identity
          ) {
            return current
          }

          return {
            ...current,
            entries: nextEntries,
          }
        })
      }

      if (!currentActiveFile) {
        if (treeChanged) {
          setWorkspaceStatus("Synced local folder")
        }
        return
      }

      if (!nextActiveFile) {
        activeFileRef.current = null
        sourceRef.current = ""
        setActiveFile(null)
        setSidebarMode("files")
        setSource("")
        applyScene(createEmptySceneState())
        setWorkspaceStatus(`File removed: ${currentActiveFile.path}`)
        return
      }

      const nextSource = await nextActiveFile.read()
      if (
        isWritingFileRef.current ||
        activeFileRef.current?.path !== currentActiveFile.path
      )
        return
      const sourceChanged = nextSource !== sourceRef.current
      if (!sourceChanged) {
        if (treeChanged) {
          activeFileRef.current = nextActiveFile
          setActiveFile(nextActiveFile)
        }
        return
      }

      if (
        JSON.stringify(extractTxLayoutPositions(liveElementsRef.current)) !==
        savedLayoutRef.current
      ) {
        setWorkspaceStatus(
          "File changed on disk. Reopen it before saving your layout."
        )
        return
      }

      activeFileRef.current = nextActiveFile
      sourceRef.current = nextSource
      setActiveFile(nextActiveFile)
      setSource(nextSource)
      setWorkspaceStatus(`Updated ${nextActiveFile.path} from disk`)

      if (
        nextActiveFile.type === "markdown" &&
        isBridgeFlowMarkdown(nextSource)
      ) {
        runCompile(nextSource)
      } else {
        applyScene(createEmptySceneState())
      }
    } catch {
      setWorkspaceStatus("Could not sync local folder")
    }
  }, [applyScene, runCompile])

  useEffect(() => {
    if (!workspace?.rootHandle && !workspace?.refresh) {
      return
    }

    const syncTimer = window.setInterval(
      () => void syncLocalWorkspace(),
      LOCAL_WORKSPACE_SYNC_INTERVAL_MS
    )

    return () => window.clearInterval(syncTimer)
  }, [syncLocalWorkspace, workspace?.rootHandle, workspace?.refresh])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault()
        if (activeFile?.type === "markdown" && isBridgeFlowMarkdown(source)) {
          runCompile(source)
          setWorkspaceStatus("Rendered")
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [activeFile?.type, runCompile, source])

  const handleApi = useCallback((api: ExcalidrawImperativeAPI | null) => {
    excalidrawApiRef.current = api
  }, [])

  const handleRender = useCallback(() => {
    runCompile(source)
    setWorkspaceStatus("Rendered")
  }, [runCompile, source])

  const handleCopySceneConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        buildSceneConfig(liveElementsRef.current)
      )
    } catch {
      // no-op if the clipboard is unavailable in the current environment
    }
  }, [])

  const handleSaveLayout = useCallback(async () => {
    if (
      !activeFile ||
      activeFile.type !== "markdown" ||
      !isBridgeFlowMarkdown(source) ||
      isWritingFileRef.current
    ) {
      setWorkspaceStatus(
        "Open a BridgeFlow Markdown file to save layout changes"
      )
      return
    }

    try {
      const nextSource = mergeTxLayoutIntoMarkdownSource(
        source,
        extractTxLayoutPositions(liveElementsRef.current)
      )
      isWritingFileRef.current = true
      setIsSaving(true)
      if (activeFile.write) {
        await activeFile.write(nextSource)
      } else {
        const url = URL.createObjectURL(
          new Blob([nextSource], { type: "text/markdown" })
        )
        const link = document.createElement("a")
        link.href = url
        link.download = activeFile.name
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
      }
      if (activeFileRef.current?.path === activeFile.path) {
        sourceRef.current = nextSource
        setSource(nextSource)
        runCompile(nextSource)
        setWorkspaceStatus(
          activeFile.write
            ? `Saved layout to ${activeFile.path}`
            : `Downloaded ${activeFile.name} with layout`
        )
      }
    } catch (error) {
      setWorkspaceStatus(
        error instanceof Error ? error.message : "Could not save layout"
      )
    } finally {
      isWritingFileRef.current = false
      setIsSaving(false)
    }
  }, [activeFile, runCompile, source])

  const handleExcalidrawChange = useCallback(
    (nextElements: readonly ExcalidrawElement[]) => {
      // Ignore late notifications from a canvas that has just been replaced.
      if (compiledElementsRef.current !== compiledScene.elements) return
      liveElementsRef.current = nextElements as ExcalidrawElement[]
      const positions = extractTxLayoutPositions(nextElements)
      setTxLayoutPositions(positions)
      setHasLayoutChanges(JSON.stringify(positions) !== savedLayoutRef.current)
    },
    [compiledScene.elements]
  )

  const errorState = isGraphMarkdown && !compiledScene.valid
  const statusLabel = errorState ? "Invalid" : "Ready"
  const StatusIcon = errorState ? TriangleAlert : CheckCircle2
  const showMobileFiles = isMobile && mobileFilesOpen
  const canSaveLayout =
    !isSaving &&
    activeFile?.type === "markdown" &&
    isGraphMarkdown &&
    !errorState &&
    txLayoutPositions.length > 0

  const graphPanel = (
    <div className="graph-canvas h-full min-h-0 bg-card">
      <ExcalidrawHost
        key={sceneVersion}
        elements={compiledScene.elements}
        isCompact={isMobile}
        onApi={handleApi}
        onChange={handleExcalidrawChange}
      />
    </div>
  )

  const textPanel = (
    <pre className="h-full overflow-auto bg-card p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap sm:p-6">
      {source}
    </pre>
  )

  const mobileGraphReaderPanel = (
    <div className="h-full overflow-auto bg-background">
      <div className="h-[52dvh] min-h-[340px] bg-card">{graphPanel}</div>
      <MarkdownPreview
        source={source}
        fill={false}
        className="border-t border-border"
      />
    </div>
  )

  const sidebarReaderPanel = activeFile ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{activeFile.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {activeFile.path}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSidebarMode("files")}
        >
          <FolderOpen data-icon="inline-start" />
          Files
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {isMarkdownFile ? (
          <MarkdownPreview source={source} className="sidebar-markdown" />
        ) : (
          <pre className="h-full overflow-auto bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {source}
          </pre>
        )}
      </div>
    </div>
  ) : null

  const sidebarFilesPanel = workspace ? (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{workspace.name}</div>
          <div className="text-xs text-muted-foreground">
            {workspace.readonly ? "Bundled folder" : "Local folder"}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <FileTree
          entries={workspace.entries}
          activePath={activeFile?.path}
          onOpenFile={(entry) => void openFileEntry(entry)}
        />
      </div>
    </>
  ) : null

  const workspaceContent = activeFile ? (
    <div className="h-full min-h-0">
      {isGraphMarkdown ? (
        isMobile ? (
          mobileGraphReaderPanel
        ) : (
          graphPanel
        )
      ) : isMarkdownFile ? (
        <MarkdownPreview source={source} />
      ) : (
        textPanel
      )}
    </div>
  ) : (
    <div className="grid h-full place-items-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <FileText className="size-8 text-muted-foreground" />
        <div>
          <h2 className="text-base font-semibold">Select a file</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a file from the sidebar to view it.
          </p>
        </div>
      </div>
    </div>
  )

  if (!workspace) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-4 sm:p-6">
        <section className="flex w-full max-w-xl flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Bitcoin />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{APP_NAME}</h1>
              <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <Button
              type="button"
              size="lg"
              onClick={handleOpenFolder}
              disabled={!supportsFileSystemAccess()}
              className="justify-start"
            >
              <FolderOpen data-icon="inline-start" />
              Open folder
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => void handleLoadDefault()}
              className="justify-start"
            >
              <Folder data-icon="inline-start" />
              Load default
            </Button>
            <p className="text-xs text-muted-foreground">
              {import.meta.env.DEV
                ? "Opens protocols/ from this repository. Save layout writes directly to its Markdown files."
                : "Opens the bundled protocols. Download layout saves a Markdown copy with your changes."}
            </p>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleDownloadDefaultZip}
              className="justify-start"
            >
              <Download data-icon="inline-start" />
              Download ZIP
            </Button>
            {supportsFileSystemAccess() ? null : (
              <p className="text-xs text-muted-foreground">
                Folder access is available in Chromium-based browsers.
              </p>
            )}
          </div>

          {workspaceStatus ? (
            <p className="text-sm text-muted-foreground">{workspaceStatus}</p>
          ) : null}
        </section>
      </main>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <aside
        className={
          sidebarCollapsed
            ? "hidden"
            : "relative hidden shrink-0 flex-col border-r border-border bg-sidebar md:flex"
        }
        style={{ width: `${sidebarWidth}px` }}
      >
        {sidebarMode === "reader" && sidebarReaderPanel
          ? sidebarReaderPanel
          : sidebarFilesPanel}
        <div
          role="separator"
          tabIndex={0}
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          className="absolute top-0 right-0 h-full w-2 translate-x-1 cursor-col-resize touch-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerDown={handleSidebarResizePointerDown}
          onKeyDown={handleSidebarResizeKeyDown}
        />
      </aside>

      {showMobileFiles ? (
        <>
          <button
            type="button"
            aria-label="Close files"
            className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
            onClick={() => setMobileFilesOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(21rem,calc(100vw-2rem))] flex-col border-r border-border bg-sidebar shadow-xl md:hidden">
            <div className="flex h-14 items-center justify-between gap-2 border-b border-sidebar-border px-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {workspace.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {workspace.readonly ? "Bundled folder" : "Local folder"}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close files"
                onClick={() => setMobileFilesOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto py-1">
              <FileTree
                entries={workspace.entries}
                activePath={activeFile?.path}
                onOpenFile={(entry) => void openFileEntry(entry)}
              />
            </div>
          </aside>
        </>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-3 py-2 xl:h-12 xl:flex-row xl:items-center xl:justify-between xl:py-0">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={isMobile ? "Open files" : "Toggle sidebar"}
              onClick={() => {
                if (isMobile) {
                  setMobileFilesOpen(true)
                  return
                }

                setSidebarCollapsed((current) => !current)
              }}
            >
              <PanelLeft />
            </Button>
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <Bitcoin />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {activeFile?.path ?? workspace.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {workspaceStatus ||
                  (workspace.readonly ? "Immutable workspace" : "Writable")}
              </div>
            </div>
          </div>

          <div className="mobile-action-bar -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:shrink-0 xl:overflow-visible xl:px-0 xl:pb-0">
            {isGraphMarkdown ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  aria-label="Render graph"
                  onClick={handleRender}
                >
                  <Play data-icon="inline-start" />
                  <span className="hidden 2xl:inline">Render</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Fit graph"
                  onClick={() => {
                    const api = excalidrawApiRef.current
                    if (api)
                      syncVisibleScene(api, liveElementsRef.current, isMobile)
                  }}
                >
                  <Maximize2 data-icon="inline-start" />
                  <span className="hidden 2xl:inline">Fit</span>
                </Button>
                <Badge
                  variant={errorState ? "destructive" : "secondary"}
                  className={
                    errorState
                      ? undefined
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }
                >
                  <StatusIcon data-icon="inline-start" />
                  <span>{statusLabel}</span>
                </Badge>
                <select
                  aria-label="Focus transaction"
                  className="h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs"
                  value=""
                  onChange={(event) => {
                    const group = `tx:${event.target.value}`
                    const elements = liveElementsRef.current.filter((element) =>
                      element.groupIds.includes(group)
                    )
                    excalidrawApiRef.current?.scrollToContent(elements, {
                      fitToViewport: true,
                      minZoom: 0.8,
                      maxZoom: 1,
                      animate: false,
                    })
                  }}
                >
                  <option value="" disabled>
                    Focus transaction ({graphTransactions.length})
                  </option>
                  {graphTransactions.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Copy scene"
                  onClick={handleCopySceneConfig}
                >
                  <ClipboardCopy data-icon="inline-start" />
                  <span className="hidden 2xl:inline">Copy scene</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  aria-label={
                    activeFile?.write ? "Save layout" : "Download layout"
                  }
                  onClick={handleSaveLayout}
                  disabled={!canSaveLayout}
                >
                  <Save data-icon="inline-start" />
                  <span className="hidden 2xl:inline">
                    {isSaving
                      ? "Saving…"
                      : activeFile?.write
                        ? "Save layout"
                        : "Download layout"}
                  </span>
                  {hasLayoutChanges ? (
                    <span aria-label="Unsaved layout changes">•</span>
                  ) : null}
                </Button>
              </>
            ) : null}
            {workspace.isDefault ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Copy link"
                title="Copy link"
                onClick={handleCopyLink}
              >
                <Link data-icon="inline-start" />
                <span className="hidden sm:inline">Copy link</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Open folder"
              onClick={handleOpenFolder}
            >
              <FolderOpen data-icon="inline-start" />
              <span className="hidden 2xl:inline">Folder</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Go home"
              onClick={() => resetWorkspace()}
            >
              <Home />
            </Button>
          </div>
        </header>

        {shareLink ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2">
            <input
              aria-label="Share link"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={shareLink}
              readOnly
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close share link"
              onClick={() => setShareLink("")}
            >
              <X />
            </Button>
          </div>
        ) : null}

        {sceneDiagnostics.length > 0 && isGraphMarkdown ? (
          <div className="flex max-h-24 shrink-0 flex-col gap-1 overflow-auto border-b border-border bg-muted/40 px-3 py-2 text-xs">
            {sceneDiagnostics.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className={
                  errorState ? "text-destructive" : "text-muted-foreground"
                }
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-hidden">
          {workspaceContent}
        </main>
      </section>
    </div>
  )
}

export default App
