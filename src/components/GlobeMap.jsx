import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Suspense, memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { nodeLineColors, typeColors } from '../data/events.js';

const RADIUS = 4.2;
const SURFACE_OFFSET = 1.018;
const BORDER_RADIUS = RADIUS * 1.006;

function latLonToVector3(lat, lon, radius = RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createArcPoints(start, end, strength, index) {
  const distance = start.distanceTo(end);
  const mid = start.clone().add(end).normalize();
  const lift = RADIUS * (0.18 + Math.min(0.52, distance / 11)) + strength * 0.52;
  const side = start
    .clone()
    .cross(end)
    .normalize()
    .multiplyScalar(Math.sin(index * 1.7) * 0.42);
  const control = mid.multiplyScalar(RADIUS + lift).add(side);
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  return curve.getPoints(54);
}

function getPolygonGroups(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function buildBorderGeometry(features) {
  const positions = [];

  features.forEach((feature) => {
    getPolygonGroups(feature.geometry).forEach((polygon) => {
      polygon.forEach((ring) => {
        for (let i = 0; i < ring.length - 1; i += 1) {
          const [lonA, latA] = ring[i];
          const [lonB, latB] = ring[i + 1];
          if (Math.abs(lonA - lonB) > 180) continue;
          const start = latLonToVector3(latA, lonA, BORDER_RADIUS);
          const end = latLonToVector3(latB, lonB, BORDER_RADIUS);
          positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
        }
      });
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function buildCountryMeshes(countryCatalog) {
  const meshes = new Map();

  countryCatalog.forEach((country) => {
    const linePoints = [];

    (country.features || [country.feature]).forEach((feature) => {
      getPolygonGroups(feature.geometry).forEach((polygon) => {
        const exterior = polygon[0];
        if (!exterior || exterior.length < 4) return;

        for (let i = 0; i < exterior.length - 1; i += 1) {
          const [lonA, latA] = exterior[i];
          const [lonB, latB] = exterior[i + 1];
          if (Math.abs(lonA - lonB) > 180) continue;
          linePoints.push(latLonToVector3(latA, lonA, RADIUS * 1.017));
          linePoints.push(latLonToVector3(latB, lonB, RADIUS * 1.017));
        }
      });
    });

    if (!linePoints.length) return;

    const existing = meshes.get(country.id);
    if (existing) {
      meshes.set(country.id, {
        linePoints: [...existing.linePoints, ...linePoints],
      });
      return;
    }
    meshes.set(country.id, { linePoints });
  });

  return meshes;
}

function createAtmosphereTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const water = ctx.createLinearGradient(0, 0, 0, canvas.height);
  water.addColorStop(0, '#4bbdff');
  water.addColorStop(0.42, '#0d58c8');
  water.addColorStop(1, '#06298b');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 520; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 1.7 + 0.35;
    ctx.fillStyle = `rgba(235, 250, 255, ${Math.random() * 0.46 + 0.12})`;
    ctx.fillRect(x, y, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function GlobeBody() {
  const texture = useMemo(() => createAtmosphereTexture(), []);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[RADIUS, 96, 96]} />
        <meshStandardMaterial
          map={texture}
          color="#9bdcff"
          roughness={0.74}
          metalness={0.02}
          emissive="#072c82"
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh scale={1.014}>
        <sphereGeometry args={[RADIUS, 96, 96]} />
        <meshBasicMaterial color="#4cbcff" transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[RADIUS, 96, 96]} />
        <meshBasicMaterial color="#72d9ff" transparent opacity={0.045} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function MovingArcParticle({ points, color, strength, offset }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current || points.length < 2) return;
    const speed = 0.09 + strength * 0.075;
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    const scaled = t * (points.length - 1);
    const index = Math.floor(scaled);
    const local = scaled - index;
    const current = points[index];
    const next = points[Math.min(index + 1, points.length - 1)];
    ref.current.position.copy(current).lerp(next, local);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.012 + strength * 0.012, 12, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function GlobeArcs({ links, nodeMap, hoveredId, selectedId }) {
  const activeId = hoveredId || selectedId;
  const arcs = useMemo(
    () =>
      links.map((link, index) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        const start = latLonToVector3(source.coordinates.lat, source.coordinates.lon, RADIUS * SURFACE_OFFSET);
        const end = latLonToVector3(target.coordinates.lat, target.coordinates.lon, RADIUS * SURFACE_OFFSET);
        return {
          ...link,
          points: createArcPoints(start, end, link.strength, index),
        };
      }),
    [links, nodeMap],
  );

  return (
    <group>
      {arcs.map((link) => {
        const active = activeId && (link.source === activeId || link.target === activeId);
        const direct = link.origin === 'direct';
        const color = active ? nodeLineColors[activeId] || '#fff0a8' : typeColors[link.type] || '#b47cff';
        const opacity = active ? 0.86 : activeId ? 0.04 : direct ? 0.28 : 0.16;
        return (
          <group key={link.id}>
            <Line
              points={link.points}
              color={color}
              lineWidth={active ? 2.2 + link.strength : (direct ? 0.56 : 0.42) + link.strength * (direct ? 0.55 : 0.38)}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
            <MovingArcParticle
              points={link.points}
              color={color}
              strength={link.strength}
              offset={(link.importance * 0.071 + link.id.length * 0.013) % 1}
            />
          </group>
        );
      })}
    </group>
  );
}

function CountryBorders({ countryCatalog }) {
  const features = useMemo(() => countryCatalog.flatMap((country) => country.features || [country.feature]), [countryCatalog]);
  const geometry = useMemo(() => buildBorderGeometry(features), [features]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#d8f5ff" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function SelectableCountries({ countries, countryCatalog, hoveredId, selectedId, onHover, onSelect }) {
  const countryMeshes = useMemo(() => buildCountryMeshes(countryCatalog), [countryCatalog]);

  return (
    <group>
      {countries.map((node) => {
        const mesh = countryMeshes.get(node.globeCountryId || node.id);
        if (!mesh) return null;
        const color = nodeLineColors[node.id] || '#61dfff';
        const active = hoveredId === node.id || selectedId === node.id;
        const hitPosition = latLonToVector3(node.coordinates.lat, node.coordinates.lon, RADIUS * 1.022);
        return (
          <group key={node.id}>
            <mesh
              position={hitPosition}
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
              <sphereGeometry args={[Math.max(0.18, Math.min(0.42, node.importance * 0.035)), 20, 20]} />
              <meshBasicMaterial color={color} transparent opacity={active ? 0.12 : 0.006} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {active && (
              <Line
                points={mesh.linePoints}
                color={color}
                lineWidth={1.7}
                transparent
                opacity={0.92}
                depthWrite={false}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function GlobeMarker({ node, selected, hovered }) {
  const position = useMemo(
    () => latLonToVector3(node.coordinates.lat, node.coordinates.lon, RADIUS * 1.035),
    [node.coordinates.lat, node.coordinates.lon],
  );
  const active = selected || hovered;

  return (
    <group position={position}>
      <Html position={[0.14, 0.14, 0]} center={false} transform sprite distanceFactor={active ? 6.4 : 8.6} zIndexRange={[18, 0]}>
        <div className={`node-label ${active ? 'node-label-active' : ''} ${node.importance >= 8.8 ? 'node-label-major' : ''}`}>
          {node.name}
        </div>
      </Html>
    </group>
  );
}

const MemoGlobeMarker = memo(GlobeMarker);

function SceneContent({ globeGraph, countryCatalog, hoveredId, selectedId, focusId, onHoverNode, onSelectNode }) {
  const globeRef = useRef();
  const nodeMap = useMemo(() => new Map(globeGraph.nodes.map((node) => [node.id, node])), [globeGraph.nodes]);
  const selectedNode = focusId ? nodeMap.get(focusId) || null : selectedId ? nodeMap.get(selectedId) : null;
  const baseQuaternion = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, -0.72, 0)), []);
  const targetRotation = useMemo(() => {
    if (!selectedNode) return null;
    const localPosition = latLonToVector3(selectedNode.coordinates.lat, selectedNode.coordinates.lon, 1);
    const worldPosition = localPosition.clone().applyQuaternion(baseQuaternion);
    const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(worldPosition.normalize(), new THREE.Vector3(0, 0, -1));
    return alignQuaternion.multiply(baseQuaternion);
  }, [baseQuaternion, selectedNode]);

  useFrame((_, delta) => {
    if (!globeRef.current) return;

    if (targetRotation) {
      globeRef.current.quaternion.slerp(targetRotation, 1 - Math.pow(0.01, delta));
      return;
    }

    globeRef.current.rotation.y += delta * 0.045;
  });

  return (
    <>
      <color attach="background" args={['#010713']} />
      <fog attach="fog" args={['#010713', 13, 42]} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[-5, 3, 8]} intensity={3.5} color="#d8f5ff" />
      <pointLight position={[5, 1, 3]} intensity={16} color="#4ca7ff" distance={25} />
      <pointLight position={[-7, -4, 6]} intensity={9} color="#ff7e96" distance={22} />
      <Stars radius={82} depth={36} count={1500} factor={3.4} saturation={0.8} fade speed={0.35} />
      <group ref={globeRef} rotation={[0.05, -0.72, 0]}>
        <GlobeBody />
        <CountryBorders countryCatalog={countryCatalog} />
        <SelectableCountries
          countries={globeGraph.nodes}
          countryCatalog={countryCatalog}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={onHoverNode}
          onSelect={onSelectNode}
        />
        <GlobeArcs links={globeGraph.links} nodeMap={nodeMap} hoveredId={hoveredId} selectedId={selectedId} />
        {globeGraph.nodes.map((node) => {
          return (
            <MemoGlobeMarker
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              hovered={hoveredId === node.id}
            />
          );
        })}
      </group>
      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.42}
        zoomSpeed={0.5}
        minDistance={6.3}
        maxDistance={17}
        target={[0, 0, 0]}
      />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.04} luminanceSmoothing={0.22} intensity={1.55} mipmapBlur />
        <Vignette eskil={false} offset={0.14} darkness={0.74} />
      </EffectComposer>
    </>
  );
}

export default function GlobeMap({ globeGraph, countryCatalog, hoveredId, selectedId, focusId, onHoverNode, onSelectNode }) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 10.8], fov: 48, near: 0.1, far: 160 }}
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
          globeGraph={globeGraph}
          countryCatalog={countryCatalog}
          hoveredId={hoveredId}
          selectedId={selectedId}
          focusId={focusId}
          onHoverNode={onHoverNode}
          onSelectNode={onSelectNode}
        />
      </Suspense>
    </Canvas>
  );
}
