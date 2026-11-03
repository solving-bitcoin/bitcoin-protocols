import type { Workspace, WorkspaceTreeEntry } from "./workspace"

export const PROTOCOL_REPOSITORY = "solving-bitcoin/bitcoin-protocols"

export function parsePullRequestNumber(value: string) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("Enter a positive pull request number.")
  }
  return Number(value)
}

// Load Markdown only. PR application code is never imported or executed.
export async function createPullRequestWorkspace(
  value: string,
  request: typeof fetch = fetch
): Promise<Workspace> {
  const number = parsePullRequestNumber(value)
  const api = `https://api.github.com/repos/${PROTOCOL_REPOSITORY}`
  async function getJson<T>(url: string): Promise<T> {
    const response = await request(url, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    })
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        throw new Error(
          "GitHub's request limit was reached. Try opening the PR again later."
        )
      }
      throw new Error(
        `Could not load PR #${number} from GitHub (${response.status}).`
      )
    }
    return response.json() as Promise<T>
  }

  const pr = await getJson<{
    title: string
    head: { sha: string; repo: { full_name: string } | null }
  }>(`${api}/pulls/${number}`)
  if (!/^[0-9a-f]{40}$/.test(pr.head.sha)) {
    throw new Error("GitHub returned an invalid PR revision.")
  }
  const repository = pr.head.repo?.full_name ?? PROTOCOL_REPOSITORY
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error("GitHub returned an invalid PR repository.")
  }
  // Resolve the head once; the tree and all file reads use this same revision.
  const tree = await getJson<{
    truncated: boolean
    tree: { path: string; type: string; mode: string }[]
  }>(
    `https://api.github.com/repos/${repository}/git/trees/${pr.head.sha}?recursive=1`
  )
  if (tree.truncated) {
    throw new Error("This PR's file tree is too large to preview completely.")
  }

  const entries: WorkspaceTreeEntry[] = []
  for (const item of tree.tree) {
    if (
      item.type !== "blob" ||
      item.mode === "120000" ||
      !/^protocols\/.+\.(md|markdown)$/i.test(item.path)
    )
      continue
    const path = item.path.slice("protocols/".length)
    const segments = path.split("/")
    if (
      segments.some(
        (segment) => !segment || segment === "." || segment === ".."
      )
    )
      continue
    let children = entries
    for (let index = 0; index < segments.length - 1; index++) {
      const folderPath = segments.slice(0, index + 1).join("/")
      let directory = children.find(
        (entry) => entry.kind === "directory" && entry.path === folderPath
      )
      if (!directory) {
        directory = {
          kind: "directory",
          name: segments[index],
          path: folderPath,
          children: [],
        }
        children.push(directory)
      }
      if (directory.kind === "directory") children = directory.children
    }
    const url = `https://raw.githubusercontent.com/${repository}/${pr.head.sha}/${item.path.split("/").map(encodeURIComponent).join("/")}`
    let cached: string | undefined
    children.push({
      kind: "file",
      name: segments[segments.length - 1],
      path,
      type: "markdown",
      writable: false,
      read: async () => {
        if (cached !== undefined) return cached
        const response = await request(url)
        if (!response.ok)
          throw new Error(
            `Could not read ${path} from PR #${number} (${response.status}).`
          )
        cached = await response.text()
        return cached
      },
    })
  }
  function sort(items: WorkspaceTreeEntry[]) {
    items.sort((a, b) =>
      a.kind === b.kind
        ? a.name.localeCompare(b.name)
        : a.kind === "directory"
          ? -1
          : 1
    )
    for (const item of items) if (item.kind === "directory") sort(item.children)
  }
  sort(entries)
  return {
    name: `protocols · PR #${number}`,
    readonly: true,
    isDefault: true,
    pullRequest: {
      number,
      title: pr.title,
      url: `https://github.com/${PROTOCOL_REPOSITORY}/pull/${number}`,
      sha: pr.head.sha,
    },
    entries,
  }
}
