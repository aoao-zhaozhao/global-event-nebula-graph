const GLOBE_ACTOR_TYPES = new Set(['country']);
export const globeEventTypes = ['conflict', 'diplomacy', 'economy', 'sanction'];
const EVENT_TYPES = new Set(globeEventTypes);

export const globeCoordinates = {
  us: { lat: 39.5, lon: -98.35 },
  china: { lat: 35.86, lon: 104.2 },
  russia: { lat: 61.52, lon: 105.32 },
  ukraine: { lat: 48.38, lon: 31.17 },
  eu: { lat: 50.85, lon: 4.35 },
  un: { lat: 40.75, lon: -73.97 },
  nato: { lat: 50.88, lon: 4.42 },
  g20: { lat: 28.61, lon: 77.2 },
  asean: { lat: -6.21, lon: 106.85 },
  brics: { lat: -25.75, lon: 28.23 },
  who: { lat: 46.23, lon: 6.14 },
  wto: { lat: 46.22, lon: 6.14 },
  iran: { lat: 32.43, lon: 53.69 },
  israel: { lat: 31.05, lon: 34.85 },
  palestine: { lat: 31.95, lon: 35.23 },
  saudi: { lat: 23.89, lon: 45.08 },
  india: { lat: 20.59, lon: 78.96 },
  japan: { lat: 36.2, lon: 138.25 },
  south_korea: { lat: 35.91, lon: 127.77 },
  turkiye: { lat: 38.96, lon: 35.24 },
  african_union: { lat: 9.03, lon: 38.74 },
  uk: { lat: 55.38, lon: -3.44 },
  australia: { lat: -25.27, lon: 133.78 },
};

export const countryFeatureNames = {
  us: ['United States of America', 'United States'],
  china: ['China', 'Taiwan'],
  russia: ['Russia'],
  ukraine: ['Ukraine'],
  iran: ['Iran'],
  israel: ['Israel'],
  palestine: ['Palestine'],
  saudi: ['Saudi Arabia'],
  india: ['India'],
  japan: ['Japan'],
  south_korea: ['South Korea'],
  turkiye: ['Turkey', 'Turkiye'],
  uk: ['United Kingdom'],
  australia: ['Australia'],
};

function dedupe(ids) {
  return [...new Set(ids)];
}

function getNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function mergeGlobeLink(linkMap, source, target, eventNode, strength) {
  if (!source || !target || source === target) return;
  if (!globeCoordinates[source] || !globeCoordinates[target]) return;

  const [a, b] = [source, target].sort();
  const key = `${a}::${b}::${eventNode.id}`;
  const existing = linkMap.get(key);
  const nextStrength = Math.max(existing?.strength || 0, strength);

  linkMap.set(key, {
    id: key,
    source: a,
    target: b,
    eventId: eventNode.id,
    relation: eventNode.name,
    type: eventNode.type,
    strength: nextStrength,
    importance: eventNode.importance,
    year: eventNode.year,
  });
}

function yearMatches(eventYear, filterYear) {
  if (!filterYear || filterYear === 'all') return true;
  return String(eventYear || '').includes(String(filterYear));
}

function typeMatches(eventType, filterType) {
  return !filterType || filterType === 'all' || eventType === filterType;
}

export function createGlobeGraph(data, filters = {}) {
  const nodes = data?.nodes || [];
  const links = data?.links || [];
  const nodeMap = getNodeMap(nodes);
  const actors = nodes
    .filter((node) => GLOBE_ACTOR_TYPES.has(node.type) && globeCoordinates[node.id])
    .map((node) => ({
      ...node,
      coordinates: globeCoordinates[node.id],
    }));
  const actorIds = new Set(actors.map((node) => node.id));
  const linkMap = new Map();

  nodes
    .filter((node) => EVENT_TYPES.has(node.type))
    .filter((node) => typeMatches(node.type, filters.type) && yearMatches(node.year, filters.year))
    .forEach((eventNode) => {
      const participants = dedupe(
        links
          .filter((link) => link.source === eventNode.id || link.target === eventNode.id)
          .map((link) => (link.source === eventNode.id ? link.target : link.source))
          .filter((id) => actorIds.has(id)),
      );

      for (let i = 0; i < participants.length; i += 1) {
        for (let j = i + 1; j < participants.length; j += 1) {
          const direct = links.find(
            (link) =>
              (link.source === participants[i] && link.target === participants[j]) ||
              (link.source === participants[j] && link.target === participants[i]),
          );
          mergeGlobeLink(linkMap, participants[i], participants[j], eventNode, direct?.strength || Math.min(1, 0.34 + eventNode.importance / 14));
        }
      }
    });

  if (!filters.type || filters.type === 'all') {
    links.forEach((link) => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return;
      if (!actorIds.has(source.id) || !actorIds.has(target.id)) return;

      mergeGlobeLink(
        linkMap,
        source.id,
        target.id,
        {
          id: `${source.id}_${target.id}`,
          name: link.relation,
          type: target.type === 'organization' || source.type === 'organization' ? 'diplomacy' : 'economy',
          importance: Math.max(source.importance || 5, target.importance || 5),
          year: source.year || target.year,
        },
        link.strength,
      );
    });
  }

  return {
    nodes: actors,
    links: [...linkMap.values()].sort((a, b) => b.importance - a.importance || b.strength - a.strength).slice(0, 96),
  };
}
