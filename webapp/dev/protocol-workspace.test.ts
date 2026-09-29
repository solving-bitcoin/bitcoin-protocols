import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import test from "node:test"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Connect, ViteDevServer } from "vite"
import { protocolWorkspace } from "./protocol-workspace.ts"

test("default folder persists layouts, preserves graph content and rejects stale saves", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridgeflow-workspace-"))
  const filename = path.join(root, "bridge.md")
  const source =
    "# Bridge ₿\n\n## tx: deposit\n\n```bridgeflow\nlabel: Deposit\noutputs: []\n```\n"
  fs.writeFileSync(filename, source)
  fs.mkdirSync(path.join(root, "primitives"))
  fs.writeFileSync(path.join(root, "primitives", "connector.md"), source)
  fs.symlinkSync(filename, path.join(root, "linked.md"))
  let middleware: Connect.NextHandleFunction
  const plugin = protocolWorkspace(root)
  const configure = plugin.configureServer as (server: ViteDevServer) => void
  configure({
    middlewares: {
      use: (handler: Connect.NextHandleFunction) => {
        middleware = handler
      },
    },
  } as unknown as ViteDevServer)
  async function request(
    method = "GET",
    query = "",
    body?: unknown,
    token?: string,
    remoteAddress = "127.0.0.1"
  ) {
    const chunks =
      body === undefined
        ? []
        : [...Buffer.from(JSON.stringify(body))].map((byte) =>
            Buffer.from([byte])
          )
    const req = Object.assign(Readable.from(chunks), {
      method,
      url: `/__bridgeflow/protocols${query}`,
      headers: {
        host: "localhost:5173",
        origin: "http://localhost:5173",
        "x-bridgeflow-token": token,
      },
      socket: { remoteAddress },
    }) as unknown as IncomingMessage
    return new Promise<{ status: number; data: Record<string, unknown> }>(
      (resolve, reject) => {
        let status = 0
        const res = {
          writeHead: (code: number) => {
            status = code
          },
          end: (json: string) => resolve({ status, data: JSON.parse(json) }),
        } as unknown as ServerResponse
        middleware(req, res, reject)
      }
    )
  }
  try {
    const manifest = await request()
    assert.equal(manifest.status, 200)
    assert.deepEqual(
      (manifest.data.files as { path: string }[])
        .map((file) => file.path)
        .sort(),
      ["bridge.md", "primitives/connector.md"]
    )
    const token = manifest.data.token as string
    assert.equal((await request("GET", "?path=bridge.md")).data.source, source)
    assert.equal((await request("GET", "?path=missing.md")).status, 404)
    assert.equal(
      (await request("GET", "", undefined, undefined, "192.0.2.1")).status,
      403
    )
    const next = `${source}\n<!-- bridgeflow:layout\ntxs:\n  deposit:\n    x: 40\n    y: 80\n-->\n`
    const body = { expectedSource: source, source: next }
    assert.equal((await request("PUT", "?path=bridge.md", body)).status, 403)
    const saved = await request("PUT", "?path=bridge.md", body, token)
    assert.equal(saved.status, 200)
    assert.equal(fs.readFileSync(filename, "utf8"), next)
    assert.equal((await request("GET", "?path=bridge.md")).data.source, next)
    assert.equal(
      (await request("PUT", "?path=bridge.md", body, token)).status,
      409
    )
    assert.equal(
      (
        await request(
          "PUT",
          "?path=bridge.md",
          {
            expectedSource: next,
            source: next.replace("label: Deposit", "label: Changed"),
          },
          token
        )
      ).status,
      400
    )
    assert.equal(fs.readFileSync(filename, "utf8"), next)
    assert.equal(
      fs.readdirSync(root).some((name) => name.endsWith(".tmp")),
      false
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
