import { findCountryForNode } from './countryCatalog.js';

const GLOBE_ACTOR_TYPES = new Set(['country']);
export const globeEventTypes = ['conflict', 'diplomacy', 'economy', 'sanction'];
const EVENT_TYPES = new Set(globeEventTypes);

export const globeCoordinates = {};
export const countryFeatureNames = {};

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

  return null;
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
