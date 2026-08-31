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
