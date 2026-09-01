import "server-only";

import { ObjectId, type Collection, type WithId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  MAX_NODES,
  MAX_NODE_MARKDOWN,
  DEFAULT_MAP_TITLE,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_LABEL,
  DEFAULT_ROOT_LABEL,
  NODE_COLORS,
  type MindMapDocument,
  type MindMapSummary,
  isNodeProgress,
  type NodeColor,
  type PersistedEdge,
  type PersistedNode,
  type Viewport,
} from "@/lib/types";

type MapRecord = {
  title: string;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
  viewport: Viewport;
  nodeCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

function isNodeColor(value: unknown): value is NodeColor {
  return typeof value === "string" && value in NODE_COLORS;
}

function sanitizeNodes(input: unknown): PersistedNode[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_NODES).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const node = raw as Record<string, unknown>;
    const position = node.position as Record<string, unknown> | undefined;
    const data = node.data as Record<string, unknown> | undefined;
    if (typeof node.id !== "string") return [];
    if (typeof position?.x !== "number" || typeof position?.y !== "number") {
      return [];
    }
    const label =
      typeof data?.label === "string" ? data.label.slice(0, 200) : DEFAULT_NODE_LABEL;
    const markdown =
      typeof data?.markdown === "string"
        ? data.markdown.slice(0, MAX_NODE_MARKDOWN)
        : undefined;
    return [
      {
        id: node.id,
        type: typeof node.type === "string" ? node.type : "mindmap",
        position: { x: position.x, y: position.y },
        data: {
          label,
          color: isNodeColor(data?.color) ? data.color : DEFAULT_NODE_COLOR,
          progress: isNodeProgress(data?.progress) ? data.progress : undefined,
          isRoot: Boolean(data?.isRoot),
          ...(markdown ? { markdown } : {}),
        },
      },
    ];
  });
}

function sanitizeEdges(input: unknown, nodeIds: Set<string>): PersistedEdge[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const edge = raw as Record<string, unknown>;
    if (
      typeof edge.id !== "string" ||
      typeof edge.source !== "string" ||
      typeof edge.target !== "string"
    ) {
      return [];
    }
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return [];
    return [
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: typeof edge.type === "string" ? edge.type : "mindmap",
      },
    ];
  });
}

function sanitizeViewport(input: unknown): Viewport {
  if (!input || typeof input !== "object") return DEFAULT_VIEWPORT;
  const vp = input as Record<string, unknown>;
  if (
    typeof vp.x !== "number" ||
    typeof vp.y !== "number" ||
    typeof vp.zoom !== "number"
  ) {
    return DEFAULT_VIEWPORT;
  }
  return { x: vp.x, y: vp.y, zoom: Math.min(2.5, Math.max(0.15, vp.zoom)) };
}

function serialize(doc: WithId<MapRecord>): MindMapDocument {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    nodes: doc.nodes,
    edges: doc.edges,
    viewport: doc.viewport ?? DEFAULT_VIEWPORT,
    nodeCount: doc.nodeCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function summarize(doc: WithId<MapRecord>): MindMapSummary {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    nodeCount: doc.nodeCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

let indexesReady = false;

async function mapsCollection(): Promise<Collection<MapRecord>> {
  const db = await getDb();
  const col = db.collection<MapRecord>("maps");
  if (!indexesReady) {
    await col.createIndex({ updatedAt: -1 });
    indexesReady = true;
  }
  return col;
}

export function createRootNode(label = DEFAULT_ROOT_LABEL): PersistedNode {
  return {
    id: "root",
    type: "mindmap",
    position: { x: 0, y: 0 },
    data: { label, color: DEFAULT_NODE_COLOR, isRoot: true },
  };
}

export async function listMaps(): Promise<MindMapSummary[]> {
  const col = await mapsCollection();
  const docs = await col
    .find(
      {},
      {
        projection: {
          title: 1,
          nodeCount: 1,
          createdAt: 1,
          updatedAt: 1,
        },
        sort: { updatedAt: -1 },
        limit: 100,
      },
    )
    .toArray();
  return docs.map(summarize);
}

export async function getMap(id: string): Promise<MindMapDocument | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await mapsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? serialize(doc) : null;
}

export async function createMap(title?: string): Promise<MindMapDocument> {
  const col = await mapsCollection();
  const now = new Date();
  const nodes = [createRootNode()];
  const record: MapRecord = {
    title: (title?.trim() || DEFAULT_MAP_TITLE).slice(0, 80),
    nodes,
    edges: [],
    viewport: DEFAULT_VIEWPORT,
    nodeCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(record);
  return serialize({ ...record, _id: result.insertedId });
}

export async function updateMap(
  id: string,
  patch: {
    title?: string;
    nodes?: unknown;
    edges?: unknown;
    viewport?: unknown;
  },
): Promise<MindMapDocument | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await mapsCollection();

  const update: Partial<MapRecord> = { updatedAt: new Date() };

  if (typeof patch.title === "string") {
    update.title = patch.title.trim().slice(0, 80) || DEFAULT_MAP_TITLE;
  }
  if (patch.nodes !== undefined) {
    const nodes = sanitizeNodes(patch.nodes);
    if (nodes.length === 0) {
      throw new Error("MAP_EMPTY");
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = sanitizeEdges(patch.edges, nodeIds);
    update.nodes = nodes;
    update.edges = edges;
    update.nodeCount = nodes.length;
  } else if (patch.edges !== undefined) {
    const existing = await col.findOne({ _id: new ObjectId(id) });
    if (!existing) return null;
    const nodeIds = new Set(existing.nodes.map((n) => n.id));
    update.edges = sanitizeEdges(patch.edges, nodeIds);
  }
  if (patch.viewport !== undefined) {
    update.viewport = sanitizeViewport(patch.viewport);
  }

  const doc = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" },
  );
  return doc ? serialize(doc) : null;
}

export async function deleteMap(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await mapsCollection();
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}
