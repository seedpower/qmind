import type { LayoutMode, NodeColor, NodeProgress } from "@/lib/types";

export type NodeClipboard = {
  nodes: {
    id: string;
    position: { x: number; y: number };
    data: {
      label: string;
      color: NodeColor;
      progress?: NodeProgress;
      markdown?: string;
    };
  }[];
  edges: { source: string; target: string }[];
  rootIds: string[];
};

type ClipboardSourceNode = {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    color: NodeColor;
    progress?: NodeProgress;
    markdown?: string;
  };
};

/** Copy selected nodes plus their descendants, collapsing nested selections into a forest. */
export function collectNodeClipboard(
  selectedIds: Iterable<string>,
  nodes: ClipboardSourceNode[],
  edges: { source: string; target: string }[],
): NodeClipboard | null {
  const selectedSet = new Set(selectedIds);
  const knownIds = new Set(nodes.map((node) => node.id));
  const copyIds = new Set<string>();
  for (const id of selectedSet) {
    if (!knownIds.has(id)) continue;
    copyIds.add(id);
    for (const descendantId of getDescendantIds(id, edges)) {
      copyIds.add(descendantId);
    }
  }
  if (copyIds.size === 0) return null;

  const rootIds = nodes
    .map((node) => node.id)
    .filter((id) => {
      if (!selectedSet.has(id) || !copyIds.has(id)) return false;
      const parentId = getParentId(id, edges);
      return !parentId || !copyIds.has(parentId);
    });
  if (rootIds.length === 0) return null;

  return {
    nodes: nodes
      .filter((node) => copyIds.has(node.id))
      .map((node) => ({
        id: node.id,
        position: { ...node.position },
        data: {
          label: node.data.label,
          color: node.data.color,
          progress: node.data.progress,
          markdown: node.data.markdown,
        },
      })),
    edges: edges
      .filter((edge) => copyIds.has(edge.source) && copyIds.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target })),
    rootIds,
  };
}

export function cloneClipboardOnto(
  clipboard: NodeClipboard,
  parentId: string,
  makeId: () => string,
): {
  nodes: NodeClipboard["nodes"];
  edges: { id: string; source: string; target: string }[];
  rootIds: string[];
} {
  const idMap = new Map<string, string>();
  for (const node of clipboard.nodes) {
    idMap.set(node.id, makeId());
  }

  const mappedId = (id: string) => idMap.get(id)!;

  return {
    nodes: clipboard.nodes.map((node) => ({
      id: mappedId(node.id),
      position: { ...node.position },
      data: { ...node.data },
    })),
    edges: [
      ...clipboard.edges.map((edge) => ({
        id: `e-${mappedId(edge.source)}-${mappedId(edge.target)}`,
        source: mappedId(edge.source),
        target: mappedId(edge.target),
      })),
      ...clipboard.rootIds.map((id) => ({
        id: `e-${parentId}-${mappedId(id)}`,
        source: parentId,
        target: mappedId(id),
      })),
    ],
    rootIds: clipboard.rootIds.map(mappedId),
  };
}

