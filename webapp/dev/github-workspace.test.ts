import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createPullRequestWorkspace,
  parsePullRequestNumber,
} from "../src/lib/github-workspace.ts"
import {
  clearDefaultWorkspaceLink,
  createDefaultWorkspaceLink,
  readDefaultWorkspaceLink,
} from "../src/lib/workspace-links.ts"

const sha = "a".repeat(40)
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status })

test("PR previews use the fork's immutable head and read only Markdown lazily", async () => {
  const calls: string[] = []
  const request = (async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith("/pulls/12"))
      return json({
        title: "New protocol",
        head: { sha, repo: { full_name: "contributor/fork" } },
      })
    if (url.includes("/git/trees/"))
      return json({
        truncated: false,
        tree: [
          {
            path: "protocols/nested/new protocol.md",
            type: "blob",
            mode: "100644",
          },
          { path: "protocols/changed.markdown", type: "blob", mode: "100644" },
          { path: "protocols/linked.md", type: "blob", mode: "120000" },
          { path: "protocols/code.js", type: "blob", mode: "100644" },
          { path: "webapp/src/App.tsx", type: "blob", mode: "100644" },
        ],
      })
    if (url.includes("new%20protocol.md"))
      return new Response("# From the PR\n```bridgeflow\n```\n")
    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch
  const workspace = await createPullRequestWorkspace("12", request)
  assert.equal(workspace.readonly, true)
  assert.equal(workspace.pullRequest?.sha, sha)
  assert.equal(calls.length, 2)
  assert.equal(
    calls[1],
    `https://api.github.com/repos/contributor/fork/git/trees/${sha}?recursive=1`
  )
  assert.equal(workspace.entries.length, 2)
  const folder = workspace.entries[0]
  assert.equal(folder.kind, "directory")
  if (folder.kind !== "directory") throw new Error("Missing directory")
  const file = folder.children[0]
  if (file.kind !== "file") throw new Error("Missing protocol")
  assert.equal(file.write, undefined)
  assert.match(await file.read(), /From the PR/)
  await file.read()
  assert.equal(calls.length, 3)
  assert.equal(
    calls[2],
    `https://raw.githubusercontent.com/contributor/fork/${sha}/protocols/nested/new%20protocol.md`
  )
})

test("missing PRs and rate limits are errors, not a fallback to main", async () => {
  for (const status of [404, 403, 429]) {
    await assert.rejects(
      createPullRequestWorkspace("3", async () => json({}, status)),
      status === 404 ? /404/ : /request limit/
    )
  }
})

test("reject incomplete trees and file read errors", async () => {
  const metadata = { title: "PR", head: { sha, repo: null } }
  await assert.rejects(
    createPullRequestWorkspace("3", async (url) =>
      String(url).includes("/pulls/")
        ? json(metadata)
        : json({ truncated: true, tree: [] })
    ),
    /too large/
  )
  const workspace = await createPullRequestWorkspace("3", async (url) => {
    if (String(url).includes("/pulls/")) return json(metadata)
    if (String(url).includes("/git/trees/"))
      return json({
        truncated: false,
        tree: [{ path: "protocols/a.md", type: "blob", mode: "100644" }],
      })
    return json({}, 404)
  })
  const file = workspace.entries[0]
  if (file.kind !== "file") throw new Error("Missing file")
  await assert.rejects(file.read(), /Could not read a.md/)
})

test("validate PR numbers before issuing requests", async () => {
  for (const value of ["", "0", "-1", "3.5", "3x", "03", "9007199254740992"]) {
    assert.throws(() => parsePullRequestNumber(value), /positive/)
    await assert.rejects(
      createPullRequestWorkspace(value, async () => {
        throw new Error("Network must not run")
      }),
      /positive/
    )
  }
})

test("share links retain PR and nested paths; main and local links clear PR selection", () => {
  const base = new URL("https://example.org/protocols/?unrelated=keep")
  const preview = createDefaultWorkspaceLink(base, "nested/name #1.md", 12)
  assert.deepEqual(readDefaultWorkspaceLink(preview), {
    filePath: "nested/name #1.md",
    pullRequest: "12",
  })
  const main = createDefaultWorkspaceLink(preview, "main.md")
  assert.deepEqual(readDefaultWorkspaceLink(main), {
    filePath: "main.md",
    pullRequest: null,
  })
  const cleared = clearDefaultWorkspaceLink(preview)
  assert.equal(readDefaultWorkspaceLink(cleared), null)
  assert.equal(cleared.searchParams.get("unrelated"), "keep")
  assert.deepEqual(
    readDefaultWorkspaceLink(new URL("https://example.org/?pr=12")),
    { filePath: null, pullRequest: "12" }
  )
  assert.equal(readDefaultWorkspaceLink(new URL("https://example.org/")), null)
})
