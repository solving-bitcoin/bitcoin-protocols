export type WorkspaceHistoryMode = "push" | "replace" | "none"

export function readDefaultWorkspaceLink(url: URL) {
  if (
    url.searchParams.get("workspace") !== "default" &&
    !url.searchParams.has("file")
  ) {
    return null
  }

  return { filePath: url.searchParams.get("file") || null }
}

export function createDefaultWorkspaceLink(url: URL, filePath?: string | null) {
  const nextUrl = new URL(url)
  nextUrl.searchParams.set("workspace", "default")
  if (filePath) {
    nextUrl.searchParams.set("file", filePath)
  } else {
    nextUrl.searchParams.delete("file")
  }
  return nextUrl
}

export function clearDefaultWorkspaceLink(url: URL) {
  const nextUrl = new URL(url)
  nextUrl.searchParams.delete("workspace")
  nextUrl.searchParams.delete("file")
  return nextUrl
}
