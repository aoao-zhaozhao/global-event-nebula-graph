const GLOBE_ACTOR_TYPES = new Set(['country']);
export const globeEventTypes = ['conflict', 'diplomacy', 'economy', 'sanction'];
const EVENT_TYPES = new Set(globeEventTypes);

export const globeCountryProfiles = {
  us: {
    coordinates: { lat: 39.5, lon: -98.35 },
    aliases: ['United States of America', 'United States', 'USA', 'US', '美国'],
  },
  china: {
    coordinates: { lat: 35.86, lon: 104.2 },
    aliases: ['China', 'People\'s Republic of China', 'PRC', '中国'],
  },
  russia: { coordinates: { lat: 61.52, lon: 105.32 }, aliases: ['Russia', 'Russian Federation', '俄罗斯'] },
  ukraine: { coordinates: { lat: 48.38, lon: 31.17 }, aliases: ['Ukraine', '乌克兰'] },
  eu: { coordinates: { lat: 50.85, lon: 4.35 }, aliases: ['European Union', 'EU', '欧盟'] },
  un: { coordinates: { lat: 40.75, lon: -73.97 }, aliases: ['United Nations', 'UN', '联合国'] },
  nato: { coordinates: { lat: 50.88, lon: 4.42 }, aliases: ['NATO', 'North Atlantic Treaty Organization', '北约'] },
  g20: { coordinates: { lat: 28.61, lon: 77.2 }, aliases: ['G20', '二十国集团'] },
  asean: { coordinates: { lat: -6.21, lon: 106.85 }, aliases: ['ASEAN', '东盟'] },
  brics: { coordinates: { lat: -25.75, lon: 28.23 }, aliases: ['BRICS', '金砖'] },
  who: { coordinates: { lat: 46.23, lon: 6.14 }, aliases: ['World Health Organization', 'WHO', '世界卫生组织'] },
  wto: { coordinates: { lat: 46.22, lon: 6.14 }, aliases: ['World Trade Organization', 'WTO', '世界贸易组织'] },
  france: { coordinates: { lat: 46.23, lon: 2.21 }, aliases: ['France', 'French Republic', 'FR', '法国'] },
  iran: { coordinates: { lat: 32.43, lon: 53.69 }, aliases: ['Iran', '伊朗'] },
  israel: { coordinates: { lat: 31.05, lon: 34.85 }, aliases: ['Israel', '以色列'] },
  palestine: { coordinates: { lat: 31.95, lon: 35.23 }, aliases: ['Palestine', '巴勒斯坦'] },
  saudi: { coordinates: { lat: 23.89, lon: 45.08 }, aliases: ['Saudi Arabia', 'Saudi', '沙特', '沙特阿拉伯'] },
  india: { coordinates: { lat: 20.59, lon: 78.96 }, aliases: ['India', '印度'] },
  japan: { coordinates: { lat: 36.2, lon: 138.25 }, aliases: ['Japan', '日本'] },
  south_korea: { coordinates: { lat: 35.91, lon: 127.77 }, aliases: ['South Korea', 'Korea', '韩国'] },
  turkiye: { coordinates: { lat: 38.96, lon: 35.24 }, aliases: ['Turkey', 'Turkiye', 'Türkiye', '土耳其'] },
  african_union: { coordinates: { lat: 9.03, lon: 38.74 }, aliases: ['African Union', 'AU', '非盟'] },
  uk: { coordinates: { lat: 55.38, lon: -3.44 }, aliases: ['United Kingdom', 'UK', 'Britain', '英国'] },
  australia: { coordinates: { lat: -25.27, lon: 133.78 }, aliases: ['Australia', '澳大利亚'] },
};

export const globeCoordinates = Object.fromEntries(
  Object.entries(globeCountryProfiles).map(([id, profile]) => [id, profile.coordinates]),
);

export const countryFeatureNames = Object.fromEntries(
  Object.entries(globeCountryProfiles).map(([id, profile]) => [id, profile.aliases]),
);

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function getGlobeCountryProfile(nodeOrId) {
  const countryId = getGlobeCountryId(nodeOrId);
  return countryId ? globeCountryProfiles[countryId] : null;
}

export function getGlobeCountryId(nodeOrId) {
  const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id;
  const name = typeof nodeOrId === 'string' ? '' : nodeOrId?.name;
  const candidates = [id, name].map(normalizeLookupValue).filter(Boolean);

  return Object.entries(globeCountryProfiles).find(([profileId, profile]) => {
    const aliases = [profileId, ...profile.aliases].map(normalizeLookupValue);
    return candidates.some((candidate) => aliases.includes(candidate));
  })?.[0] || null;
}

function dedupe(ids) {
  return [...new Set(ids)];
}

function getNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function mergeGlobeLink(linkMap, source, target, eventNode, strength) {
  if (!source || !target || source === target) return;

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
    .filter((node) => GLOBE_ACTOR_TYPES.has(node.type) && getGlobeCountryProfile(node))
    .map((node) => ({
      ...node,
      globeCountryId: getGlobeCountryId(node),
      coordinates: getGlobeCountryProfile(node).coordinates,
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
