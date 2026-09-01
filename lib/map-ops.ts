import "server-only";

import { nanoid } from "nanoid";
import {
  getDescendantIds,
  getParentId,
  insertAfterId,
  insertChildEdgeAfter,
  wouldCreateCycle,
} from "@/lib/graph";
import { layoutWithElk } from "@/lib/elk-layout";
import {
  createMap,
  deleteMap,
  getMap,
  listMaps,
  updateMap,
} from "@/lib/maps";
import {
  COLOR_ORDER,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_LABEL,
  MAX_NODE_MARKDOWN,
  type LayoutMode,
  type MindMapDocument,
  type NodeColor,
  type NodeProgress,
  type PersistedEdge,
  type PersistedNode,
} from "@/lib/types";

export class MapOpsError extends Error {
  constructor(
    public readonly code: "not_found" | "bad_request",
    message: string,
  ) {
    super(message);
    this.name = "MapOpsError";
  }
}

export type MapOutlineNode = {
  id: string;
  label: string;
  color: NodeColor;
  progress?: NodeProgress;
  notes: boolean;
  markdown?: string;
  children: MapOutlineNode[];
};

export type NodeSearchHit = {
  mapId: string;
  mapTitle: string;
  nodeId: string;
  label: string;
  snippet: string;
};

async function requireMap(id: string): Promise<MindMapDocument> {
  const map = await getMap(id);
  if (!map) throw new MapOpsError("not_found", `Map not found: ${id}`);
  return map;
}

function requireNode(map: MindMapDocument, nodeId: string): PersistedNode {
  const node = map.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new MapOpsError("not_found", `Node not found: ${nodeId}`);
  }
  return node;
}

function rootOf(map: MindMapDocument): PersistedNode {
  return map.nodes.find((node) => node.data.isRoot) ?? map.nodes[0]!;
}

function buildOutline(
  map: MindMapDocument,
  includeNotes: boolean,
): MapOutlineNode[] {
  const children = new Map<string, string[]>();
  const childIds = new Set<string>();
  for (const edge of map.edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
    childIds.add(edge.target);
  }
  const byId = new Map(map.nodes.map((node) => [node.id, node]));

  function walk(id: string, seen: Set<string>): MapOutlineNode | null {
    if (seen.has(id)) return null;
    seen.add(id);
    const node = byId.get(id);
    if (!node) return null;
    return {
      id: node.id,
      label: node.data.label,
      color: node.data.color,
      ...(node.data.progress != null ? { progress: node.data.progress } : {}),
      notes: Boolean(node.data.markdown),
      ...(includeNotes && node.data.markdown
        ? { markdown: node.data.markdown }
        : {}),
      children: (children.get(id) ?? []).flatMap((childId) => {
        const child = walk(childId, seen);
        return child ? [child] : [];
      }),
    };
  }

  const roots = map.nodes.filter(
    (node) => node.data.isRoot || !childIds.has(node.id),
  );
  const seen = new Set<string>();
  return roots.flatMap((node) => {
    const tree = walk(node.id, seen);
    return tree ? [tree] : [];
  });
}

function summarizeMap(map: MindMapDocument, includeNotes: boolean) {
  return {
    id: map.id,
    title: map.title,
    nodeCount: map.nodeCount,
    updatedAt: map.updatedAt,
    tree: buildOutline(map, includeNotes),
  };
}

function persistGraph(map: MindMapDocument, nodes: PersistedNode[], edges: PersistedEdge[]) {
  return updateMap(map.id, { nodes, edges });
}

export async function listMindMaps() {
  return listMaps();
}

export async function createMindMap(title?: string, rootLabel?: string) {
  const map = await createMap(title, rootLabel);
  return summarizeMap(map, false);
}

export async function getMindMap(mapId: string, includeNotes = false) {
  const map = await requireMap(mapId);
  return summarizeMap(map, includeNotes);
}

export async function renameMindMap(mapId: string, title: string) {
  const map = await updateMap(mapId, { title });
  if (!map) throw new MapOpsError("not_found", `Map not found: ${mapId}`);
  return { id: map.id, title: map.title, updatedAt: map.updatedAt };
}

export async function removeMindMap(mapId: string) {
  const ok = await deleteMap(mapId);
  if (!ok) throw new MapOpsError("not_found", `Map not found: ${mapId}`);
  return { ok: true, id: mapId };
}

export async function getMindMapNode(mapId: string, nodeId: string) {
  const map = await requireMap(mapId);
  const node = requireNode(map, nodeId);
  return {
    mapId: map.id,
    mapTitle: map.title,
    id: node.id,
    label: node.data.label,
    color: node.data.color,
    progress: node.data.progress ?? null,
    isRoot: Boolean(node.data.isRoot),
    parentId: getParentId(node.id, map.edges),
    markdown: node.data.markdown ?? "",
  };
}

export async function addMindMapNode(input: {
  mapId: string;
  parentId?: string;
  afterId?: string;
  label?: string;
  color?: NodeColor;
  progress?: NodeProgress;
  markdown?: string;
}) {
  const map = await requireMap(input.mapId);
  const parent = input.parentId
    ? requireNode(map, input.parentId)
    : rootOf(map);
  if (input.afterId) requireNode(map, input.afterId);
  const id = nanoid(10);
  const markdown = input.markdown?.slice(0, MAX_NODE_MARKDOWN).trim();
  const child: PersistedNode = {
    id,
    type: "mindmap",
    position: { ...parent.position },
    data: {
      label: (input.label?.trim() || DEFAULT_NODE_LABEL).slice(0, 200),
      color: input.color ?? DEFAULT_NODE_COLOR,
      ...(input.progress != null ? { progress: input.progress } : {}),
      ...(markdown ? { markdown } : {}),
    },
  };
  const nodes = insertAfterId(map.nodes, child, input.afterId);
  const edges = insertChildEdgeAfter(
    map.edges,
    {
      id: `e-${parent.id}-${id}`,
      source: parent.id,
      target: id,
      type: "mindmap",
    },
    input.afterId,
  );
  const next = await persistGraph(map, nodes, edges);
  if (!next) throw new MapOpsError("not_found", `Map not found: ${input.mapId}`);
  return {
    mapId: next.id,
    node: {
      id,
      parentId: parent.id,
      label: child.data.label,
      color: child.data.color,
      progress: child.data.progress ?? null,
    },
    nodeCount: next.nodeCount,
  };
}

