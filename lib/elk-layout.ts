import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import { FLOW_NODE_ORIGIN, type LayoutMode } from "@/lib/types";

type LayoutableNode = {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  data: { label: string; isRoot?: boolean; progress?: number };
};

type LayoutableEdge = {
  id: string;
  source: string;
  target: string;
};

const elk = new ELK();

const NODE_MIN_WIDTH = { root: 168, node: 128 };
const NODE_PAD_X = { root: 32, node: 24 };
const NODE_FONT = { root: 18, node: 14 };
const NODE_HEIGHT = { root: 52, node: 40 };
const PROGRESS_EXTRA = 22;

function isWideGlyph(code: number) {
  return (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe1f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function estimateLabelWidth(label: string, fontSize: number) {
  let width = 0;
  for (const char of label) {
    const code = char.codePointAt(0) ?? 0;
    if (isWideGlyph(code)) {
      width += fontSize;
    } else if (char === " ") {
      width += fontSize * 0.32;
    } else {
      width += fontSize * 0.62;
    }
  }
  return width;
}

function orderForestForLayout<N extends LayoutableNode, E extends LayoutableEdge>(
  nodes: N[],
  edges: E[],
): { nodes: N[]; edges: E[] } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const childIds = new Set(edges.map((edge) => edge.target));
  const roots = nodes.filter((node) => !childIds.has(node.id));
  roots.sort((a, b) => Number(Boolean(b.data.isRoot)) - Number(Boolean(a.data.isRoot)));

  const orderedNodes: N[] = [];
  const orderedEdges: E[] = [];
  const seen = new Set<string>();
  const edgeByPair = new Map(
    edges.map((edge) => [`${edge.source}\0${edge.target}`, edge]),
  );

  function walk(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (node) orderedNodes.push(node);
    for (const childId of children.get(id) ?? []) {
      const edge = edgeByPair.get(`${id}\0${childId}`);
      if (edge) orderedEdges.push(edge);
      walk(childId);
    }
  }

  for (const root of roots) walk(root.id);
  for (const node of nodes) {
    if (!seen.has(node.id)) walk(node.id);
  }
  for (const edge of edges) {
    if (!orderedEdges.includes(edge)) orderedEdges.push(edge);
  }

  return { nodes: orderedNodes, edges: orderedEdges };
}

function optionsFor(mode: LayoutMode): Record<string, string> {
  if (mode === "RADIAL") {
    return {
      "elk.algorithm": "radial",
      "elk.spacing.nodeNode": "72",
      "elk.radial.compactor": "RADIAL_COMPACTION",
    };
  }

  return {
    "elk.algorithm": "layered",
    "elk.direction": mode,
    "elk.edgeRouting": "SPLINES",
    "elk.layered.spacing.nodeNodeBetweenLayers": "96",
    "elk.spacing.nodeNode": "36",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.separateConnectedComponents": "true",
  };
}

function measureNode(node: LayoutableNode): { width: number; height: number } {
  const measuredWidth = node.measured?.width ?? node.width;
  const measuredHeight = node.measured?.height ?? node.height;
  if (measuredWidth && measuredHeight) {
    return { width: measuredWidth, height: measuredHeight };
  }

  const isRoot = Boolean(node.data.isRoot);
  const fontSize = isRoot ? NODE_FONT.root : NODE_FONT.node;
  const paddingX = isRoot ? NODE_PAD_X.root : NODE_PAD_X.node;
  const minWidth = isRoot ? NODE_MIN_WIDTH.root : NODE_MIN_WIDTH.node;
  const progress = node.data.progress != null ? PROGRESS_EXTRA : 0;
  const width = Math.max(
    minWidth,
    Math.min(320, paddingX + progress + estimateLabelWidth(node.data.label ?? "", fontSize)),
  );
  const height = isRoot ? NODE_HEIGHT.root : NODE_HEIGHT.node;
  return { width, height };
}

export async function layoutWithElk<T extends LayoutableNode>(
  nodes: T[],
  edges: LayoutableEdge[],
  mode: LayoutMode = "RIGHT",
): Promise<T[]> {
  if (nodes.length === 0) return nodes;

  const forest = orderForestForLayout(nodes, edges);
  const sizes = new Map(nodes.map((node) => [node.id, measureNode(node)]));

  const graph: ElkNode = {
    id: "elk-root",
    layoutOptions: optionsFor(mode),
    children: forest.nodes.map((node) => {
      const size = sizes.get(node.id)!;
      return {
        id: node.id,
        width: size.width,
        height: size.height,
      };
    }),
    edges: forest.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layouted = await elk.layout(graph);
  const placed = new Map(
    (layouted.children ?? []).map((child) => [child.id, child]),
  );
  const [ox, oy] = FLOW_NODE_ORIGIN;

  return nodes.map((node) => {
    const elkNode = placed.get(node.id);
    if (elkNode?.x == null || elkNode.y == null) return node;
    const size = sizes.get(node.id)!;
    return {
      ...node,
      position: {
        x: elkNode.x + size.width * ox,
        y: elkNode.y + size.height * oy,
      },
    };
  });
}
