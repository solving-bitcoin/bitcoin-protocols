export type WorkspaceFileType = "json" | "markdown" | "text"
export type WorkspaceTreeEntry = WorkspaceDirectoryEntry | WorkspaceFileEntry

export interface AppWritableFileStream {
  write: (data: string) => Promise<void>
  close: () => Promise<void>
}

export interface AppFileHandle {
  kind: "file"
  name: string
  getFile: () => Promise<File>
  createWritable?: () => Promise<AppWritableFileStream>
}

export interface AppDirectoryHandle {
  kind: "directory"
  name: string
  entries: () => AsyncIterableIterator<
    [string, AppFileHandle | AppDirectoryHandle]
  >
}

export interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite"
  }) => Promise<AppDirectoryHandle>
}

export interface Workspace {
  name: string
  readonly: boolean
  entries: WorkspaceTreeEntry[]
  rootHandle?: AppDirectoryHandle
  refresh?: () => Promise<WorkspaceTreeEntry[]>
}

export interface WorkspaceDirectoryEntry {
  kind: "directory"
  name: string
  path: string
  children: WorkspaceTreeEntry[]
}

export interface WorkspaceFileEntry {
  kind: "file"
  name: string
  path: string
  type: WorkspaceFileType
  writable: boolean
  lastModified?: number
  size?: number
  read: () => Promise<string>
  write?: (source: string) => Promise<void>
}

export function supportsFileSystemAccess() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

export const DEFAULT_WORKSPACE_ZIP_NAME = "bridge-protocols.zip"

export function getWorkspaceFileType(name: string): WorkspaceFileType {
  const normalized = name.toLowerCase()
  if (normalized.endsWith(".json")) {
    return "json"
  }

  if (normalized.endsWith(".md") || normalized.endsWith(".markdown")) {
    return "markdown"
  }

  return "text"
}

export function sortWorkspaceEntries(entries: WorkspaceTreeEntry[]) {
  return entries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })
}

/** When present in the tree, this BridgeFlow Markdown opens first after Load default. */
export const DEFAULT_BUNDLED_GRAPH_PATH = "clementine-v2.md"

const bridgeDesignsRawModules = import.meta.glob("../../../protocols/**/*", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<unknown>>

interface MutableBundleDir {
  dirs: Map<string, MutableBundleDir>
  files: Array<{ name: string; relPath: string; content: string }>
}

function stripBridgeDesignsRelativeKey(moduleKey: string): string | null {
  const normalized = moduleKey.replace(/\\/g, "/")
  const marker = "protocols/"
  const index = normalized.lastIndexOf(marker)
  if (index === -1) {
    return null
  }

  return normalized.slice(index + marker.length)
}

function shouldBundleFile(relativePath: string) {
  const base = relativePath.split("/").pop() ?? relativePath
  if (!base || base.startsWith(".")) {
    return false
  }

  if (base === ".DS_Store") {
    return false
  }

  const lower = base.toLowerCase()
  return (
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".json") ||
    lower.endsWith(".txt")
  )
}

function insertBundledFile(
  root: MutableBundleDir,
  relativePath: string,
  content: string
) {
  const segments = relativePath.split("/").filter(Boolean)
  if (!segments.length) {
    return
  }

  let node = root
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]!
    let next = node.dirs.get(segment)
    if (!next) {
      next = { dirs: new Map(), files: [] }
      node.dirs.set(segment, next)
    }

    node = next
  }

  const fileName = segments[segments.length - 1]!
  node.files.push({
    name: fileName,
    relPath: segments.join("/"),
    content,
  })
}

function mutableBundleDirToEntries(
  node: MutableBundleDir,
  parentPath: string
): WorkspaceTreeEntry[] {
  const directoryEntries: WorkspaceTreeEntry[] = []

  for (const [name, child] of [...node.dirs.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const path = parentPath ? `${parentPath}/${name}` : name
    directoryEntries.push({
      kind: "directory",
      name,
      path,
      children: sortWorkspaceEntries(mutableBundleDirToEntries(child, path)),
    })
  }

  const fileEntries: WorkspaceTreeEntry[] = node.files
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((file) => ({
      kind: "file" as const,
      name: file.name,
      path: file.relPath,
      type: getWorkspaceFileType(file.name),
      writable: false,
      read: async () => file.content,
    }))

  return sortWorkspaceEntries([...directoryEntries, ...fileEntries])
}

function rawImportToString(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  if (
    value &&
    typeof value === "object" &&
    "default" in value &&
    typeof (value as { default: unknown }).default === "string"
  ) {
    return (value as { default: string }).default
  }

  return ""
}

async function loadBundledBridgeDesignEntries(): Promise<WorkspaceTreeEntry[]> {
  const root: MutableBundleDir = { dirs: new Map(), files: [] }

  for (const [key, load] of Object.entries(bridgeDesignsRawModules)) {
    const relative = stripBridgeDesignsRelativeKey(key)
    if (!relative || !shouldBundleFile(relative)) {
      continue
    }

    const content = rawImportToString(await load())
    if (!content) {
      continue
    }

    insertBundledFile(root, relative, content)
  }

  const entries = mutableBundleDirToEntries(root, "")
  if (entries.length > 0) {
    return entries
  }

  return [
    {
      kind: "file",
      name: "README.md",
      path: "README.md",
      type: "markdown",
      writable: false,
      read: async () =>
        `# Missing bundled workspace

Add files under \`protocols/\` at the repository root (for example \`clementine-v1.md\`) and rebuild.`,
    },
  ]
}

const ZIP_UTF8_FLAG = 0x0800
const ZIP_VERSION = 20
const ZIP_FILE_MODE = 0o100644 << 16
const zipTextEncoder = new TextEncoder()

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

interface ZipFileEntry {
  path: string
  bytes: Uint8Array
}

interface ZipCentralDirectoryEntry {
  pathBytes: Uint8Array
  crc32: number
  size: number
  offset: number
}

function calculateCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function writeUint32(target: number[], value: number) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  )
}