export async function updateMindMapNode(input: {
  mapId: string;
  nodeId: string;
  label?: string;
  color?: NodeColor;
  progress?: NodeProgress | null;
  markdown?: string;
}) {
  const map = await requireMap(input.mapId);
  requireNode(map, input.nodeId);
  const nodes = map.nodes.map((node) => {
    if (node.id !== input.nodeId) return node;
    const markdown =
      input.markdown === undefined
        ? node.data.markdown
        : input.markdown.slice(0, MAX_NODE_MARKDOWN);
    const progress =
      input.progress === undefined
        ? node.data.progress
        : input.progress === null
          ? undefined
          : input.progress;
    return {
      ...node,
      data: {
        label:
          input.label !== undefined
            ? (input.label.trim() || DEFAULT_NODE_LABEL).slice(0, 200)
            : node.data.label,
        color: input.color ?? node.data.color,
        ...(progress != null ? { progress } : {}),
        ...(node.data.isRoot ? { isRoot: true } : {}),
        ...(markdown ? { markdown } : {}),
      },
    };
  });
  const next = await persistGraph(map, nodes, map.edges);
  if (!next) throw new MapOpsError("not_found", `Map not found: ${input.mapId}`);
  return getMindMapNode(next.id, input.nodeId);
}

export async function deleteMindMapNode(mapId: string, nodeId: string) {
  const map = await requireMap(mapId);
  const node = requireNode(map, nodeId);
  if (node.data.isRoot) {
    throw new MapOpsError("bad_request", "The root node cannot be deleted");
  }
  const removeIds = new Set([nodeId, ...getDescendantIds(nodeId, map.edges)]);
  const nodes = map.nodes.filter((item) => !removeIds.has(item.id));
  const edges = map.edges.filter(
    (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target),
  );
  const next = await persistGraph(map, nodes, edges);
  if (!next) throw new MapOpsError("not_found", `Map not found: ${mapId}`);
  return { ok: true, removed: [...removeIds], nodeCount: next.nodeCount };
}

export async function moveMindMapNode(input: {
  mapId: string;
  nodeId: string;
  parentId: string;
  afterId?: string;
}) {
  const map = await requireMap(input.mapId);
  const node = requireNode(map, input.nodeId);
  if (node.data.isRoot) {
    throw new MapOpsError("bad_request", "The root node cannot be moved");
  }
  requireNode(map, input.parentId);
  if (input.afterId) requireNode(map, input.afterId);
  if (wouldCreateCycle(input.parentId, input.nodeId, map.edges)) {
    throw new MapOpsError("bad_request", "That move would create a cycle");
  }
  const without = map.edges.filter((edge) => edge.target !== input.nodeId);
  const edges = insertChildEdgeAfter(
    without,
    {
      id: `e-${input.parentId}-${input.nodeId}`,
      source: input.parentId,
      target: input.nodeId,
      type: "mindmap",
    },
    input.afterId,
  );
  const next = await persistGraph(map, map.nodes, edges);
  if (!next) throw new MapOpsError("not_found", `Map not found: ${input.mapId}`);
  return {
    ok: true,
    nodeId: input.nodeId,
    parentId: input.parentId,
  };
}

export async function layoutMindMap(mapId: string, mode: LayoutMode = "RIGHT") {
  const map = await requireMap(mapId);
  const nodes = await layoutWithElk(map.nodes, map.edges, mode);
  const next = await persistGraph(map, nodes, map.edges);
  if (!next) throw new MapOpsError("not_found", `Map not found: ${mapId}`);
  return { ok: true, mapId: next.id, mode, nodeCount: next.nodeCount };
}

function snippetAround(text: string, query: string, max = 160) {
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) return text.slice(0, max);
  const start = Math.max(0, index - 36);
  const chunk = text.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${chunk}${start + max < text.length ? "…" : ""}`;
}

export async function searchMindMapNodes(query: string, mapId?: string) {
  const needle = query.trim();
  if (!needle) {
    throw new MapOpsError("bad_request", "Search query cannot be empty");
  }
  const maps = mapId
    ? [await requireMap(mapId)]
    : await Promise.all((await listMaps()).map((item) => getMap(item.id)));
  const hits: NodeSearchHit[] = [];
  for (const map of maps) {
    if (!map) continue;
    for (const node of map.nodes) {
      const haystack = `${node.data.label}\n${node.data.markdown ?? ""}`;
      if (!haystack.toLowerCase().includes(needle.toLowerCase())) continue;
      hits.push({
        mapId: map.id,
        mapTitle: map.title,
        nodeId: node.id,
        label: node.data.label,
        snippet: snippetAround(haystack, needle),
      });
      if (hits.length >= 50) return hits;
    }
  }
  return hits;
}

export const MCP_NODE_COLORS = COLOR_ORDER;
export const MCP_LAYOUT_MODES = ["RIGHT", "DOWN", "RADIAL"] as const;
