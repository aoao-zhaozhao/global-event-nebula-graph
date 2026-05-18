import { Line } from '@react-three/drei';
import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { nodeLineColors, typeColors } from '../data/events.js';

function getLineColor(link, activeId, sourceNode, targetNode, fallbackColor) {
  if (activeId === link.source) return nodeLineColors[link.source] || fallbackColor;
  if (activeId === link.target) return nodeLineColors[link.target] || fallbackColor;
  return nodeLineColors[link.source] || nodeLineColors[link.target] || fallbackColor;
}

function Connections({ links, nodeMap, layout, hoveredId, selectedId }) {
  const activeId = hoveredId || selectedId;
  const curves = useMemo(
    () =>
      links.map((link, index) => {
        const start = new THREE.Vector3(...layout[link.source]);
        const end = new THREE.Vector3(...layout[link.target]);
        const mid = start.clone().add(end).multiplyScalar(0.5);
        const distance = start.distanceTo(end);
        const normal = new THREE.Vector3(
          Math.sin(index * 1.73),
          Math.cos(index * 0.91),
          Math.sin(index * 0.47 + 1.2),
        ).normalize();
        const lift = 0.55 + distance * 0.14 + link.strength * 0.35;
        const controlA = mid.clone().add(normal.multiplyScalar(lift));
        const controlB = mid.clone().add(
          new THREE.Vector3(
            Math.cos(index * 0.63) * lift * 0.55,
            Math.sin(index * 0.42) * lift * 0.42,
            Math.cos(index * 1.11) * lift * 0.52,
          ),
        );
        const curve = new THREE.CatmullRomCurve3([start, controlA, controlB, end], false, 'catmullrom', 0.46);

        return {
          ...link,
          points: curve.getPoints(40),
          ghostPoints: curve.getPoints(18).map((point, pointIndex) =>
            point
              .clone()
              .add(
                new THREE.Vector3(
                  Math.sin(pointIndex + index) * 0.035,
                  Math.cos(pointIndex * 0.7 + index) * 0.035,
                  Math.sin(pointIndex * 0.4) * 0.025,
                ),
              ),
          ),
        };
      }),
    [layout, links],
  );

  return (
    <group>
      {curves.map((link) => {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        const active = activeId && (link.source === activeId || link.target === activeId);
        const secondary =
          selectedId &&
          !active &&
          (link.source === selectedId || link.target === selectedId || link.source === hoveredId || link.target === hoveredId);
        const baseColor = typeColors[targetNode?.type] || '#8aa7ff';
        const color = active
          ? getLineColor(link, activeId, sourceNode, targetNode, '#fffdf2')
          : secondary
            ? getLineColor(link, selectedId, sourceNode, targetNode, '#b7d7ff')
            : getLineColor(link, null, sourceNode, targetNode, baseColor);
        const opacity = active ? 0.9 : secondary ? 0.52 : activeId ? 0.045 : 0.15;

        return (
          <group key={`${link.source}-${link.target}-${link.relation}`}>
            <Line
              points={link.points}
              color={color}
              lineWidth={active ? 2.2 + link.strength * 1.2 : 0.34 + link.strength * 0.45}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
            <Line
              points={link.ghostPoints}
              color={nodeLineColors[link.source] || typeColors[sourceNode?.type] || color}
              lineWidth={active ? 0.75 : 0.22}
              transparent
              opacity={active ? 0.44 : activeId ? 0.025 : 0.08}
              depthWrite={false}
            />
          </group>
        );
      })}
    </group>
  );
}

export default memo(Connections);
