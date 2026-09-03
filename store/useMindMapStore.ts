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
  type NodeDimensionChange,
  type NodePositionChange,
  type NodeSelectionChange,
  type Viewport,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { layoutWithElk } from "@/lib/elk-layout";
import {
  cloneClipboardOnto,
  collectNodeClipboard,
  getDescendantIds,
  getParentId,
  insertAfterId,
  insertChildEdgeAfter,
  pickFocusAfterDelete,
  pickNodeInDirection,
  reorderSiblingsByPosition,
  wouldCreateCycle,
  type NavDirection,
  type NodeClipboard,
} from "@/lib/graph";
import {
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_LABEL,
  MAX_NODE_MARKDOWN,
  MAX_NODES,
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

const HISTORY_LIMIT = 50;

type HistoryEntry = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  layoutMode: LayoutMode;
  lastSelectedId: string | null;
};

function cloneHistoryNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data, editing: false, editSelectAll: undefined },
    selected: Boolean(node.selected),
    dragging: false,
  }));
}

function cloneHistoryEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map((edge) => ({ ...edge }));
}

function graphSignature(
  nodes: FlowNode[],
  edges: FlowEdge[],
  layoutMode: LayoutMode,
) {
  return JSON.stringify({
    layoutMode,
    nodes: nodes.map((node) => [
      node.id,
      node.position.x,
      node.position.y,
      node.data.label,
      node.data.color,
      node.data.progress ?? null,
      node.data.markdown ?? "",
    ]),
    edges: edges.map((edge) => [edge.id, edge.source, edge.target]),
  });
}

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
  clipboard: NodeClipboard | null;
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
  copySelection: () => void;
  cutSelection: () => void;
  pasteOntoSelection: (parentId?: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeMarkdown: (id: string, markdown: string) => void;
  updateNodeColor: (id: string, color: NodeColor) => void;
  updateNodeProgress: (id: string, progress: NodeProgress | undefined) => void;
  startEditing: (id: string, options?: { text?: string; selectAll?: boolean }) => void;
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
      markdown: node.data.markdown,
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

export function getFocusedNode(state: Pick<MindMapState, "nodes" | "lastSelectedId">): FlowNode | undefined {
  const { nodes, lastSelectedId } = state;
  return (
    nodes.find((node) => node.id === lastSelectedId && node.selected) ??
    nodes.find((node) => node.selected) ??
    nodes.find((node) => node.data.isRoot)
  );
}

/** Selected node for the notes pane — never falls back to the unselected root. */
export function getSelectedEditNode(
  state: Pick<MindMapState, "nodes" | "lastSelectedId">,
): FlowNode | undefined {
  const { nodes, lastSelectedId } = state;
  return (
    nodes.find((node) => node.id === lastSelectedId && node.selected) ??
    nodes.find((node) => node.selected)
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
  const awaitingMeasure = new Set<string>();
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let dragOrigin: HistoryEntry | null = null;
  let labelBaseline: { id: string; label: string } | null = null;

  const graphNow = () =>
    pending ?? { nodes: get().nodes, edges: get().edges };

  const capture = (): HistoryEntry => {
    const { layoutMode, lastSelectedId } = get();
    const { nodes, edges } = graphNow();
    return {
      nodes: cloneHistoryNodes(nodes),
      edges: cloneHistoryEdges(edges),
      layoutMode,
      lastSelectedId,
    };
  };

  const recordHistory = () => {
    if (!get().hydrated) {
      return { canUndo: past.length > 0, canRedo: future.length > 0 };
    }
    past.push(capture());
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    return { canUndo: true, canRedo: false };
  };

  const applyHistory = (entry: HistoryEntry) => {
    pending = null;
    gen += 1;
    awaitingMeasure.clear();
    dragOrigin = null;
    labelBaseline = null;
    set({
      nodes: cloneHistoryNodes(entry.nodes),
      edges: cloneHistoryEdges(entry.edges),
      layoutMode: entry.layoutMode,
      lastSelectedId: entry.lastSelectedId,
      saveStatus: get().hydrated ? "dirty" : get().saveStatus,
      layouting: false,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    });
  };

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

  const commitRemoval = (
    selected: FlowNode[],
    nodes: FlowNode[],
    edges: FlowEdge[],
  ) => {
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
    return nextSelectedId;
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
  clipboard: null,
  canUndo: false,
  canRedo: false,
  layouting: false,
  layoutTick: 0,
  layoutMode: "RIGHT",

  hydrate: (map) => {
    pending = null;
    gen += 1;
    awaitingMeasure.clear();
    past = [];
    future = [];
    dragOrigin = null;
    labelBaseline = null;
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
      canUndo: false,
      canRedo: false,
    });
  },

  setTitle: (title) => set({ title, saveStatus: "dirty" }),

  setViewport: (viewport) => set({ viewport }),

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
    if (
      !dragOrigin &&
      changes.some(
        (change): change is NodePositionChange =>
          change.type === "position" && change.dragging === true,
      )
    ) {
      dragOrigin = capture();
    }
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

    const nextGraph = {
      nodes: reordered?.nodes ?? nextNodes,
      edges: reordered?.edges ?? edges,
    };
    const origin = dragEnded ? dragOrigin : null;
    const dragMoved =
      origin !== null &&
      graphSignature(origin.nodes, origin.edges, origin.layoutMode) !==
        graphSignature(nextGraph.nodes, nextGraph.edges, get().layoutMode);
    const history =
      dragMoved && hydrated
        ? (() => {
            past.push(origin);
            if (past.length > HISTORY_LIMIT) past.shift();
            future = [];
            return { canUndo: true, canRedo: false };
          })()
        : {};
    if (dragEnded) dragOrigin = null;

    set({
      nodes: nextGraph.nodes,
      edges: nextGraph.edges,
      lastSelectedId,
      saveStatus:
        hydrated && (dragMoved || removed || reordered)
          ? "dirty"
          : get().saveStatus,
      ...history,
    });
    if (reordered) {
      commitGraph(reordered.nodes, reordered.edges);
    } else {
      const measuredIds = changes
        .filter(
          (change): change is NodeDimensionChange =>
            change.type === "dimensions" && Boolean(change.dimensions),
        )
        .map((change) => change.id)
        .filter((id) => awaitingMeasure.has(id));
      if (measuredIds.length > 0) {
        for (const id of measuredIds) awaitingMeasure.delete(id);
        commitGraph(nextNodes, edges);
      }
    }
  },

  onEdgesChange: (changes) => {
    const removed = changes.some((change) => change.type === "remove");
    const history = removed ? recordHistory() : {};
    const nextEdges = applyEdgeChanges(changes, get().edges);
    set({
      edges: nextEdges,
      saveStatus: get().hydrated && removed ? "dirty" : get().saveStatus,
      ...history,
    });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    if (wouldCreateCycle(connection.source, connection.target, get().edges)) {
      return;
    }
    const history = recordHistory();
    set({
      edges: addEdge(
        { ...connection, type: "mindmap", id: `e-${nanoid(8)}` },
        get().edges,
      ),
      saveStatus: "dirty",
      ...history,
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
        color: DEFAULT_NODE_COLOR,
        editing: true,
      },
    };
    const history = recordHistory();
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
    set({ lastSelectedId: id, ...history });
    awaitingMeasure.add(id);
    labelBaseline = { id, label: DEFAULT_NODE_LABEL };
    return id;
  },

  addSiblingNode: (nodeId) => {
    const parentId = getParentId(nodeId, graphNow().edges);
    if (!parentId) return get().addChildNode(nodeId);
    return get().addChildNode(parentId, undefined, nodeId);
  },

  copySelection: () => {
    const { nodes, edges } = graphNow();
    const selectedIds = nodes
      .filter((node) => node.selected)
      .map((node) => node.id);
    const clipboard = collectNodeClipboard(selectedIds, nodes, edges);
    if (!clipboard) return;
    set({ clipboard });
  },

  cutSelection: () => {
    const { nodes, edges } = graphNow();
    const selected = nodes.filter((node) => node.selected && !node.data.isRoot);
    const clipboard = collectNodeClipboard(
      selected.map((node) => node.id),
      nodes,
      edges,
    );
    if (!clipboard || selected.length === 0) return;
    const history = recordHistory();
    const nextSelectedId = commitRemoval(selected, nodes, edges);
    set({ lastSelectedId: nextSelectedId, clipboard, ...history });
  },

  pasteOntoSelection: (parentId) => {
    const clipboard = get().clipboard;
    if (!clipboard) return;
    const { nodes, edges } = graphNow();
    const parent = parentId
      ? nodes.find((node) => node.id === parentId)
      : (nodes.find((node) => node.id === get().lastSelectedId && node.selected) ??
        nodes.find((node) => node.selected));
    if (!parent) return;
    if (nodes.length + clipboard.nodes.length > MAX_NODES) return;

    const history = recordHistory();
    const cloned = cloneClipboardOnto(clipboard, parent.id, () => nanoid(10));
    const origin =
      clipboard.nodes.find((node) => node.id === clipboard.rootIds[0])
        ?.position ?? parent.position;
    const pasted = cloned.nodes.map((node) => {
      awaitingMeasure.add(node.id);
      return {
        id: node.id,
        type: "mindmap" as const,
        position: {
          x: parent.position.x + (node.position.x - origin.x),
          y: parent.position.y + (node.position.y - origin.y),
        },
        selected: cloned.rootIds.includes(node.id),
        data: {
          label: node.data.label,
          color: node.data.color,
          progress: node.data.progress,
          markdown: node.data.markdown,
        },
      };
    });

    commitGraph(
      [
        ...nodes.map((node) => ({
          ...node,
          selected: false,
          data: { ...node.data, editing: false },
        })),
        ...pasted,
      ],
      [
        ...edges,
        ...cloned.edges.map((edge) => ({
          ...edge,
          type: "mindmap" as const,
        })),
      ],
    );
    set({ lastSelectedId: cloned.rootIds.at(-1) ?? parent.id, ...history });
  },

  updateNodeLabel: (id, label) => {
    const current = get().nodes.find((node) => node.id === id);
    if (!current || current.data.label === label) return;
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label } }
          : node,
      ),
      saveStatus: "dirty",
    });
  },

  updateNodeMarkdown: (id, markdown) => {
    const next = markdown.slice(0, MAX_NODE_MARKDOWN);
    const current = get().nodes.find((node) => node.id === id);
    if (!current || (current.data.markdown ?? "") === next) return;
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                markdown: next.length > 0 ? next : undefined,
              },
            }
          : node,
      ),
      saveStatus: "dirty",
    });
  },

  updateNodeColor: (id, color) => {
    const { nodes } = get();
    const selectedIds = nodes
      .filter((node) => node.selected)
      .map((node) => node.id);
    const ids =
      selectedIds.length > 0 && selectedIds.includes(id)
        ? selectedIds
        : nodes.some((node) => node.id === id)
          ? [id]
          : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    if (
      nodes
        .filter((node) => idSet.has(node.id))
        .every((node) => node.data.color === color)
    ) {
      return;
    }
    const history = recordHistory();
    set({
      nodes: nodes.map((node) =>
        idSet.has(node.id)
          ? { ...node, data: { ...node.data, color } }
          : node,
      ),
      saveStatus: "dirty",
      ...history,
    });
  },

  updateNodeProgress: (id, progress) => {
    const current = get().nodes.find((node) => node.id === id);
    if (!current || current.data.progress === progress) return;
    const history = recordHistory();
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, progress } }
          : node,
      ),
      saveStatus: "dirty",
      ...history,
    });
  },

  startEditing: (id, options) => {
    const current = get().nodes.find((node) => node.id === id);
    if (!current) return;
    if (!current.data.editing) {
      labelBaseline = { id, label: current.data.label };
    }
    const selectAll = options?.selectAll ?? options?.text === undefined;
    const nextLabel =
      options?.text !== undefined
        ? options.text.slice(0, 200)
        : current.data.label;
    set({
      lastSelectedId: id,
      nodes: get().nodes.map((node) => ({
        ...node,
        selected: node.id === id,
        data: {
          ...node.data,
          editing: node.id === id,
          editSelectAll: node.id === id ? selectAll : undefined,
          label: node.id === id ? nextLabel : node.data.label,
        },
      })),
    });
  },

  finishEditing: (id) => {
    const node = get().nodes.find((item) => item.id === id);
    if (!node) return;
    const nextLabel = (node.data.label ?? "").trim() || DEFAULT_NODE_LABEL;
    const prevLabel =
      labelBaseline?.id === id ? labelBaseline.label : node.data.label;
    const labelChanged = prevLabel !== nextLabel;
    let history: { canUndo: boolean; canRedo: boolean } | Record<string, never> =
      {};
    if (labelChanged && get().hydrated) {
      const snapshot = capture();
      snapshot.nodes = snapshot.nodes.map((item) =>
        item.id === id
          ? { ...item, data: { ...item.data, label: prevLabel } }
          : item,
      );
      past.push(snapshot);
      if (past.length > HISTORY_LIMIT) past.shift();
      future = [];
      history = { canUndo: true, canRedo: false };
    }
    labelBaseline = null;
    set({
      nodes: get().nodes.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          data: {
            ...item.data,
            label: nextLabel,
            editing: false,
            editSelectAll: undefined,
          },
        };
      }),
      saveStatus:
        labelChanged && get().hydrated ? "dirty" : get().saveStatus,
      ...history,
    });
  },

  deleteSelection: (nodeId) => {
    const { nodes, edges } = graphNow();
    const selected = nodeId
      ? nodes.filter((node) => node.id === nodeId && !node.data.isRoot)
      : nodes.filter((node) => node.selected && !node.data.isRoot);
    if (selected.length === 0) return;
    const history = recordHistory();
    const nextSelectedId = commitRemoval(selected, nodes, edges);
    set({ lastSelectedId: nextSelectedId, ...history });
  },

  undo: () => {
    if (past.length === 0) return;
    future.push(capture());
    const entry = past.pop()!;
    applyHistory(entry);
  },

  redo: () => {
    if (future.length === 0) return;
    past.push(capture());
    const entry = future.pop()!;
    applyHistory(entry);
  },

  autoLayout: async (mode, options) => {
    const fitView = options?.fitView ?? true;
    const history = recordHistory();
    if (mode) set({ layoutMode: mode, ...history });
    else set(history);
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
