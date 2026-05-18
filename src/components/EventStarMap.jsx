import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import CameraRig from './CameraRig.jsx';
import Connections from './Connections.jsx';
import EventNode from './EventNode.jsx';
import Nebula from './Nebula.jsx';
import StarField from './StarField.jsx';
import { createLayout, getCoreFocus, getRelatedNodes } from '../utils/layout.js';

function SceneContent({ graph, nodeSizeMultiplier, hoveredId, selectedId, focusCoreToken, setHoveredId, setSelectedId }) {
  const layout = useMemo(() => createLayout(graph.nodes), [graph.nodes]);
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const graphLinks = graph.links;
  const relatedIds = useMemo(
    () => new Set(getRelatedNodes(hoveredId || selectedId, graphLinks)),
    [graphLinks, hoveredId, selectedId],
  );
  const coreFocus = useMemo(() => getCoreFocus(graph.nodes, layout), [graph.nodes, layout]);
  const selectedPosition = selectedId ? layout[selectedId] : null;
  const focusTarget = focusCoreToken ? coreFocus : null;

  return (
    <>
      <color attach="background" args={['#010713']} />
      <fog attach="fog" args={['#010713', 16, 58]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 3, 6]} intensity={18} color="#74c7ff" distance={30} />
      <pointLight position={[10, -7, 4]} intensity={11} color="#6bffba" distance={24} />
      <pointLight position={[-10, 6, 5]} intensity={12} color="#b17bff" distance={28} />
      <Nebula />
      <StarField />
      <group rotation={[0.02, -0.1, 0]}>
        <Connections links={graphLinks} nodeMap={nodeMap} layout={layout} hoveredId={hoveredId} selectedId={selectedId} />
        {graph.nodes.map((node) => {
          const active = hoveredId === node.id || selectedId === node.id || relatedIds.has(node.id);
          const dimmed = Boolean(hoveredId || selectedId) && !active;

          return (
            <EventNode
              key={node.id}
              node={node}
              position={layout[node.id]}
              selected={selectedId === node.id}
              hovered={hoveredId === node.id}
              dimmed={dimmed}
              sizeMultiplier={nodeSizeMultiplier}
              onHover={setHoveredId}
              onSelect={setSelectedId}
            />
          );
        })}
      </group>
      <CameraRig
        focusTarget={focusTarget}
        selectedPosition={selectedPosition}
        orbitEnabled
      />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.24} intensity={1.35} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

export default function EventStarMap({
  graph,
  nodeSizeMultiplier,
  hoveredId,
  selectedId,
  focusCoreToken,
  onHoverNode,
  onSelectNode,
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 19], fov: 55, near: 0.1, far: 160 }}
      dpr={[1, 1.8]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
    >
      <Suspense fallback={null}>
        <SceneContent
          graph={graph}
          nodeSizeMultiplier={nodeSizeMultiplier}
          hoveredId={hoveredId}
          selectedId={selectedId}
          focusCoreToken={focusCoreToken}
          setHoveredId={onHoverNode}
          setSelectedId={onSelectNode}
        />
      </Suspense>
    </Canvas>
  );
}
