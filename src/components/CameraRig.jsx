import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export default function CameraRig({ focusTarget, selectedPosition, orbitEnabled = true }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(0, 0, 12.8), []);
  const lookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const desiredDistance = useRef(12.8);
  const distanceTransitionUntil = useRef(0);

  const startDistanceTransition = () => {
    distanceTransitionUntil.current = performance.now() + 900;
  };

  useEffect(() => {
    if (selectedPosition) {
      lookAt.set(selectedPosition[0], selectedPosition[1], selectedPosition[2]);
      const direction = new THREE.Vector3(selectedPosition[0], selectedPosition[1], selectedPosition[2]).normalize();
      if (direction.lengthSq() < 0.01) direction.set(0.35, 0.15, 1);
      destination.copy(lookAt).add(direction.multiplyScalar(3.7)).add(new THREE.Vector3(0, 0.72, 2.35));
      desiredDistance.current = destination.distanceTo(lookAt);
      startDistanceTransition();
      return;
    }

    if (focusTarget) {
      lookAt.set(focusTarget[0], focusTarget[1], focusTarget[2]);
      destination.set(focusTarget[0] + 0.55, focusTarget[1] + 1.05, focusTarget[2] + 8.2);
      desiredDistance.current = destination.distanceTo(lookAt);
      startDistanceTransition();
      return;
    }

    lookAt.set(0, 0, 0);
    destination.set(0, 0, 12.8);
  }, [destination, focusTarget, lookAt, selectedPosition]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const currentDistance = camera.position.distanceTo(target);
    const isFlyingDistance = performance.now() < distanceTransitionUntil.current;

    if (isFlyingDistance) {
      const distance = THREE.MathUtils.lerp(currentDistance, desiredDistance.current, 1 - Math.pow(0.02, delta));
      const desired = destination.clone();
      const direction = desired.clone().sub(lookAt).normalize();
      desired.copy(lookAt).add(direction.multiplyScalar(distance));
      camera.position.lerp(desired, 1 - Math.pow(0.015, delta));
    } else {
      desiredDistance.current = currentDistance;
    }
    target.lerp(lookAt, 1 - Math.pow(0.01, delta));

    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.45}
      zoomSpeed={0.55}
      minDistance={3.6}
      maxDistance={30}
      autoRotate={!selectedPosition}
      autoRotateSpeed={0.11}
      onStart={() => {
        distanceTransitionUntil.current = 0;
      }}
    />
  );
}
