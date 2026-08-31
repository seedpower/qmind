import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import { FLOW_NODE_ORIGIN, type LayoutMode } from "@/lib/types";

type LayoutableNode = {
  id: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  data: { label: string; isRoot?: boolean };
};

type LayoutableEdge = {
  id: string;
  source: string;
  target: string;
};

const elk = new ELK();

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

  const label = node.data.label ?? "";
  const padding = node.data.isRoot ? 56 : 48;
  const width = Math.max(
    node.data.isRoot ? 168 : 128,
    Math.min(320, padding + label.length * 13),
  );
  const height = node.data.isRoot ? 52 : 40;
  return { width, height };
}

export async function layoutWithElk<T extends LayoutableNode>(
  nodes: T[],
  edges: LayoutableEdge[],
  mode: LayoutMode = "RIGHT",
): Promise<T[]> {
  if (nodes.length === 0) return nodes;

  const sizes = new Map(nodes.map((node) => [node.id, measureNode(node)]));

  const graph: ElkNode = {
    id: "elk-root",
    layoutOptions: optionsFor(mode),
    children: nodes.map((node) => {
      const size = sizes.get(node.id)!;
      return {
        id: node.id,
        width: size.width,
        height: size.height,
      };
    }),
    edges: edges.map((edge) => ({
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
