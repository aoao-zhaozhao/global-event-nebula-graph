import { findCountryForNode } from './countryCatalog.js';

const GLOBE_ACTOR_TYPES = new Set(['country', 'organization']);
export const globeEventTypes = ['conflict', 'diplomacy', 'economy', 'sanction'];
const EVENT_TYPES = new Set(globeEventTypes);

export const organizationProfiles = {
  eu: { coordinates: { lat: 50.85, lon: 4.35 }, aliases: ['European Union', 'EU'] },
  un: { coordinates: { lat: 40.75, lon: -73.97 }, aliases: ['United Nations', 'UN'] },
  nato: { coordinates: { lat: 50.88, lon: 4.42 }, aliases: ['NATO', 'North Atlantic Treaty Organization'] },
  g20: { coordinates: { lat: 28.61, lon: 77.2 }, aliases: ['G20'] },
  asean: { coordinates: { lat: -6.21, lon: 106.85 }, aliases: ['ASEAN'] },
  brics: { coordinates: { lat: -25.75, lon: 28.23 }, aliases: ['BRICS'] },
  who: { coordinates: { lat: 46.23, lon: 6.14 }, aliases: ['World Health Organization', 'WHO'] },
  wto: { coordinates: { lat: 46.22, lon: 6.14 }, aliases: ['World Trade Organization', 'WTO'] },
  african_union: { coordinates: { lat: 9.03, lon: 38.74 }, aliases: ['African Union', 'AU'] },
};

export const globeCoordinates = Object.fromEntries(
  Object.entries(organizationProfiles).map(([id, profile]) => [id, profile.coordinates]),
);

export const countryFeatureNames = {};

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function findOrganizationProfile(nodeOrId) {
  const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id;
  const name = typeof nodeOrId === 'string' ? '' : nodeOrId?.name;
  const candidates = [id, name].map(normalizeLookupValue).filter(Boolean);

  return Object.entries(organizationProfiles).find(([profileId, profile]) => {
    const aliases = [profileId, ...profile.aliases].map(normalizeLookupValue);
    return candidates.some((candidate) => aliases.includes(candidate));
  }) || null;
}

function getGlobeProfile(node, countryLookup) {
  if (node?.type === 'country') {
    const country = findCountryForNode(node, countryLookup);
    if (!country) return null;
    return {
      globeCountryId: country.id,
      coordinates: country.center,
      country,
    };
  }

  const organization = findOrganizationProfile(node);
  if (!organization) return null;

  const [organizationId, profile] = organization;
  return {
    globeCountryId: organizationId,
    coordinates: profile.coordinates,
    organizationId,
  };
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

export function createGlobeGraph(data, filters = {}, countryLookup = null) {
  const nodes = data?.nodes || [];
  const links = data?.links || [];
  const nodeMap = getNodeMap(nodes);
  const actors = nodes
    .filter((node) => GLOBE_ACTOR_TYPES.has(node.type))
    .map((node) => {
      const profile = getGlobeProfile(node, countryLookup);
      if (!profile) return null;
      return {
        ...node,
        globeCountryId: profile.globeCountryId,
        coordinates: profile.coordinates,
      };
    })
    .filter(Boolean);
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
