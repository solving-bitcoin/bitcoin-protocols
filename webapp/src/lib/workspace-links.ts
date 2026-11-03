export type WorkspaceHistoryMode = "push" | "replace" | "none"

export function readDefaultWorkspaceLink(url: URL) {
  if (
    url.searchParams.get("workspace") !== "default" &&
    !url.searchParams.has("file") &&
    !url.searchParams.has("pr")
  ) {
    return null
  }

  return {
    filePath: url.searchParams.get("file") || null,
    pullRequest: url.searchParams.get("pr"),
  }
}

export function createDefaultWorkspaceLink(
  url: URL,
  filePath?: string | null,
  pullRequest?: number
) {
  const nextUrl = new URL(url)
  nextUrl.searchParams.set("workspace", "default")
  if (pullRequest) nextUrl.searchParams.set("pr", String(pullRequest))
  else nextUrl.searchParams.delete("pr")
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
  nextUrl.searchParams.delete("pr")
  return nextUrl
}
