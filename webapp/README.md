# BridgeFlow

BridgeFlow is a Vite + React visualizer for Bitcoin protocol transaction graphs.

Graphs live in Markdown files under `../protocols/`. A graph Markdown file
uses a title, transaction headings, `bridgeflow` YAML fences for graph and
transaction metadata, and a hidden layout block. The parser also supports
optional Markdown descriptions when requested.

````md
# Graph title

```bridgeflow
color_groups:
  refund: orange
```

## tx: funding_tx

```bridgeflow
label: Funding tx
outputs:
  - amount: "1.00000000"
    spending_paths:
      - id: refund
        label: user refund
```
````

Layout changes made in Excalidraw are saved into a hidden
`bridgeflow:layout` comment block.

## Development

```bash
cd webapp
pnpm install
pnpm dev
```

Choose **Load default** to open the repository's `protocols/` folder. In the
local development app, **Save layout** writes transaction positions back into
the selected Markdown file. **Fit** shows the whole graph; zoom in to read and
drag a transaction group to move it. **Focus transaction** zooms to a selected
transaction for reading. A dot on **Save layout** marks unsaved positions.
External file changes are refreshed from disk without discarding an unsaved layout.

Use **Copy link** while viewing the default workspace to share the current file.
The address updates as you select files, so you can also copy it from your browser.
Links such as `?workspace=default&file=primitives%2Fbitvm3-challenge-response.md`
open the selected file automatically; `?workspace=default` opens the default graph.
Browser Back and Forward restore the selected file. Sharing supports the bundled
default workspace, including nested folders.

The development server only accepts layout changes to existing protocol Markdown
files and refuses to overwrite a file changed since it was opened. Reopen a file
if a save reports a conflict. Production builds use bundled files and offer
**Download layout** to save an updated Markdown copy; **Open folder** also allows
direct saving when the browser supports folder access.

## Static hosting

Run `pnpm build` and upload the contents of `dist/` to your static web server.
The build bundles the current `../protocols/` folder, opens it automatically,
and selects `clementine-v2.md` first. Rebuild after changing protocol files.
Assets use relative URLs, so the site can also be served from a subfolder.
The production site needs no backend; graph edits can be downloaded locally.
