export const NODE_COLORS = {
  amber: { bg: "#fff6e5", border: "#e8a838", text: "#7a4b00" },
  rose: { bg: "#fff0f1", border: "#e85d6c", text: "#8a2030" },
  teal: { bg: "#e9f8f5", border: "#2fafa3", text: "#0f5c55" },
  violet: { bg: "#f3efff", border: "#8b6cc9", text: "#4c2d8a" },
  sky: { bg: "#eaf5ff", border: "#4d9de0", text: "#1a4e7a" },
  lime: { bg: "#f3f8e3", border: "#8fb03e", text: "#3f5614" },
  stone: { bg: "#f6f1e8", border: "#b5a48c", text: "#3f382f" },
} as const;

export type NodeColor = keyof typeof NODE_COLORS;

export const COLOR_ORDER = Object.keys(NODE_COLORS) as NodeColor[];

export type MindMapNodeData = {
  label: string;
  color: NodeColor;
  isRoot?: boolean;
  editing?: boolean;
};

export type PersistedNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    color: NodeColor;
    isRoot?: boolean;
  };
};

export type PersistedEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type MindMapSummary = {
  id: string;
  title: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MindMapDocument = MindMapSummary & {
  nodes: PersistedNode[];
  edges: PersistedEdge[];
  viewport: Viewport;
};

export const MAX_NODES = 2000;

/** React Flow node origin: position is the center of each mindmap node. */
export const FLOW_NODE_ORIGIN: [number, number] = [0.5, 0.5];

export type LayoutMode = "RIGHT" | "DOWN" | "RADIAL";
