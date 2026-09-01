import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  MCP_LAYOUT_MODES,
  MCP_NODE_COLORS,
  MapOpsError,
  addMindMapNode,
  createMindMap,
  deleteMindMapNode,
  getMindMap,
  getMindMapNode,
  layoutMindMap,
  listMindMaps,
  moveMindMapNode,
  removeMindMap,
  renameMindMap,
  searchMindMapNodes,
  updateMindMapNode,
} from "@/lib/map-ops";
import {
  COLOR_ORDER,
  MAX_NODE_MARKDOWN,
  type NodeColor,
} from "@/lib/types";
import { verifyMcpBearer } from "@/lib/mcp/auth";

const nodeColorSchema = z.enum(COLOR_ORDER as [NodeColor, ...NodeColor[]]);
const progressSchema = z.union([
  z.literal(0),
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(100),
]);
const layoutModeSchema = z.enum(MCP_LAYOUT_MODES);

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

async function run<T>(fn: () => Promise<T>) {
  try {
    return jsonResult(await fn());
  } catch (error) {
    const message =
      error instanceof MapOpsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unexpected error";
    return errorResult(message);
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_maps",
      {
        title: "List maps",
        description: "List mind maps with id, title, node count, and timestamps.",
      },
      async () => run(() => listMindMaps()),
    );

    server.registerTool(
      "create_map",
      {
        title: "Create map",
        description: "Create a new mind map with a single root node.",
        inputSchema: z.object({
          title: z.string().min(1).max(80).optional().describe("Map title"),
          root_label: z
            .string()
            .min(1)
            .max(200)
            .optional()
            .describe("Label for the central topic"),
        }),
      },
      async ({ title, root_label }) =>
        run(() => createMindMap(title, root_label)),
    );

    server.registerTool(
      "get_map",
      {
        title: "Get map",
        description:
          "Load a mind map as a nested tree (id, label, color, progress, notes flag, children). Use this before editing.",
        inputSchema: z.object({
          map_id: z.string().min(1).describe("Mind map id"),
          include_notes: z
            .boolean()
            .optional()
            .describe("Include each node's markdown notes in the tree"),
        }),
      },
      async ({ map_id, include_notes }) =>
        run(() => getMindMap(map_id, include_notes)),
    );

    server.registerTool(
      "rename_map",
      {
        title: "Rename map",
        description: "Change a mind map's title.",
        inputSchema: z.object({
          map_id: z.string().min(1),
          title: z.string().min(1).max(80),
        }),
      },
      async ({ map_id, title }) => run(() => renameMindMap(map_id, title)),
    );

    server.registerTool(
      "delete_map",
      {
        title: "Delete map",
        description: "Permanently delete a mind map and all of its nodes.",
        inputSchema: z.object({
          map_id: z.string().min(1),
        }),
      },
      async ({ map_id }) => run(() => removeMindMap(map_id)),
    );

    server.registerTool(
      "get_node",
      {
        title: "Get node",
        description: "Load one node, including its full markdown notes.",
        inputSchema: z.object({
          map_id: z.string().min(1),
          node_id: z.string().min(1),
        }),
      },
      async ({ map_id, node_id }) => run(() => getMindMapNode(map_id, node_id)),
    );

    server.registerTool(
      "add_node",
      {
        title: "Add node",
        description:
          "Add a child node. Defaults to the map root if parent_id is omitted. Call layout_map after adding several nodes.",
        inputSchema: z.object({
          map_id: z.string().min(1),
          parent_id: z
            .string()
            .min(1)
            .optional()
            .describe("Parent node id; defaults to the root"),
          after_id: z
            .string()
            .min(1)
            .optional()
            .describe("Place the new node after this sibling"),
          label: z.string().min(1).max(200).optional(),
          color: nodeColorSchema
            .optional()
            .describe(`One of: ${MCP_NODE_COLORS.join(", ")}`),
          progress: progressSchema
            .optional()
            .describe("0, 25, 50, 75, or 100"),
          markdown: z.string().max(MAX_NODE_MARKDOWN).optional(),
        }),
      },
      async ({ map_id, parent_id, after_id, label, color, progress, markdown }) =>
        run(() =>
          addMindMapNode({
            mapId: map_id,
            parentId: parent_id,
            afterId: after_id,
            label,
            color: color as NodeColor | undefined,
            progress,
            markdown,
          }),
        ),
    );

    server.registerTool(
      "update_node",
      {
        title: "Update node",
        description:
          "Update a node's label, color, progress, or markdown notes. Pass progress null or markdown \"\" to clear.",
        inputSchema: z.object({
          map_id: z.string().min(1),
          node_id: z.string().min(1),
          label: z.string().max(200).optional(),
          color: nodeColorSchema.optional(),
          progress: progressSchema.nullable().optional(),
          markdown: z.string().max(MAX_NODE_MARKDOWN).optional(),
        }),
      },
      async ({ map_id, node_id, label, color, progress, markdown }) =>
        run(() =>
          updateMindMapNode({
            mapId: map_id,
            nodeId: node_id,
            label,
            color: color as NodeColor | undefined,
            progress,
            markdown,
          }),
        ),
    );

    server.registerTool(
      "delete_node",
      {
        title: "Delete node",
        description: "Delete a node and its descendants. The root cannot be deleted.",
        inputSchema: z.object({
          map_id: z.string().min(1),
          node_id: z.string().min(1),
        }),
      },
      async ({ map_id, node_id }) => run(() => deleteMindMapNode(map_id, node_id)),
    );

    server.registerTool(
      "move_node",
      {
        title: "Move node",
        description: "Reparent a node. The root cannot be moved, and cycles are rejected.",
        inputSchema: z.object({
          map_id: z.string().min(1),
          node_id: z.string().min(1),
          parent_id: z.string().min(1),
          after_id: z.string().min(1).optional(),
        }),
      },
      async ({ map_id, node_id, parent_id, after_id }) =>
        run(() =>
          moveMindMapNode({
            mapId: map_id,
            nodeId: node_id,
            parentId: parent_id,
            afterId: after_id,
          }),
        ),
    );

    server.registerTool(
      "layout_map",
      {
        title: "Layout map",
        description: "Rearrange node positions with ELK (right, down, or radial).",
        inputSchema: z.object({
          map_id: z.string().min(1),
          mode: layoutModeSchema
            .optional()
            .describe("RIGHT (default), DOWN, or RADIAL"),
        }),
      },
      async ({ map_id, mode }) => run(() => layoutMindMap(map_id, mode)),
    );

    server.registerTool(
      "search_nodes",
      {
        title: "Search nodes",
        description:
          "Search node labels and notes. Omit map_id to search across maps. Returns up to 50 hits.",
        inputSchema: z.object({
          query: z.string().min(1).max(200),
          map_id: z.string().min(1).optional(),
        }),
      },
      async ({ query, map_id }) => run(() => searchMindMapNodes(query, map_id)),
    );

    server.registerPrompt(
      "qmind-guide",
      {
        title: "QMind guide",
        description: "How an agent should read and edit QMind mind maps.",
      },
      () => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                "You are connected to QMind, a mind-map workspace.",
                "1. Call list_maps, then get_map with a map_id to see the tree.",
                "2. Use add_node, update_node, delete_node, and move_node to edit.",
                "3. Use get_node when you need a node's full markdown notes.",
                "4. After several structural edits, call layout_map.",
                `5. Node colors: ${MCP_NODE_COLORS.join(", ")}. Progress: 0, 25, 50, 75, 100.`,
              ].join("\n"),
            },
          },
        ],
      }),
    );
  },
  {
    serverInfo: {
      name: "qmind",
      version: "0.1.0",
    },
    instructions:
      "QMind mind-map tools. Use list_maps and get_map to inspect trees, then add_node, update_node, delete_node, or move_node to edit. Call layout_map after structural changes. Each node can have a label, color, progress (0/25/50/75/100), and markdown notes.",
  },
);

export const mcpHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => verifyMcpBearer(bearerToken),
  { required: true, requiredScopes: ["qmind"] },
);
