"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodePositionChange,
  type NodeSelectionChange,
  type Viewport,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { layoutWithElk } from "@/lib/elk-layout";
import {
  getDescendantIds,
  getParentId,
  insertAfterId,
  insertChildEdgeAfter,
  pickFocusAfterDelete,
  pickNodeInDirection,
  reorderSiblingsByPosition,
  wouldCreateCycle,
  type NavDirection,
} from "@/lib/graph";
import {
  COLOR_ORDER,
  DEFAULT_NODE_LABEL,
  type LayoutMode,
  type MindMapDocument,
  type MindMapNodeData,
  type NodeColor,
  type NodeProgress,
  type PersistedEdge,
  type PersistedNode,
} from "@/lib/types";

export type FlowNode = Node<MindMapNodeData, "mindmap">;
export type FlowEdge = Edge;

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type MindMapState = {
  mapId: string;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  saveStatus: SaveStatus;
  hydrated: boolean;
  lastSelectedId: string | null;
  selectionNavTick: number;
  hydrate: (map: MindMapDocument) => void;
  setTitle: (title: string) => void;
  setViewport: (viewport: Viewport) => void;
  markDirty: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  setLastSelectedId: (id: string | null) => void;
  focusNearestSelected: (point: { x: number; y: number }) => void;
  selectAdjacent: (direction: NavDirection) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addChildNode: (parentId: string, position?: { x: number; y: number }, afterId?: string) => string | null;
  addSiblingNode: (nodeId: string) => string | null;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeColor: (id: string, color: NodeColor) => void;
  updateNodeProgress: (id: string, progress: NodeProgress | undefined) => void;
  startEditing: (id: string) => void;
  finishEditing: (id: string) => void;
  deleteSelection: (nodeId?: string) => void;
  layouting: boolean;
  layoutTick: number;
  layoutMode: LayoutMode;
  autoLayout: (
    mode?: LayoutMode,
    options?: { fitView?: boolean },
  ) => Promise<void>;
};

function toFlowNodes(nodes: PersistedNode[]): FlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "mindmap",
    position: node.position,
    data: {
      label: node.data.label,
      color: node.data.color,
      progress: node.data.progress,
      isRoot: node.data.isRoot,
    },
  }));
}

function toFlowEdges(edges: PersistedEdge[]): FlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "mindmap",
  }));
}

function nextColor(parentColor: NodeColor): NodeColor {
  const index = COLOR_ORDER.indexOf(parentColor);
  return COLOR_ORDER[(index + 1) % COLOR_ORDER.length];
}

export function getFocusedNode(state: Pick<MindMapState, "nodes" | "lastSelectedId">): FlowNode | undefined {
  const { nodes, lastSelectedId } = state;
  return (
    nodes.find((node) => node.id === lastSelectedId && node.selected) ??
    nodes.find((node) => node.selected) ??
    nodes.find((node) => node.data.isRoot)
  );
}

function resolveLastSelectedId(
  nodes: FlowNode[],
  current: string | null,
  changes: NodeChange<FlowNode>[],
): string | null {
  const selectedIds = nodes.filter((node) => node.selected).map((node) => node.id);
  if (current && selectedIds.includes(current)) return current;
  const gained = changes
    .filter((change): change is NodeSelectionChange => change.type === "select" && change.selected)
    .map((change) => change.id);
  return gained.at(-1) ?? selectedIds.at(-1) ?? current;
}

