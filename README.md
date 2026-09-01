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
