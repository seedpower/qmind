import type { LayoutMode } from "@/lib/types";

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
