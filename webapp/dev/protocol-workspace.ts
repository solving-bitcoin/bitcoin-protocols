import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

const ENDPOINT = "/__bridgeflow/protocols"
const LAYOUT = /<!--\s*bridgeflow:layout[ \t]*\n[\s\S]*?\n?-->/gi
const stripLayout = (source: string) => source.replace(LAYOUT, "").trimEnd()

interface ProtocolFile {
  path: string
  lastModified: number
  size: number
}

function listFiles(root: string, directory = root): ProtocolFile[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) return []
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return listFiles(root, filename)
    if (!entry.isFile() || !/\.(md|markdown|json|txt)$/i.test(entry.name))
      return []
    const stat = fs.statSync(filename)
    return [
      {
        path: path.relative(root, filename).split(path.sep).join("/"),
        lastModified: stat.mtimeMs,
        size: stat.size,
      },
    ]
  })
}

function respond(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  })
  response.end(JSON.stringify(value))
}

async function readBody(request: IncomingMessage) {
  request.setEncoding("utf8")
  let body = ""
  for await (const chunk of request) {
    body += chunk.toString()
    if (Buffer.byteLength(body) > 2 * 1024 * 1024) {
      throw new Error("Layout request is too large")
    }
  }
  return JSON.parse(body) as { source?: unknown; expectedSource?: unknown }
}

/** Local development only: existing protocol files, with layout-only writes. */
export function protocolWorkspace(protocolsDirectory: string): Plugin {
  const token = randomUUID()
  return {
    name: "bridgeflow-protocol-workspace",
    apply: "serve",
    configureServer(server) {
      const root = fs.realpathSync(protocolsDirectory)
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost")
        if (url.pathname !== ENDPOINT) return next()
        try {
          const remote = request.socket.remoteAddress ?? ""
          if (remote !== "::1" && !/^(::ffff:)?127\./.test(remote)) {
            respond(response, 403, {
              error: "The protocols folder is available on this computer only",
            })
            return
          }
          const origin = request.headers.origin
          if (origin && new URL(origin).host !== request.headers.host) {
            respond(response, 403, {
              error: "Open this workspace from the local app",
            })
            return
          }
          const relative = url.searchParams.get("path")
          if (request.method === "GET" && relative === null) {
            respond(response, 200, {
              name: "protocols",
              files: listFiles(root),
              token,
            })
            return
          }
          if (request.method !== "GET" && request.method !== "PUT") {
            respond(response, 405, { error: "Unsupported workspace operation" })
            return
          }
          // An exact inventory match also excludes traversal, hidden files and symlinks.
          const file = listFiles(root).find((entry) => entry.path === relative)
          if (!file) {
            respond(response, 404, { error: "Protocol file not found" })
            return
          }
          const filename = fs.realpathSync(path.join(root, file.path))
          if (!filename.startsWith(`${root}${path.sep}`)) {
            respond(response, 403, {
              error: "File is outside the protocols folder",
            })
            return
          }
          if (request.method === "GET") {
            respond(response, 200, {
              source: fs.readFileSync(filename, "utf8"),
            })
            return
          }
          if (request.headers["x-bridgeflow-token"] !== token) {
            respond(response, 403, {
              error: "Reload the default folder before saving",
            })
            return
          }
          const body = await readBody(request)
          if (
            !/\.(md|markdown)$/i.test(filename) ||
            typeof body.source !== "string" ||
            typeof body.expectedSource !== "string" ||
            !/^##[ \t]+tx:/m.test(body.source) ||
            stripLayout(body.source) !== stripLayout(body.expectedSource)
          ) {
            respond(response, 400, {
              error: "Only graph layout changes can be saved here",
            })
            return
          }
          // No await between the conflict check and atomic replacement: simultaneous
          // saves cannot both accept the same old version within this server.
          if (fs.readFileSync(filename, "utf8") !== body.expectedSource) {
            respond(response, 409, {
              error: "File changed on disk. Reopen it before saving.",
            })
            return
          }
          const temporary = path.join(
            path.dirname(filename),
            `.bridgeflow-${randomUUID()}.tmp`
          )
          try {
            fs.writeFileSync(temporary, body.source, {
              mode: fs.statSync(filename).mode,
            })
            fs.renameSync(temporary, filename)
          } finally {
            fs.rmSync(temporary, { force: true })
          }
          respond(response, 200, { saved: file.path })
        } catch (error) {
          respond(response, 400, {
            error:
              error instanceof Error
                ? error.message
                : "Workspace request failed",
          })
        }
      })
    },
  }
}
