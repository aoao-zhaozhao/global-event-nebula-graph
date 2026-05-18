import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export default function Nebula() {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.getElapsedTime();
    ref.current.rotation.z = elapsed * 0.01;
    ref.current.rotation.y = Math.sin(elapsed * 0.05) * 0.12;
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0, -8.5]} rotation={[0.4, 0.2, -0.25]}>
        <planeGeometry args={[30, 18, 1, 1]} />
        <meshBasicMaterial
          color="#0b314f"
          transparent
          opacity={0.085}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[3.2, -1.5, -7.8]} rotation={[0.2, -0.4, 0.5]}>
        <planeGeometry args={[20, 13, 1, 1]} />
        <meshBasicMaterial
          color="#1a4b4d"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[-4.8, 3.2, -9]} rotation={[0.4, 0.4, -0.6]}>
        <planeGeometry args={[20, 12, 1, 1]} />
        <meshBasicMaterial
          color="#42225f"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
