# QMind

[English](README.md) | [中文](README.zh-CN.md)

A mind-map workspace built with Next.js, MongoDB, and [xyflow](https://reactflow.dev/) — edit in the browser or via [MCP](https://modelcontextprotocol.io/) for AI agents.

## Features

- Create and manage mind maps from the home page; open a card to edit on a canvas
- Drag from a node's right handle onto empty space to create a child
- Keyboard: `Tab` adds a child, `Enter` adds a sibling, `Delete` removes a subtree
- Toolbar **Arrange** runs [ELK.js](https://github.com/kieler/elkjs) (right / down / radial); `L` / `Shift+L` shortcuts
- Per-node color, progress (0–100), and Markdown notes
- Save with the toolbar button or `Ctrl+S` (writes to MongoDB `qmind.maps`)
- Remote MCP server at `/api/mcp` with API keys generated in Settings

## Getting started

Requires a local MongoDB on port `27017` and Node.js.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open the URL printed in the terminal (default [http://localhost:3000](http://localhost:3000); if 3000 is taken it falls back to 3001).

## Environment variables

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | Defaults to `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | Defaults to `qmind` |
| `MCP_API_KEY` | Optional extra accepted MCP bearer key (prefer generating a key in Settings) |

Each map is stored as a single document (nodes and edges nested together). The list page only projects title and node count.

## MCP

QMind exposes the same editing capabilities as a remote MCP server at:

```
https://<your-host>/api/mcp
```

Locally that is `http://localhost:3000/api/mcp` (or whichever port `next dev` prints).

Open **Settings** on the home page and generate an API key. Copy the Cursor / agent snippet from the dialog. The key is shown once; QMind stores only a hash.

Until a key exists (and `MCP_API_KEY` is unset), the endpoint stays open. After you generate one, clients must send `Authorization: Bearer <key>`.

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

## License

[MIT](LICENSE)
