"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type OnConnectEnd,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { FLOW_NODE_ORIGIN, NODE_COLORS } from "@/lib/types";
import { useMindMapStore, type FlowNode } from "@/store/useMindMapStore";
import MindMapEdge from "./MindMapEdge";
import MindMapNode from "./MindMapNode";

const nodeTypes = { mindmap: MindMapNode };
const edgeTypes = { mindmap: MindMapEdge };
/** Keep click and drag thresholds aligned so a slightly shaky click still selects. */
const NODE_POINTER_SLOP = 8;

function FlowCanvas() {
  const connectingNodeId = useRef<string | null>(null);
  const [spacePan, setSpacePan] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addChildNode,
    layoutTick,
  } = useMindMapStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      addChildNode: s.addChildNode,
      layoutTick: s.layoutTick,
    })),
  );

  useEffect(() => {
    if (layoutTick === 0) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.28, duration: 280 });
    });
    return () => cancelAnimationFrame(frame);
  }, [layoutTick, fitView]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      event.preventDefault();
      setSpacePan(true);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      setSpacePan(false);
    }

    function onBlur() {
      setSpacePan(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const handleConnectStart = useCallback((_: unknown, { nodeId }: { nodeId: string | null }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      connectingNodeId.current = null;
      onConnect(connection);
    },
    [onConnect],
  );

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      const parentId = connectingNodeId.current;
      connectingNodeId.current = null;
      if (connectionState.isValid || !parentId) return;

      const dragged = Math.hypot(
        connectionState.to.x - connectionState.from.x,
        connectionState.to.y - connectionState.from.y,
      );
      if (dragged < 24) return;

      const point =
        "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
      const position = screenToFlowPosition({
        x: point.clientX,
        y: point.clientY,
      });
      addChildNode(parentId, position);
    },
    [addChildNode, screenToFlowPosition],
  );

  return (
    <ReactFlow
      className={spacePan ? "is-space-pan" : undefined}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onConnectStart={handleConnectStart}
      onConnectEnd={handleConnectEnd}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodeOrigin={FLOW_NODE_ORIGIN}
      colorMode="dark"
      connectionLineType={ConnectionLineType.Bezier}
      connectionLineStyle={{ stroke: "#e8a838", strokeWidth: 2 }}
      defaultEdgeOptions={{ type: "mindmap" }}
      fitView
      fitViewOptions={{ padding: 0.28 }}
      onMoveEnd={(_, nextViewport) => {
        useMindMapStore.getState().setViewport(nextViewport);
      }}
      minZoom={0.2}
      maxZoom={2}
      deleteKeyCode={null}
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      selectionKeyCode={null}
      multiSelectionKeyCode="Shift"
      selectNodesOnDrag
      nodeClickDistance={NODE_POINTER_SLOP}
      nodeDragThreshold={NODE_POINTER_SLOP}
      connectionDragThreshold={NODE_POINTER_SLOP}
      panOnDrag={false}
      panActivationKeyCode="Space"
      panOnScroll
      nodesFocusable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: false }}
    >
      <Background
        id="dots"
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1.4}
        color="rgba(246, 241, 232, 0.08)"
      />
      <Controls
        showInteractive={false}
        position="bottom-left"
        className="mindmap-controls"
      />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor={(node) => {
          const color = (node as FlowNode).data?.color ?? "stone";
          return NODE_COLORS[color].border;
        }}
        maskColor="rgba(12, 14, 18, 0.7)"
        className="mindmap-minimap"
      />
    </ReactFlow>
  );
}

export default function MindMapCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
