import { Html } from '@react-three/drei';
import { memo } from 'react';

function NodeLabel({ node, position, active }) {
  return (
    <Html
      position={[position[0] + 0.22, position[1] + 0.2, position[2]]}
      center={false}
      transform
      sprite
      distanceFactor={active ? 7.4 : 9.8}
      zIndexRange={[20, 0]}
    >
      <div className={`node-label ${active ? 'node-label-active' : ''} ${node.importance >= 8.8 ? 'node-label-major' : ''}`}>
        {node.name}
      </div>
    </Html>
  );
}

export default memo(NodeLabel);
