# QMind

A mind-map workspace built with the Next.js App Router, MongoDB, and [xyflow](https://reactflow.dev/).

## Run

1. Start local MongoDB on `27017` (this repo defaults to `mongodb://127.0.0.1:27017`).
2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Install and start:

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (default [http://localhost:3000](http://localhost:3000); if 3000 is taken it falls back to 3001).

## Use

- Create a map from the home page, then open a card to edit
- Drag from a node's right handle onto empty space to create a child
- `Tab` adds a child, `Enter` adds a sibling, `Delete` removes a subtree
- Toolbar **Arrange** runs [ELK.js](https://github.com/kieler/elkjs) (right / down / radial)
- `L` arranges to the right, `Shift+L` uses radial layout
- Edits are written to MongoDB `qmind.maps` after about a second

Each map is stored as a single document (nodes and edges nested together). The list page only projects title and node count.

## MCP

QMind exposes the same editing capabilities as a remote [MCP](https://modelcontextprotocol.io/) server at:

```
https://<your-host>/api/mcp
```

Locally that is `http://localhost:3000/api/mcp` (or whichever port `next dev` prints).

Open **Settings** on the home page and generate an API key. Copy the Cursor / agent snippet from the dialog. The key is shown once; QMind stores only a hash.

Until a key exists (and `MCP_API_KEY` is unset), the endpoint stays open. After you generate one, clients must send `Authorization: Bearer <key>`.

You can still set `MCP_API_KEY` in the environment as an additional accepted key.

Stdio-only clients can proxy with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "qmind": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"]
    }
  }
}
```

Tools: `list_maps`, `create_map`, `get_map`, `rename_map`, `delete_map`, `get_node`, `add_node`, `update_node`, `delete_node`, `move_node`, `layout_map`, `search_nodes`.