function createZipHeader(bytes: number[]) {
  return new Uint8Array(bytes)
}

function toZipBlobPart(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

function createLocalFileHeader(
  pathBytes: Uint8Array,
  crc32: number,
  size: number
) {
  const header: number[] = []
  writeUint32(header, 0x04034b50)
  writeUint16(header, ZIP_VERSION)
  writeUint16(header, ZIP_UTF8_FLAG)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint32(header, crc32)
  writeUint32(header, size)
  writeUint32(header, size)
  writeUint16(header, pathBytes.length)
  writeUint16(header, 0)
  return createZipHeader(header)
}

function createCentralDirectoryHeader(entry: ZipCentralDirectoryEntry) {
  const header: number[] = []
  writeUint32(header, 0x02014b50)
  writeUint16(header, ZIP_VERSION)
  writeUint16(header, ZIP_VERSION)
  writeUint16(header, ZIP_UTF8_FLAG)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint32(header, entry.crc32)
  writeUint32(header, entry.size)
  writeUint32(header, entry.size)
  writeUint16(header, entry.pathBytes.length)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint32(header, ZIP_FILE_MODE)
  writeUint32(header, entry.offset)
  return createZipHeader(header)
}

function createEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
) {
  const header: number[] = []
  writeUint32(header, 0x06054b50)
  writeUint16(header, 0)
  writeUint16(header, 0)
  writeUint16(header, entryCount)
  writeUint16(header, entryCount)
  writeUint32(header, centralDirectorySize)
  writeUint32(header, centralDirectoryOffset)
  writeUint16(header, 0)
  return createZipHeader(header)
}

