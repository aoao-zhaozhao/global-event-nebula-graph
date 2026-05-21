import { Points, PointMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

function createCloudPoints(count, radius, spread, offset) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * Math.cbrt(Math.random());
    const wobble = spread * (0.35 + Math.random() * 0.65);

    positions[i * 3] = offset[0] + Math.sin(phi) * Math.cos(theta) * (r + wobble * Math.random());
    positions[i * 3 + 1] = offset[1] + Math.cos(phi) * (r * 0.68 + wobble * 0.45);
    positions[i * 3 + 2] = offset[2] + Math.sin(phi) * Math.sin(theta) * (r + wobble * Math.random());
  }

  return positions;
}

export default function Nebula() {
  const ref = useRef();
  const clouds = useMemo(
    () => [
      {
        positions: createCloudPoints(420, 5.8, 2.4, [0, 0.2, -8.8]),
        color: '#1c4f72',
        size: 0.11,
        opacity: 0.12,
        rotation: [0.2, -0.2, 0.15],
      },
      {
        positions: createCloudPoints(360, 4.8, 2.1, [3.2, -1.4, -8.1]),
        color: '#245f5e',
        size: 0.1,
        opacity: 0.1,
        rotation: [-0.18, 0.1, -0.25],
      },
      {
        positions: createCloudPoints(320, 4.4, 1.9, [-4.9, 3.0, -9.2]),
        color: '#5b326f',
        size: 0.095,
        opacity: 0.1,
        rotation: [0.14, 0.16, 0.2],
      },
    ],
    [],
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.getElapsedTime();
    ref.current.rotation.z = elapsed * 0.01;
    ref.current.rotation.y = Math.sin(elapsed * 0.05) * 0.12;
  });

  return (
    <group ref={ref}>
      {clouds.map((cloud, index) => (
        <Points key={index} positions={cloud.positions} stride={3} frustumCulled={false} rotation={cloud.rotation}>
          <PointMaterial transparent color={cloud.color} size={cloud.size} opacity={cloud.opacity} depthWrite={false} />
        </Points>
      ))}
    </group>
  );
}
