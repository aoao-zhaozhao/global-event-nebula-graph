const KV_NAMESPACE = 'xingtu_data';
const GRAPH_KEY = 'graph';
const ADMIN_TOKEN_KEY = 'admin_token';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`);
  }
}

function validateGraphData(data) {
  assertPlainObject(data, '数据');
  assertPlainObject(data.typeLabels, 'typeLabels');
  assertPlainObject(data.typeColors, 'typeColors');
  assertPlainObject(data.nodeLineColors, 'nodeLineColors');

  if (!Array.isArray(data.nodes)) throw new Error('nodes 必须是数组');
  if (!Array.isArray(data.links)) throw new Error('links 必须是数组');

  const typeIds = new Set(Object.keys(data.typeLabels));
  const nodeIds = new Set();

  data.nodes.forEach((node, index) => {
    assertPlainObject(node, `nodes[${index}]`);
    if (!/^[a-zA-Z0-9_-]+$/.test(node.id || '')) {
      throw new Error(`节点 ${index + 1} 的 id 只能包含字母、数字、下划线或短横线`);
    }
    if (nodeIds.has(node.id)) throw new Error(`节点 id 重复：${node.id}`);
    if (!String(node.name || '').trim()) throw new Error(`节点 ${node.id} 缺少名称`);
    if (!typeIds.has(node.type)) throw new Error(`节点 ${node.id} 的类型不存在：${node.type}`);
    if (!Number.isFinite(Number(node.importance))) throw new Error(`节点 ${node.id} 的重要度必须是数字`);
    if (Number(node.importance) < 0 || Number(node.importance) > 10) {
      throw new Error(`节点 ${node.id} 的重要度必须在 0 到 10 之间`);
    }
    if (!String(node.year ?? '').trim()) throw new Error(`节点 ${node.id} 缺少年份`);
    if (!String(node.summary || '').trim()) throw new Error(`节点 ${node.id} 缺少摘要`);
    nodeIds.add(node.id);
  });

  data.links.forEach((link, index) => {
    assertPlainObject(link, `links[${index}]`);
    if (!nodeIds.has(link.source)) throw new Error(`关系 ${index + 1} 的 source 不存在：${link.source}`);
    if (!nodeIds.has(link.target)) throw new Error(`关系 ${index + 1} 的 target 不存在：${link.target}`);
    if (link.source === link.target) throw new Error(`关系 ${index + 1} 的 source 和 target 不能相同`);
    if (!String(link.relation || '').trim()) throw new Error(`关系 ${index + 1} 缺少关系说明`);
    if (!Number.isFinite(Number(link.strength))) throw new Error(`关系 ${index + 1} 的强度必须是数字`);
    if (Number(link.strength) < 0 || Number(link.strength) > 1) {
      throw new Error(`关系 ${index + 1} 的强度必须在 0 到 1 之间`);
    }
  });
}

function normalizeGraphData(data) {
  return {
    typeLabels: data.typeLabels,
    typeColors: data.typeColors,
    nodeLineColors: data.nodeLineColors,
    nodes: data.nodes.map((node) => ({
      id: String(node.id).trim(),
      name: String(node.name).trim(),
      type: String(node.type).trim(),
      importance: Number(node.importance),
      year: typeof node.year === 'number' ? node.year : String(node.year).trim(),
      summary: String(node.summary).trim(),
    })),
    links: data.links.map((link) => ({
      source: String(link.source).trim(),
      target: String(link.target).trim(),
      relation: String(link.relation).trim(),
      strength: Number(link.strength),
    })),
  };
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function readGraph(edgeKV) {
  const data = await edgeKV.get(GRAPH_KEY, { type: 'json' });
  if (data === undefined || data === null) {
    return jsonResponse({ error: '云端 graph 数据尚未初始化' }, 404);
  }
  return jsonResponse(data);
}

async function writeGraph(request, edgeKV) {
  const expectedToken = await edgeKV.get(ADMIN_TOKEN_KEY, { type: 'text' });
  if (!expectedToken) {
    return jsonResponse({ error: 'KV 中缺少 admin_token' }, 500);
  }

  if (getBearerToken(request) !== String(expectedToken).trim()) {
    return jsonResponse({ error: 'admin_token 不正确' }, 401);
  }

  const data = normalizeGraphData(await request.json());
  validateGraphData(data);
  await edgeKV.put(GRAPH_KEY, JSON.stringify(data));

  return jsonResponse({ ok: true, data });
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname !== '/api/data') {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  try {
    const edgeKV = new EdgeKV({ namespace: KV_NAMESPACE });

    if (request.method === 'GET') {
      return await readGraph(edgeKV);
    }

    if (request.method === 'PUT') {
      return await writeGraph(request, edgeKV);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export default {
  fetch(request) {
    return handleRequest(request);
  },
};
