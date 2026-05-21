const clusterCenters = {
  country: [-1.1, 0.2, 0.1],
  organization: [-3.8, 2.4, -1.2],
  conflict: [3.9, 1.3, 0.6],
  diplomacy: [0.2, 3.5, -1.9],
  economy: [-2.8, -3.1, 1.1],
  sanction: [3.4, -2.7, -0.9],
};

const clusterProfiles = {
  country: {
    ringSize: 9,
    radius: [2.35, 1.05, 2.2],
    ringStep: [0.56, 0.16, 0.52],
    verticalSpacing: 0.22,
    twist: 0.46,
    jitter: [0.22, 0.18, 0.2],
    importanceStretch: 0.11,
    angleOffset: 0.25,
  },
  organization: {
    ringSize: 7,
    radius: [1.95, 1.55, 1.55],
    ringStep: [0.5, 0.18, 0.44],
    verticalSpacing: 0.28,
    twist: 0.52,
    jitter: [0.2, 0.17, 0.18],
    importanceStretch: 0.09,
    angleOffset: -0.4,
  },
  conflict: {
    ringSize: 8,
    radius: [2.2, 1.3, 2.0],
    ringStep: [0.58, 0.16, 0.56],
    verticalSpacing: 0.2,
    twist: 0.54,
    jitter: [0.24, 0.16, 0.22],
    importanceStretch: 0.12,
    angleOffset: 0.7,
  },
  diplomacy: {
    ringSize: 8,
    radius: [1.9, 1.6, 1.45],
    ringStep: [0.45, 0.22, 0.42],
    verticalSpacing: 0.3,
    twist: 0.38,
    jitter: [0.2, 0.2, 0.16],
    importanceStretch: 0.08,
    angleOffset: 0.1,
  },
  economy: {
    ringSize: 8,
    radius: [2.25, 1.2, 1.95],
    ringStep: [0.53, 0.2, 0.5],
    verticalSpacing: 0.24,
    twist: 0.5,
    jitter: [0.22, 0.18, 0.2],
    importanceStretch: 0.1,
    angleOffset: -0.25,
  },
  sanction: {
    ringSize: 7,
    radius: [2.15, 1.0, 1.85],
    ringStep: [0.5, 0.18, 0.48],
    verticalSpacing: 0.24,
    twist: 0.48,
    jitter: [0.22, 0.16, 0.2],
    importanceStretch: 0.1,
    angleOffset: 0.55,
  },
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

const defaultClusterProfile = {
  ringSize: 7,
  radius: [2.0, 1.25, 1.8],
  ringStep: [0.5, 0.2, 0.45],
  verticalSpacing: 0.24,
  twist: 0.45,
  jitter: [0.2, 0.16, 0.18],
  importanceStretch: 0.1,
  angleOffset: 0,
};

function hashNumber(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getClusterProfile(type) {
  return clusterProfiles[type] || defaultClusterProfile;
}

export function createLayout(nodes) {
  const layout = {};
  const grouped = nodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([type, group]) => {
    const profile = getClusterProfile(type);
    const ordered = [...group].sort((a, b) => {
      const importanceDelta = Number(b.importance) - Number(a.importance);
      if (Math.abs(importanceDelta) > 0.001) return importanceDelta;
      return hashNumber(a.id) - hashNumber(b.id);
    });
    const ringSize = Math.max(4, Math.min(profile.ringSize, ordered.length));
    const ringCount = Math.max(1, Math.ceil(ordered.length / ringSize));

    ordered.forEach((node, index) => {
      const seed = hashNumber(node.id);
      const ring = Math.floor(index / ringSize);
      const slot = index % ringSize;
      const ringRatio = ringCount <= 1 ? 0 : ring / (ringCount - 1);
      const angle = profile.angleOffset + (Math.PI * 2 * slot) / ringSize + ring * profile.twist + (seed % 29) * 0.03;
      const importanceBias = (10 - Number(node.importance)) * profile.importanceStretch;
      const radiusX = profile.radius[0] + ring * profile.ringStep[0] + importanceBias;
      const radiusY = profile.radius[1] + ring * profile.ringStep[1] + ringRatio * profile.verticalSpacing;
      const radiusZ = profile.radius[2] + ring * profile.ringStep[2] + importanceBias * 0.72;
      const jitterX = Math.sin(seed * 0.013 + index) * profile.jitter[0];
      const jitterY = Math.cos(seed * 0.017 + index * 0.5) * profile.jitter[1];
      const jitterZ = Math.sin(seed * 0.019 + index * 0.7) * profile.jitter[2];
      const center = clusterCenters[type] || [0, 0, 0];

      layout[node.id] = [
        center[0] + Math.cos(angle) * radiusX + jitterX,
        center[1] + (ring - (ringCount - 1) / 2) * radiusY * 0.32 + jitterY,
        center[2] + Math.sin(angle) * radiusZ + jitterZ,
      ];
    });
  });

  return nodes.reduce((result, node) => {
    if (priorityPositions[node.id]) {
      result[node.id] = priorityPositions[node.id];
    }
    if (!result[node.id] && layout[node.id]) {
      result[node.id] = layout[node.id];
    }
    return result;
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