async function collectZipFiles(
  entries: WorkspaceTreeEntry[],
  rootPath: string
): Promise<ZipFileEntry[]> {
  const files: ZipFileEntry[] = []

  for (const entry of entries) {
    if (entry.kind === "directory") {
      files.push(...(await collectZipFiles(entry.children, rootPath)))
      continue
    }

    files.push({
      path: `${rootPath}/${entry.path}`,
      bytes: zipTextEncoder.encode(await entry.read()),
    })
  }

  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export async function createDefaultWorkspaceZipBlob() {
  const files = await collectZipFiles(
    (await createDefaultWorkspace()).entries,
    "protocols"
  )
  const chunks: BlobPart[] = []
  const centralDirectoryEntries: ZipCentralDirectoryEntry[] = []
  let offset = 0

  for (const file of files) {
    const pathBytes = zipTextEncoder.encode(file.path)
    const crc32 = calculateCrc32(file.bytes)
    const localHeader = createLocalFileHeader(
      pathBytes,
      crc32,
      file.bytes.length
    )

    chunks.push(
      toZipBlobPart(localHeader),
      toZipBlobPart(pathBytes),
      toZipBlobPart(file.bytes)
    )
    centralDirectoryEntries.push({
      pathBytes,
      crc32,
      size: file.bytes.length,
      offset,
    })
    offset += localHeader.length + pathBytes.length + file.bytes.length
  }

  const centralDirectoryOffset = offset
  let centralDirectorySize = 0
  for (const entry of centralDirectoryEntries) {
    const header = createCentralDirectoryHeader(entry)
    chunks.push(toZipBlobPart(header), toZipBlobPart(entry.pathBytes))
    centralDirectorySize += header.length + entry.pathBytes.length
  }

  chunks.push(
    toZipBlobPart(
      createEndOfCentralDirectory(
        centralDirectoryEntries.length,
        centralDirectorySize,
        centralDirectoryOffset
      )
    )
  )

  return new Blob(chunks, { type: "application/zip" })
}

export function findFirstFile(
  entries: WorkspaceTreeEntry[]
): WorkspaceFileEntry | null {
  for (const entry of entries) {
    if (entry.kind === "file") {
      return entry
    }

    const firstChild = findFirstFile(entry.children)
    if (firstChild) {
      return firstChild
    }
  }

  return null
}

export function findFileByPath(
  entries: WorkspaceTreeEntry[],
  path: string
): WorkspaceFileEntry | null {
  for (const entry of entries) {
    if (entry.kind === "file") {
      if (entry.path === path) {
        return entry
      }
      continue
    }

    const nestedFile = findFileByPath(entry.children, path)
    if (nestedFile) {
      return nestedFile
    }
  }

  return null
}

interface WorkspaceSignatureEntry {
  kind: WorkspaceTreeEntry["kind"]
  path: string
  children?: WorkspaceSignatureEntry[]
  type?: WorkspaceFileType
  writable?: boolean
  lastModified?: number
  size?: number
}

function toWorkspaceSignatureEntry(
  entry: WorkspaceTreeEntry
): WorkspaceSignatureEntry {
  if (entry.kind === "directory") {
    return {
      kind: entry.kind,
      path: entry.path,
      children: entry.children.map(toWorkspaceSignatureEntry),
    }
  }

  return {
    kind: entry.kind,
    path: entry.path,
    type: entry.type,
    writable: entry.writable,
    lastModified: entry.lastModified,
    size: entry.size,
  }
}

export function getWorkspaceEntriesSignature(
  entries: WorkspaceTreeEntry[]
): string {
  return JSON.stringify(entries.map(toWorkspaceSignatureEntry))
}

async function readFileSource(fileHandle: AppFileHandle) {
  const file = await fileHandle.getFile()
  return file.text()
}

async function writeFileSource(fileHandle: AppFileHandle, source: string) {
  if (!fileHandle.createWritable) {
    throw new Error("File is not writable.")
  }

  const writable = await fileHandle.createWritable()
  await writable.write(source)
  await writable.close()
}

export async function readDirectoryWorkspace(
  directoryHandle: AppDirectoryHandle,
  parentPath = ""
): Promise<WorkspaceTreeEntry[]> {
  const entries: WorkspaceTreeEntry[] = []

  for await (const [name, handle] of directoryHandle.entries()) {
    const path = parentPath ? `${parentPath}/${name}` : name

    if (handle.kind === "directory") {
      entries.push({
        kind: "directory",
        name,
        path,
        children: await readDirectoryWorkspace(handle, path),
      })
      continue
    }

    const file = await handle.getFile()
    entries.push({
      kind: "file",
      name,
      path,
      type: getWorkspaceFileType(name),
      writable: Boolean(handle.createWritable),
      lastModified: file.lastModified,
      size: file.size,
      read: () => readFileSource(handle),
      write: (source) => writeFileSource(handle, source),
    })
  }

  return sortWorkspaceEntries(entries)
}

const DEFAULT_WORKSPACE_ENDPOINT = "/__bridgeflow/protocols"

async function workspaceRequest<T>(query = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`${DEFAULT_WORKSPACE_ENDPOINT}${query}`, {
    cache: "no-store",
    ...init,
  })
  const result = await response.json()
  if (!response.ok)
    throw new Error(result.error ?? "Could not access protocols folder")
  return result as T
}

async function loadLocalProtocolEntries(): Promise<WorkspaceTreeEntry[]> {
  const manifest = await workspaceRequest<{
    files: { path: string; lastModified: number; size: number }[]
    token: string
  }>()
  const root: MutableBundleDir = { dirs: new Map(), files: [] }
  for (const file of manifest.files) insertBundledFile(root, file.path, "")
  const metadata = new Map(manifest.files.map((file) => [file.path, file]))
  function makeWritable(entries: WorkspaceTreeEntry[]): WorkspaceTreeEntry[] {
    return entries.map((entry) => {
      if (entry.kind === "directory")
        return { ...entry, children: makeWritable(entry.children) }
      const query = `?path=${encodeURIComponent(entry.path)}`
      let lastRead: string | undefined
      const writable = entry.type === "markdown"
      return {
        ...entry,
        ...metadata.get(entry.path),
        writable,
        read: async () => {
          const result = await workspaceRequest<{ source: string }>(query)
          lastRead = result.source
          return result.source
        },
        write: writable
          ? async (source: string) => {
              if (lastRead === undefined)
                throw new Error("Open this file before saving")
              await workspaceRequest(query, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "X-Bridgeflow-Token": manifest.token,
                },
                body: JSON.stringify({ source, expectedSource: lastRead }),
              })
              lastRead = source
            }
          : undefined,
      }
    })
  }
  return makeWritable(mutableBundleDirToEntries(root, ""))
}

export async function createDefaultWorkspace(): Promise<Workspace> {
  if (import.meta.env.DEV) {
    return {
      name: "protocols",
      readonly: false,
      entries: await loadLocalProtocolEntries(),
      refresh: loadLocalProtocolEntries,
    }
  }
  return {
    name: "protocols",
    readonly: true,
    entries: await loadBundledBridgeDesignEntries(),
  }
}