export const useMindMapStore = create<MindMapState>((set, get) => {
  type GraphSnapshot = { nodes: FlowNode[]; edges: FlowEdge[]; gen: number };

  let pending: GraphSnapshot | null = null;
  let gen = 0;
  let flushPromise: Promise<void> | null = null;

  const graphNow = () =>
    pending ?? { nodes: get().nodes, edges: get().edges };

  const flushPendingLayout = () => {
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      while (pending) {
        const snapshot = pending;
        try {
          const laidOut = await layoutWithElk(
            snapshot.nodes,
            snapshot.edges,
            get().layoutMode,
          );
          if (pending?.gen !== snapshot.gen) continue;
          const positions = new Map(
            laidOut.map((node) => [node.id, node.position]),
          );
          pending = null;
          set({
            nodes: snapshot.nodes.map((node) => ({
              ...node,
              position: positions.get(node.id) ?? node.position,
            })),
            edges: snapshot.edges,
            saveStatus: get().hydrated ? "dirty" : get().saveStatus,
          });
        } catch (error) {
          console.error("ELK layout failed", error);
          if (pending?.gen !== snapshot.gen) continue;
          pending = null;
          set({
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            saveStatus: get().hydrated ? "dirty" : get().saveStatus,
            layouting: false,
          });
        }
      }
    })().finally(() => {
      flushPromise = null;
      if (pending) void flushPendingLayout();
    });
    return flushPromise;
  };

  const commitGraph = (nodes: FlowNode[], edges: FlowEdge[]) => {
    pending = { nodes, edges, gen: ++gen };
    void flushPendingLayout();
  };

  return {
  mapId: "",
  title: "",
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  saveStatus: "idle",
  hydrated: false,
  lastSelectedId: null,
  selectionNavTick: 0,
  layouting: false,
  layoutTick: 0,
  layoutMode: "RIGHT",

  hydrate: (map) => {
    const nodes = toFlowNodes(map.nodes);
    set({
      mapId: map.id,
      title: map.title,
      nodes,
      edges: toFlowEdges(map.edges),
      viewport: map.viewport,
      saveStatus: "saved",
      hydrated: true,
      lastSelectedId:
        nodes.find((node) => node.selected)?.id ??
        nodes.find((node) => node.data.isRoot)?.id ??
        nodes[0]?.id ??
        null,
    });
  },

  setTitle: (title) => set({ title, saveStatus: "dirty" }),

  setViewport: (viewport) => set({ viewport, saveStatus: "dirty" }),

  markDirty: () => {
    if (get().hydrated) set({ saveStatus: "dirty" });
  },

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setLastSelectedId: (lastSelectedId) => set({ lastSelectedId }),

  focusNearestSelected: (point) => {
    const selected = get().nodes.filter((node) => node.selected);
    if (selected.length === 0) return;
    let best = selected[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const node of selected) {
      const dist =
        (node.position.x - point.x) ** 2 + (node.position.y - point.y) ** 2;
      if (dist < bestDist) {
        best = node;
        bestDist = dist;
      }
    }
    set({ lastSelectedId: best.id });
  },

  selectAdjacent: (direction) => {
    const state = get();
    const current = getFocusedNode(state);
    if (!current) return;
    const alreadyOnCurrent =
      current.selected && state.lastSelectedId === current.id;
    const next = alreadyOnCurrent
      ? pickNodeInDirection(
          current,
          state.nodes,
          state.edges,
          direction,
          state.layoutMode,
        )
      : current;
    if (!next) return;
    set({
      lastSelectedId: next.id,
      selectionNavTick: state.selectionNavTick + 1,
      nodes: state.nodes.map((node) => ({
        ...node,
        selected: node.id === next.id,
        data: { ...node.data, editing: false },
      })),
    });
  },

  onNodesChange: (changes) => {
    const { nodes, edges, hydrated } = get();
    const moving = new Set(
      changes
        .filter((change): change is NodePositionChange => change.type === "position")
        .map((change) => change.id),
    );

    const extras: NodeChange<FlowNode>[] = [];
    for (const change of changes) {
      if (change.type !== "position" || !change.position) continue;
      const current = nodes.find((node) => node.id === change.id);
      if (!current) continue;
      const dx = change.position.x - current.position.x;
      const dy = change.position.y - current.position.y;
      if (dx === 0 && dy === 0) continue;
      for (const descendantId of getDescendantIds(change.id, edges)) {
        if (moving.has(descendantId)) continue;
        const descendant = nodes.find((node) => node.id === descendantId);
        if (!descendant) continue;
        extras.push({
          type: "position",
          id: descendantId,
          position: {
            x: descendant.position.x + dx,
            y: descendant.position.y + dy,
          },
          dragging: change.dragging,
        });
      }
    }

    const nextNodes = applyNodeChanges([...changes, ...extras], nodes);
    const dragEnded = [...changes, ...extras].some(
      (change) => change.type === "position" && change.dragging === false,
    );
    const removed = changes.some((change) => change.type === "remove");
    const lastSelectedId = resolveLastSelectedId(
      nextNodes,
      get().lastSelectedId,
      changes,
    );
    const primaryDragEnds = changes.filter(
      (change): change is NodePositionChange =>
        change.type === "position" && change.dragging === false,
    );
    const reordered =
      primaryDragEnds.length === 1
        ? reorderSiblingsByPosition(
            primaryDragEnds[0].id,
            nextNodes,
            edges,
            get().layoutMode,
          )
        : null;

    set({
      nodes: reordered?.nodes ?? nextNodes,
      edges: reordered?.edges ?? edges,
      lastSelectedId,
      saveStatus: hydrated && (dragEnded || removed || reordered) ? "dirty" : get().saveStatus,
    });
    if (reordered) {
      commitGraph(reordered.nodes, reordered.edges);
    }
  },

  onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    const removed = changes.some((change) => change.type === "remove");
    set({
      edges: nextEdges,
      saveStatus: get().hydrated && removed ? "dirty" : get().saveStatus,
    });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    if (wouldCreateCycle(connection.source, connection.target, get().edges)) {
      return;
    }
    set({
      edges: addEdge(
        { ...connection, type: "mindmap", id: `e-${nanoid(8)}` },
        get().edges,
      ),
      saveStatus: "dirty",
    });
  },

  addChildNode: (parentId, position, afterId) => {
    const parent = graphNow().nodes.find((node) => node.id === parentId);
    if (!parent) return null;
    const { nodes, edges } = graphNow();
    const afterNode = afterId ? nodes.find((node) => node.id === afterId) : undefined;
    const id = nanoid(10);
    const child: FlowNode = {
      id,
      type: "mindmap",
      position: position ?? afterNode?.position ?? parent.position,
      selected: true,
      data: {
        label: DEFAULT_NODE_LABEL,
        color: nextColor(parent.data.color),
        editing: true,
      },
    };
    commitGraph(
      insertAfterId(
        nodes.map((node) => ({
          ...node,
          selected: false,
          data: { ...node.data, editing: false },
        })),
        child,
        afterId,
      ),
      insertChildEdgeAfter(
        edges,
        {
          id: `e-${parentId}-${id}`,
          source: parentId,
          target: id,
          type: "mindmap",
        },
        afterId,
      ),
    );
    set({ lastSelectedId: id });
    return id;
  },

  addSiblingNode: (nodeId) => {
    const parentId = getParentId(nodeId, graphNow().edges);
    if (!parentId) return get().addChildNode(nodeId);
    return get().addChildNode(parentId, undefined, nodeId);
  },

  updateNodeLabel: (id, label) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label } }
          : node,
      ),
      saveStatus: "dirty",
    });
  },

  updateNodeColor: (id, color) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, color } }
          : node,
      ),
      saveStatus: "dirty",
    });
  },

  updateNodeProgress: (id, progress) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, progress } }
          : node,
      ),
      saveStatus: "dirty",
    });
  },

  startEditing: (id) => {
    set({
      lastSelectedId: id,
      nodes: get().nodes.map((node) => ({
        ...node,
        selected: node.id === id,
        data: { ...node.data, editing: node.id === id },
      })),
    });
  },

  finishEditing: (id) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== id) return node;
        const label = node.data.label.trim() || DEFAULT_NODE_LABEL;
        return {
          ...node,
          data: { ...node.data, label, editing: false },
        };
      }),
      saveStatus: "dirty",
    });
  },

  deleteSelection: (nodeId) => {
    const { nodes, edges } = graphNow();
    const selected = nodeId
      ? nodes.filter((node) => node.id === nodeId && !node.data.isRoot)
      : nodes.filter((node) => node.selected && !node.data.isRoot);
    if (selected.length === 0) return;
    const removeIds = new Set<string>();
    for (const node of selected) {
      removeIds.add(node.id);
      for (const id of getDescendantIds(node.id, edges)) {
        removeIds.add(id);
      }
    }
    const remaining = nodes.filter((node) => !removeIds.has(node.id));
    const remainingIds = new Set(remaining.map((node) => node.id));
    const focusId = selected[selected.length - 1]?.id;
    const nextSelectedId =
      (focusId ? pickFocusAfterDelete(focusId, remainingIds, edges) : null) ??
      remaining.find((node) => node.data.isRoot)?.id ??
      remaining[0]?.id ??
      null;

    commitGraph(
      remaining.map((node) => ({
        ...node,
        selected: node.id === nextSelectedId,
        data: { ...node.data, editing: false },
      })),
      edges.filter(
        (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target),
      ),
    );
    set({ lastSelectedId: nextSelectedId });
  },

  autoLayout: async (mode, options) => {
    const fitView = options?.fitView ?? true;
    if (mode) set({ layoutMode: mode });
    if (fitView) set({ layouting: true });
    const { nodes, edges } = graphNow();
    pending = { nodes, edges, gen: ++gen };
    await flushPendingLayout();
    if (fitView) {
      set({
        layouting: false,
        layoutTick: get().layoutTick + 1,
      });
    }
  },
  };
});
