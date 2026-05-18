import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import NodeLabel from './NodeLabel.jsx';
import { typeColors } from '../data/events.js';

function EventNode({ node, position, selected, hovered, dimmed, sizeMultiplier = 1, onHover, onSelect }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const color = typeColors[node.type];
  const baseSize = (0.075 + node.importance * 0.032) * sizeMultiplier;
  const active = selected || hovered;

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: dimmed ? 0.38 : 0.96,
      }),
    [color, dimmed],
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color],
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const pulse = 1 + Math.sin(elapsed * 1.7 + node.importance) * 0.08;
    const activeBoost = active ? 1.75 : node.importance >= 8.5 ? 1.18 : 1;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(pulse * activeBoost);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar((active ? 3.7 : node.importance >= 8.5 ? 3.05 : 2.18) + Math.sin(elapsed * 2.1) * 0.18);
      glowRef.current.material.opacity = active ? 0.42 : dimmed ? 0.045 : node.importance >= 8.5 ? 0.24 : 0.14;
    }
  });

  return (
    <group position={position}>
      <Billboard ref={groupRef}>
        <mesh
          onPointerOver={(event) => {
            event.stopPropagation();
            onHover(node.id);
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            onHover(null);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node.id);
          }}
        >
          <sphereGeometry args={[baseSize, 32, 32]} />
          <primitive object={material} attach="material" />
        </mesh>
        <mesh ref={glowRef}>
          <sphereGeometry args={[baseSize, 32, 32]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>
      </Billboard>
      <NodeLabel node={node} position={[0, 0, 0]} active={active || node.importance >= 8.5} />
    </group>
  );
}

export default memo(EventNode);
