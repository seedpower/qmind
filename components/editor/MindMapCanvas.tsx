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
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type OnConnectEnd,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { FLOW_NODE_ORIGIN, getNodePalette } from "@/lib/types";
import { getFocusedNode, useMindMapStore, type FlowNode } from "@/store/useMindMapStore";
import MindMapEdge from "./MindMapEdge";
import MindMapNode from "./MindMapNode";
import NodeContextMenu from "./NodeContextMenu";

const nodeTypes = { mindmap: MindMapNode };
const edgeTypes = { mindmap: MindMapEdge };
/** Keep click and drag thresholds aligned so a slightly shaky click still selects. */
const NODE_POINTER_SLOP = 8;
const FIT_VIEW_PADDING = 0.28;

function FlowCanvas() {
  const connectingNodeId = useRef<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const didInitialFit = useRef(false);
  const [spacePan, setSpacePan] = useState(false);
  const [menu, setMenu] = useState<{ nodeId: string; x: number; y: number } | null>(
    null,
  );
  const { screenToFlowPosition, fitView, getViewport, setCenter } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addChildNode,
    layoutTick,
    selectionNavTick,
    mapId,
  } = useMindMapStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      addChildNode: s.addChildNode,
      layoutTick: s.layoutTick,
      selectionNavTick: s.selectionNavTick,
      mapId: s.mapId,
    })),
  );

  const fitCanvas = useCallback(
    (duration = 0) => {
      if (useMindMapStore.getState().nodes.length === 0) return;
      void fitView({ padding: FIT_VIEW_PADDING, duration });
    },
    [fitView],
  );

  useEffect(() => {
    didInitialFit.current = false;
  }, [mapId]);

  useEffect(() => {
    if (didInitialFit.current || !nodesInitialized) return;
    if (useMindMapStore.getState().nodes.length === 0) return;
    didInitialFit.current = true;
    const frame = requestAnimationFrame(() => fitCanvas());
    return () => cancelAnimationFrame(frame);
  }, [nodesInitialized, mapId, fitCanvas]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (!next) return;
      const nextWidth = Math.round(next.width);
      const nextHeight = Math.round(next.height);
      if (nextWidth < 8 || nextHeight < 8) return;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      if (!didInitialFit.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => fitCanvas());
      });
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fitCanvas]);

  useEffect(() => {
    if (layoutTick === 0) return;
    const frame = requestAnimationFrame(() => {
      fitCanvas(280);
    });
    return () => cancelAnimationFrame(frame);
  }, [layoutTick, fitCanvas]);

  useEffect(() => {
    if (selectionNavTick === 0) return;
    setMenu(null);
    const focused = getFocusedNode(useMindMapStore.getState());
    if (!focused) return;
    const host = document.querySelector(".canvas-host");
    if (!(host instanceof HTMLElement)) return;
    const { x, y, zoom } = getViewport();
    const { width, height } = host.getBoundingClientRect();
    const screenX = focused.position.x * zoom + x;
    const screenY = focused.position.y * zoom + y;
    const margin = 96;
    if (
      screenX >= margin &&
      screenY >= margin &&
      screenX <= width - margin &&
      screenY <= height - margin
    ) {
      return;
    }
    void setCenter(focused.position.x, focused.position.y, { zoom, duration: 200 });
  }, [selectionNavTick, getViewport, setCenter]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (
        target.classList.contains("mindmap-input") &&
        !useMindMapStore.getState().nodes.some((node) => node.data.editing)
      ) {
        return false;
      }
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
      if (!connectionState.from || !connectionState.to) return;

      const dragged = Math.hypot(
        connectionState.to.x - connectionState.from.x,
        connectionState.to.y - connectionState.from.y,
      );
      if (dragged < 24) return;

      const point =
        "changedTouches" in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({
        x: point.clientX,
        y: point.clientY,
      });
      addChildNode(parentId, position);
    },
    [addChildNode, screenToFlowPosition],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  const handleSelectionEnd = useCallback(
    (event: ReactMouseEvent) => {
      useMindMapStore.getState().focusNearestSelected(
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      );
    },
    [screenToFlowPosition],
  );

  const handleNodeContextMenu = useCallback(
    (event: ReactMouseEvent, node: FlowNode) => {
      event.preventDefault();
      useMindMapStore.setState((state) => {
        const current = state.nodes.find((item) => item.id === node.id);
        if (current?.selected) {
          return { lastSelectedId: node.id };
        }
        return {
          lastSelectedId: node.id,
          nodes: state.nodes.map((item) => ({
            ...item,
            selected: item.id === node.id,
          })),
        };
      });
      setMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    },
    [],
  );

  return (
    <div ref={hostRef} className="canvas-host">
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
        fitViewOptions={{ padding: FIT_VIEW_PADDING }}
        onMoveEnd={(_, nextViewport) => {
          useMindMapStore.getState().setViewport(nextViewport);
        }}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onPaneClick={closeMenu}
        onMoveStart={closeMenu}
        onSelectionEnd={handleSelectionEnd}
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
        panOnDrag={[2]}
        panActivationKeyCode="Space"
        panOnScroll
        nodesFocusable={false}
        edgesFocusable={false}
        disableKeyboardA11y
        proOptions={{ hideAttribution: true }}
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
          position="bottom-left"
          pannable
          zoomable
          nodeColor={(node) => getNodePalette((node as FlowNode).data?.color).border}
          maskColor="rgba(12, 14, 18, 0.7)"
          className="mindmap-minimap"
          style={{ width: 140, height: 105 }}
        />
      </ReactFlow>
      {menu ? (
        <NodeContextMenu
          nodeId={menu.nodeId}
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  );
}

export default function MindMapCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
