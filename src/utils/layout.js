const clusterCenters = {
  country: [-1.1, 0.2, 0.1],
  organization: [-3.8, 2.4, -1.2],
  conflict: [3.9, 1.3, 0.6],
  diplomacy: [0.2, 3.5, -1.9],
  economy: [-2.8, -3.1, 1.1],
  sanction: [3.4, -2.7, -0.9],
};

const priorityPositions = {
  russia_ukraine_war: [0.4, 0.1, 0],
  gaza_war: [3.9, 1.35, 0.45],
  us: [-1.55, 0.72, 0.65],
  china: [-0.7, -0.9, -0.28],
  russia: [1.45, 0.52, -0.48],
  ukraine: [0.75, -1.12, 0.74],
  eu: [-2.7, 1.45, -1],
  nato: [-1.45, 2.45, 0.18],
  un: [-3.45, 3.2, -0.72],
  israel: [4.05, 0.05, 1.02],
  palestine: [4.85, -0.08, 0.15],
  g7: [-2.7, 2.2, -0.25],
  g20: [-2.35, -1.85, 0.8],
  brics: [-0.15, -2.85, 1.15],
};

function hashNumber(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function createLayout(nodes) {
  const counts = {};

  return nodes.reduce((layout, node) => {
    if (priorityPositions[node.id]) {
      layout[node.id] = priorityPositions[node.id];
      return layout;
    }

    counts[node.type] = (counts[node.type] || 0) + 1;
    const index = counts[node.type];
    const seed = hashNumber(node.id);
    const center = clusterCenters[node.type] || [0, 0, 0];
    const angle = index * 1.718 + (seed % 100) / 100;
    const vertical = Math.sin(index * 0.91 + seed * 0.001);
    const radius = 1.35 + (seed % 55) / 42 + (10 - node.importance) * 0.18;
    const spiral = 0.4 * index;

    layout[node.id] = [
      center[0] + Math.cos(angle) * radius + Math.sin(spiral) * 0.52,
      center[1] + vertical * 1.65,
      center[2] + Math.sin(angle) * radius + Math.cos(spiral) * 0.58,
    ];

    return layout;
  }, {});
}

export function getRelatedNodes(nodeId, links) {
  return links
    .filter((link) => link.source === nodeId || link.target === nodeId)
    .map((link) => (link.source === nodeId ? link.target : link.source));
}

export function getCoreFocus(nodes, layout) {
  const coreNodes = nodes.filter((node) => node.importance >= 8.6);
  const center = coreNodes.reduce(
    (acc, node) => {
      const point = layout[node.id];
      acc[0] += point[0];
      acc[1] += point[1];
      acc[2] += point[2];
      return acc;
    },
    [0, 0, 0],
  );

  return center.map((value) => value / coreNodes.length);
}
