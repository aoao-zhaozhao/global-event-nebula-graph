import { links as defaultLinks, nodes as defaultNodes } from '../data/events.js';

const ACTOR_TYPES = new Set(['country', 'organization']);
const EVENT_TYPES = new Set(['conflict', 'diplomacy', 'economy', 'sanction']);

function mergeLink(linkMap, source, target, relation, strength) {
  if (source === target) return;
  const [a, b] = [source, target].sort();
  const key = `${a}::${b}`;
  const existing = linkMap.get(key);

  if (!existing || strength > existing.strength) {
    linkMap.set(key, {
      source: a,
      target: b,
      relation,
      strength,
    });
  }
}

function getNode(nodes, id) {
  return nodes.find((node) => node.id === id);
}

function createActorGraph(nodes, links) {
  const actorNodes = nodes.filter((node) => ACTOR_TYPES.has(node.type));
  const actorIds = new Set(actorNodes.map((node) => node.id));
  const linkMap = new Map();

  links.forEach((link) => {
    if (actorIds.has(link.source) && actorIds.has(link.target)) {
      mergeLink(linkMap, link.source, link.target, link.relation, link.strength);
    }
  });

  nodes
    .filter((node) => EVENT_TYPES.has(node.type))
    .forEach((eventNode) => {
      const participants = links
        .filter((link) => link.source === eventNode.id || link.target === eventNode.id)
        .map((link) => (link.source === eventNode.id ? link.target : link.source))
        .filter((id) => actorIds.has(id));

      for (let i = 0; i < participants.length; i += 1) {
        for (let j = i + 1; j < participants.length; j += 1) {
          mergeLink(
            linkMap,
            participants[i],
            participants[j],
            eventNode.name,
            Math.min(0.95, 0.38 + eventNode.importance / 18),
          );
        }
      }
    });

  const actorLinks = [...linkMap.values()]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 72);

  return {
    nodes: actorNodes,
    links: actorLinks,
  };
}

function createEventGraph(nodes, links) {
  const eventNodes = nodes.filter((node) => EVENT_TYPES.has(node.type));
  const eventIds = new Set(eventNodes.map((node) => node.id));
  const actorIds = new Set(nodes.filter((node) => ACTOR_TYPES.has(node.type)).map((node) => node.id));
  const linkMap = new Map();

  links.forEach((link) => {
    if (eventIds.has(link.source) && eventIds.has(link.target)) {
      mergeLink(linkMap, link.source, link.target, link.relation, link.strength);
    }
  });

  nodes
    .filter((node) => actorIds.has(node.id))
    .forEach((actorNode) => {
      const actorEvents = links
        .filter((link) => link.source === actorNode.id || link.target === actorNode.id)
        .map((link) => (link.source === actorNode.id ? link.target : link.source))
        .filter((id) => eventIds.has(id));

      for (let i = 0; i < actorEvents.length; i += 1) {
        for (let j = i + 1; j < actorEvents.length; j += 1) {
          const sourceEvent = getNode(nodes, actorEvents[i]);
          const targetEvent = getNode(nodes, actorEvents[j]);
          const strength = Math.min(
            0.9,
            0.3 + actorNode.importance / 22 + (sourceEvent.importance + targetEvent.importance) / 52,
          );

          mergeLink(linkMap, actorEvents[i], actorEvents[j], actorNode.name, strength);
        }
      }
    });

  const eventLinks = [...linkMap.values()]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 78);

  return {
    nodes: eventNodes,
    links: eventLinks,
  };
}

export function createGraphLayers(data) {
  const nodes = data?.nodes || defaultNodes;
  const links = data?.links || defaultLinks;

  return {
    actors: createActorGraph(nodes, links),
    events: createEventGraph(nodes, links),
  };
}

export const graphLayers = createGraphLayers({ nodes: defaultNodes, links: defaultLinks });

export const layerOptions = [
  { id: 'actors', label: '国家/组织层', shortLabel: '国家' },
  { id: 'events', label: '事件层', shortLabel: '事件' },
];
