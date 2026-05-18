import { Points, PointMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

function createStarPositions(count, radius, yBias = 0) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const r = radius * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + yBias;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  return positions;
}

export default function StarField() {
  const nearRef = useRef();
  const farRef = useRef();
  const nearStars = useMemo(() => createStarPositions(1200, 28), []);
  const farStars = useMemo(() => createStarPositions(1900, 70), []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (nearRef.current) {
      nearRef.current.rotation.y = elapsed * 0.006;
      nearRef.current.rotation.x = Math.sin(elapsed * 0.08) * 0.025;
    }
    if (farRef.current) {
      farRef.current.rotation.y = -elapsed * 0.0025;
      farRef.current.position.z = Math.sin(elapsed * 0.07) * 1.2;
    }
  });

  return (
    <>
      <Points ref={farRef} positions={farStars} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#627b9b" size={0.026} opacity={0.34} depthWrite={false} />
      </Points>
      <Points ref={nearRef} positions={nearStars} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#d9f7ff" size={0.044} opacity={0.58} depthWrite={false} />
      </Points>
    </>
  );
}