export function getDescendantIds(
  nodeId: string,
  edges: { source: string; target: string }[],
): Set<string> {
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }

  const result = new Set<string>();
  const stack = [...(children.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

export function getParentId(
  nodeId: string,
  edges: { source: string; target: string }[],
): string | null {
  return edges.find((edge) => edge.target === nodeId)?.source ?? null;
}

export function getChildIds(
  parentId: string,
  edges: { source: string; target: string }[],
): string[] {
  return edges
    .filter((edge) => edge.source === parentId)
    .map((edge) => edge.target);
}

export function insertAfterId<T extends { id: string }>(
  items: T[],
  item: T,
  afterId?: string | null,
): T[] {
  if (!afterId) return [...items, item];
  const index = items.findIndex((entry) => entry.id === afterId);
  if (index < 0) return [...items, item];
  return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
}

export function insertChildEdgeAfter<E extends { source: string; target: string }>(
  edges: E[],
  edge: E,
  afterTargetId?: string | null,
): E[] {
  if (!afterTargetId) return [...edges, edge];
  const index = edges.findIndex(
    (entry) => entry.source === edge.source && entry.target === afterTargetId,
  );
  if (index < 0) return [...edges, edge];
  return [...edges.slice(0, index + 1), edge, ...edges.slice(index + 1)];
}

export type NavDirection = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

const NAV_AXIS: Record<NavDirection, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

type NavNode = { id: string; position: { x: number; y: number } };
type NavEdge = { source: string; target: string };

function findNode<T extends NavNode>(nodes: T[], id: string | null): T | null {
  if (!id) return null;
  return nodes.find((node) => node.id === id) ?? null;
}

function nearestInDirection<T extends NavNode>(
  origin: T,
  nodes: T[],
  direction: NavDirection,
): T | null {
  const axis = NAV_AXIS[direction];
  let best: T | null = null;
  let bestScore = Infinity;

  for (const node of nodes) {
    if (node.id === origin.id) continue;
    const vx = node.position.x - origin.position.x;
    const vy = node.position.y - origin.position.y;
    const forward = vx * axis.x + vy * axis.y;
    const lateral = Math.abs(vx * axis.y - vy * axis.x);
    const score =
      forward > 1
        ? forward * forward + lateral * lateral * 4
        : 1e12 + vx * vx + vy * vy;
    if (score < bestScore) {
      best = node;
      bestScore = score;
    }
  }

  return best;
}

function navAxes(
  origin: NavNode,
  parent: NavNode | null,
  layoutMode: LayoutMode,
): {
  inward: NavDirection;
  outward: NavDirection;
  prev: NavDirection;
  next: NavDirection;
} {
  if (layoutMode === "DOWN") {
    return {
      inward: "ArrowUp",
      outward: "ArrowDown",
      prev: "ArrowLeft",
      next: "ArrowRight",
    };
  }
  if (layoutMode === "RIGHT" || !parent) {
    return {
      inward: "ArrowLeft",
      outward: "ArrowRight",
      prev: "ArrowUp",
      next: "ArrowDown",
    };
  }

  const vx = parent.position.x - origin.position.x;
  const vy = parent.position.y - origin.position.y;
  if (Math.abs(vx) >= Math.abs(vy)) {
    return vx < 0
      ? {
          inward: "ArrowLeft",
          outward: "ArrowRight",
          prev: "ArrowUp",
          next: "ArrowDown",
        }
      : {
          inward: "ArrowRight",
          outward: "ArrowLeft",
          prev: "ArrowUp",
          next: "ArrowDown",
        };
  }
  return vy < 0
    ? {
        inward: "ArrowUp",
        outward: "ArrowDown",
        prev: "ArrowLeft",
        next: "ArrowRight",
      }
    : {
        inward: "ArrowDown",
        outward: "ArrowUp",
        prev: "ArrowLeft",
        next: "ArrowRight",
      };
}

function siblingOrder<T extends NavNode>(nodes: T[], layoutMode: LayoutMode): T[] {
  if (layoutMode === "DOWN") {
    return [...nodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  }
  return [...nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
}

/** Walk the mind-map tree: inward to parent, outward to a child, sideways among siblings. */
export function pickNodeInDirection<T extends NavNode>(
  origin: T,
  nodes: T[],
  edges: NavEdge[],
  direction: NavDirection,
  layoutMode: LayoutMode,
): T | null {
  const parent = findNode(nodes, getParentId(origin.id, edges));
  const { inward, outward, prev, next } = navAxes(origin, parent, layoutMode);

  if (direction === inward) return parent;

  if (direction === outward) {
    const children = getChildIds(origin.id, edges)
      .map((id) => findNode(nodes, id))
      .filter((node): node is T => node !== null);
    if (children.length === 0) return null;
    return nearestInDirection(origin, children, direction) ?? children[0];
  }

  if (direction !== prev && direction !== next) return null;

  const familyIds = parent
    ? getChildIds(parent.id, edges)
    : nodes.filter((node) => getParentId(node.id, edges) === null).map((node) => node.id);
  const family = familyIds
    .map((id) => findNode(nodes, id))
    .filter((node): node is T => node !== null);
  const ordered = siblingOrder(family, layoutMode);
  const index = ordered.findIndex((node) => node.id === origin.id);
  if (index < 0) return null;
  return direction === prev ? (ordered[index - 1] ?? null) : (ordered[index + 1] ?? null);
}

function siblingSortValue(
  node: NavNode,
  parent: NavNode | null,
  layoutMode: LayoutMode,
): number {
  if (layoutMode === "DOWN") return node.position.x;
  if (layoutMode === "RADIAL" && parent) {
    return Math.atan2(
      node.position.y - parent.position.y,
      node.position.x - parent.position.x,
    );
  }
  return node.position.y;
}

function spliceGroupByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const idSet = new Set(orderedIds);
  const byId = new Map(items.map((item) => [item.id, item]));
  const result: T[] = [];
  let inserted = false;
  for (const item of items) {
    if (!idSet.has(item.id)) {
      result.push(item);
      continue;
    }
    if (inserted) continue;
    for (const id of orderedIds) {
      const next = byId.get(id);
      if (next) result.push(next);
    }
    inserted = true;
  }
  return result;
}

/** Reorder a node's siblings from its dropped position. Returns null if order is unchanged. */
export function reorderSiblingsByPosition<T extends NavNode, E extends NavEdge>(
  draggedId: string,
  nodes: T[],
  edges: E[],
  layoutMode: LayoutMode,
): { nodes: T[]; edges: E[] } | null {
  const parentId = getParentId(draggedId, edges);
  if (!parentId) return null;
  const siblingIds = getChildIds(parentId, edges);
  if (siblingIds.length < 2 || !siblingIds.includes(draggedId)) return null;

  const parent = findNode(nodes, parentId);
  const siblings = siblingIds
    .map((id) => findNode(nodes, id))
    .filter((node): node is T => node !== null);
  const nextIds = [...siblings]
    .sort((a, b) => {
      const delta =
        siblingSortValue(a, parent, layoutMode) -
        siblingSortValue(b, parent, layoutMode);
      return delta || siblingIds.indexOf(a.id) - siblingIds.indexOf(b.id);
    })
    .map((node) => node.id);
  if (nextIds.every((id, index) => id === siblingIds[index])) return null;

  const idSet = new Set(nextIds);
  const edgeByTarget = new Map(
    edges
      .filter((edge) => edge.source === parentId && idSet.has(edge.target))
      .map((edge) => [edge.target, edge]),
  );
  const siblingEdges = nextIds
    .map((id) => edgeByTarget.get(id))
    .filter((edge): edge is E => edge !== undefined);
  const firstIdx = edges.findIndex(
    (edge) => edge.source === parentId && idSet.has(edge.target),
  );
  const rest = edges.filter(
    (edge) => !(edge.source === parentId && idSet.has(edge.target)),
  );
  const insertAt = firstIdx < 0 ? rest.length : Math.min(firstIdx, rest.length);

  return {
    nodes: spliceGroupByIds(nodes, nextIds),
    edges: [...rest.slice(0, insertAt), ...siblingEdges, ...rest.slice(insertAt)],
  };
}

/** After deleting `focusId`, pick the next node to keep selected. */
export function pickFocusAfterDelete(
  focusId: string,
  remainingIds: Set<string>,
  edges: { source: string; target: string }[],
): string | null {
  const parentId = getParentId(focusId, edges);
  if (parentId) {
    const siblings = getChildIds(parentId, edges);
    const index = siblings.indexOf(focusId);
    const next = siblings.slice(index + 1).find((id) => remainingIds.has(id));
    if (next) return next;
    const prev = [...siblings.slice(0, Math.max(index, 0))]
      .reverse()
      .find((id) => remainingIds.has(id));
    if (prev) return prev;
    if (remainingIds.has(parentId)) return parentId;
  }

  return remainingIds.has(focusId) ? focusId : null;
}

export function wouldCreateCycle(
  source: string,
  target: string,
  edges: { source: string; target: string }[],
): boolean {
  if (source === target) return true;
  return getDescendantIds(target, edges).has(source);
}

export function siblingOffset(
  parentId: string,
  edges: { source: string; target: string }[],
): number {
  const count = edges.filter((edge) => edge.source === parentId).length;
  const mid = (count - 1) / 2;
  return (count - mid) * 70;
}
