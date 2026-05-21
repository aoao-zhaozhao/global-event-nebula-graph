const KV_NAMESPACE = 'xingtu_data';
const GRAPH_KEY = 'graph';
const GRAPH_META_KEY = 'graph_meta';
const GRAPH_NODES_KEY = 'graph_nodes';
const GRAPH_LINKS_KEY = 'graph_links';
const ADMIN_TOKEN_KEY = 'admin_token';
const SESSION_COOKIE = 'xingtu_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
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
    nodes: data.nodes.map((node) => {
      const { id, name, type, importance, year, summary, ...rest } = node;
      return {
        ...rest,
        id: String(id).trim(),
        name: String(name).trim(),
        type: String(type).trim(),
        importance: Number(importance),
        year: typeof year === 'number' ? year : String(year).trim(),
        summary: String(summary).trim(),
      };
    }),
    links: data.links.map((link) => {
      const { source, target, relation, strength, ...rest } = link;
      return {
        ...rest,
        source: String(source).trim(),
        target: String(target).trim(),
        relation: String(relation).trim(),
        strength: Number(strength),
      };
    }),
  };
}

function buildGraphMeta(data) {
  return {
    schemaVersion: 2,
    typeLabels: data.typeLabels,
    typeColors: data.typeColors,
    nodeLineColors: data.nodeLineColors,
    counts: {
      nodes: data.nodes.length,
      links: data.links.length,
    },
    updatedAt: new Date().toISOString(),
  };
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacHex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.get('cookie') || '';
  const pairs = cookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator) === name) return pair.slice(separator + 1);
  }
  return '';
}

function requestProtocol(request) {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase();
  return new URL(request.url).protocol.replace(':', '').toLowerCase();
}

function isSecureRequest(request) {
  const url = new URL(request.url);
  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return localhost || requestProtocol(request) === 'https';
}

function sessionCookie(value, maxAge) {
  const attributes = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];

  if (maxAge === 0) attributes.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return attributes.join('; ');
}

async function createSessionValue(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = randomHex(16);
  const payload = `${expiresAt}.${nonce}`;
  const signature = await hmacHex(secret, payload);
  return {
    value: `${payload}.${signature}`,
    expiresAt,
  };
}

async function verifySession(request, secret) {
  const value = getCookieValue(request, SESSION_COOKIE);
  if (!value) return { authenticated: false, expiresAt: null };

  const parts = value.split('.');
  if (parts.length !== 3) return { authenticated: false, expiresAt: null };

  const [expiresAtText, nonce, signature] = parts;
  if (!/^\d+$/.test(expiresAtText) || !/^[a-f0-9]{32}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { authenticated: false, expiresAt: null };
  }

  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return { authenticated: false, expiresAt: null };
  }

  const expected = await hmacHex(secret, `${expiresAtText}.${nonce}`);
  return {
    authenticated: timingSafeEqual(expected, signature),
    expiresAt,
  };
}

async function getAdminToken(edgeKV) {
  const token = await edgeKV.get(ADMIN_TOKEN_KEY, { type: 'text' });
  return String(token || '').trim();
}

async function readGraph(edgeKV) {
  const [meta, nodes, links, legacy] = await Promise.all([
    edgeKV.get(GRAPH_META_KEY, { type: 'json' }),
    edgeKV.get(GRAPH_NODES_KEY, { type: 'json' }),
    edgeKV.get(GRAPH_LINKS_KEY, { type: 'json' }),
    edgeKV.get(GRAPH_KEY, { type: 'json' }),
  ]);

  if (meta && Array.isArray(nodes) && Array.isArray(links)) {
    return jsonResponse({
      ...meta,
      nodes,
      links,
    });
  }

  if (legacy) {
    return jsonResponse(legacy);
  }

  return jsonResponse({ error: '云端 graph 数据尚未初始化' }, 404);
}

async function login(request, edgeKV) {
  if (!isSecureRequest(request)) {
    return jsonResponse({ error: '请使用 HTTPS 打开管理后台后再登录' }, 403);
  }

  const expectedToken = await getAdminToken(edgeKV);
  if (!expectedToken) {
    return jsonResponse({ error: 'KV 中缺少 admin_token' }, 500);
  }

  const body = await request.json();
  const token = String(body?.token || '').trim();
  if (!token || !timingSafeEqual(token, expectedToken)) {
    return jsonResponse({ error: 'admin_token 不正确' }, 401);
  }

  const session = await createSessionValue(expectedToken);
  return jsonResponse(
    { ok: true, authenticated: true, expiresAt: session.expiresAt },
    200,
    { 'set-cookie': sessionCookie(session.value, SESSION_TTL_SECONDS) },
  );
}

async function logout() {
  return jsonResponse({ ok: true, authenticated: false }, 200, { 'set-cookie': sessionCookie('', 0) });
}

async function sessionStatus(request, edgeKV) {
  const expectedToken = await getAdminToken(edgeKV);
  if (!expectedToken) {
    return jsonResponse({ authenticated: false, configured: false });
  }

  const session = await verifySession(request, expectedToken);
  return jsonResponse({
    authenticated: session.authenticated,
    configured: true,
    expiresAt: session.expiresAt,
  });
}

async function writeGraph(request, edgeKV) {
  const expectedToken = await getAdminToken(edgeKV);
  if (!expectedToken) {
    return jsonResponse({ error: 'KV 中缺少 admin_token' }, 500);
  }

  const session = await verifySession(request, expectedToken);
  if (!session.authenticated) {
    return jsonResponse({ error: '未登录或会话已过期' }, 401);
  }

  const data = normalizeGraphData(await request.json());
  validateGraphData(data);
  await Promise.all([
    edgeKV.put(GRAPH_META_KEY, JSON.stringify(buildGraphMeta(data))),
    edgeKV.put(GRAPH_NODES_KEY, JSON.stringify(data.nodes)),
    edgeKV.put(GRAPH_LINKS_KEY, JSON.stringify(data.links)),
    edgeKV.put(GRAPH_KEY, JSON.stringify(data)),
  ]);

  return jsonResponse({ ok: true, data });
}

async function handleRequest(request) {
  const url = new URL(request.url);

  try {
    const edgeKV = new EdgeKV({ namespace: KV_NAMESPACE });

    if (url.pathname === '/api/admin/session' && request.method === 'GET') {
      return await sessionStatus(request, edgeKV);
    }

    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      return await login(request, edgeKV);
    }

    if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
      return await logout();
    }

    if (url.pathname === '/api/data' && request.method === 'GET') {
      return await readGraph(edgeKV);
    }

    if (url.pathname === '/api/data' && request.method === 'PUT') {
      return await writeGraph(request, edgeKV);
    }

    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export default {
  fetch(request) {
    return handleRequest(request);
  },
};
