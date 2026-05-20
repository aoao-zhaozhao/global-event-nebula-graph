import { defaultGraphData } from './data/defaultGraph.js';
import { createCountryLookup, loadCountryCatalog } from './utils/countryCatalog.js';

const state = {
  data: null,
  activeTab: 'nodes',
  selectedNodeId: null,
  selectedLinkIndex: null,
  countryCatalog: [],
  countryLookup: new Map(),
  authed: false,
  loadingAuth: true,
  saving: false,
};

const $ = (id) => document.getElementById(id);

const nodeFields = {
  id: $('nodeId'),
  type: $('nodeType'),
  name: $('nodeName'),
  importance: $('nodeImportance'),
  year: $('nodeYear'),
  summary: $('nodeSummary'),
};

const linkFields = {
  source: $('linkSource'),
  target: $('linkTarget'),
  relation: $('linkRelation'),
  strength: $('linkStrength'),
};

function setMessage(text, kind = '') {
  const el = $('message');
  el.textContent = text;
  el.className = `message ${kind ? `message-${kind}` : ''}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...options.headers },
    ...options,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || `请求失败（${response.status}）`);
  }

  return payload;
}

function updateAuthUi() {
  $('saveAllButton').disabled = state.loadingAuth || state.saving || !state.authed;
  $('loginButton').disabled = state.loadingAuth || state.saving;
  $('logoutButton').disabled = state.loadingAuth || state.saving || !state.authed;
  $('adminTokenInput').placeholder = state.authed ? '已登录，必要时可重新登录' : 'admin_token（仅用于登录）';
}

async function refreshSession() {
  state.loadingAuth = true;
  updateAuthUi();

  try {
    const payload = await api('/api/admin/session');
    state.authed = Boolean(payload.authenticated);
  } catch {
    state.authed = false;
  } finally {
    state.loadingAuth = false;
    updateAuthUi();
  }
}

async function login() {
  try {
    const token = $('adminTokenInput').value.trim();
    if (!token) throw new Error('请先输入 admin_token');

    state.loadingAuth = true;
    updateAuthUi();

    const payload = await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ token }),
    });

    state.authed = Boolean(payload.authenticated);
    $('adminTokenInput').value = '';
    setMessage('登录成功。token 已从输入框清除，本次会话可保存到云端。', 'ok');
  } catch (error) {
    state.authed = false;
    setMessage(error.message, 'error');
  } finally {
    state.loadingAuth = false;
    updateAuthUi();
  }
}

async function logout() {
  try {
    state.loadingAuth = true;
    updateAuthUi();
    await api('/api/admin/logout', { method: 'POST' });
    state.authed = false;
    $('adminTokenInput').value = '';
    setMessage('已退出登录。', 'ok');
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    state.loadingAuth = false;
    updateAuthUi();
  }
}

function typeColor(type) {
  return state.data?.typeColors?.[type] || '#9ce7ff';
}

function nodeName(id) {
  const node = state.data.nodes.find((item) => item.id === id);
  return node ? `${node.name} (${node.id})` : id;
}

function defaultTypeId() {
  return Object.keys(state.data?.typeLabels || defaultGraphData.typeLabels)[0];
}

function syncSelectors() {
  const typeOptions = Object.entries(state.data.typeLabels)
    .map(([id, label]) => `<option value="${id}">${label} (${id})</option>`)
    .join('');
  nodeFields.type.innerHTML = typeOptions;

  const nodeOptions = state.data.nodes
    .map((node) => `<option value="${node.id}">${node.name} (${node.id})</option>`)
    .join('');
  linkFields.source.innerHTML = nodeOptions;
  linkFields.target.innerHTML = nodeOptions;
}

function syncCountryOptions() {
  const datalist = $('adminCountryOptions');
  if (!datalist) return;

  datalist.innerHTML = state.countryCatalog
    .map((country) => `<option value="${country.displayName}" label="${country.englishName || country.isoA3}"></option>`)
    .join('');
}

function matchesSearch(text) {
  const keyword = $('searchInput').value.trim().toLowerCase();
  return !keyword || text.toLowerCase().includes(keyword);
}

function renderNodeList() {
  const html = state.data.nodes
    .filter((node) => matchesSearch(`${node.id} ${node.name} ${node.type} ${node.summary}`))
    .map(
      (node) => `
        <button class="list-item ${node.id === state.selectedNodeId ? 'list-item-active' : ''}" type="button" data-node-id="${node.id}">
          <span>
            <span class="list-title">
              <span class="dot" style="background:${typeColor(node.type)}"></span>
              <span>${node.name}</span>
            </span>
            <span class="list-meta">${node.id} · ${state.data.typeLabels[node.type]} · ${node.year}</span>
          </span>
          <span class="score">${Number(node.importance).toFixed(1)}</span>
        </button>
      `,
    )
    .join('');

  $('nodeList').innerHTML = html || '<div class="form">没有匹配的节点</div>';
}

function renderLinkList() {
  const html = state.data.links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => matchesSearch(`${link.source} ${link.target} ${link.relation} ${nodeName(link.source)} ${nodeName(link.target)}`))
    .map(
      ({ link, index }) => `
        <button class="list-item ${index === state.selectedLinkIndex ? 'list-item-active' : ''}" type="button" data-link-index="${index}">
          <span>
            <span class="list-title"><span>${nodeName(link.source)} -> ${nodeName(link.target)}</span></span>
            <span class="list-meta">${link.relation}</span>
          </span>
          <span class="score">${Number(link.strength).toFixed(2)}</span>
        </button>
      `,
    )
    .join('');

  $('linkList').innerHTML = html || '<div class="form">没有匹配的关系</div>';
}

function fillNodeForm(node) {
  nodeFields.id.value = node.id || '';
  nodeFields.type.value = node.type || defaultTypeId();
  nodeFields.name.value = node.name || '';
  nodeFields.importance.value = node.importance ?? 5;
  nodeFields.year.value = node.year ?? '';
  nodeFields.summary.value = node.summary || '';
  $('deleteNodeButton').disabled = !state.selectedNodeId;
}

function fillLinkForm(link) {
  const fallback = state.data.nodes[0]?.id || '';
  linkFields.source.value = link.source || fallback;
  linkFields.target.value = link.target || state.data.nodes[1]?.id || fallback;
  linkFields.relation.value = link.relation || '';
  linkFields.strength.value = link.strength ?? 0.5;
  $('deleteLinkButton').disabled = state.selectedLinkIndex === null;
}

function selectNode(id) {
  const node = state.data.nodes.find((item) => item.id === id);
  if (!node) return;
  state.selectedNodeId = id;
  fillNodeForm(node);
  renderNodeList();
}

function selectLink(index) {
  const link = state.data.links[index];
  if (!link) return;
  state.selectedLinkIndex = index;
  fillLinkForm(link);
  renderLinkList();
}

function renderAll() {
  syncSelectors();
  renderNodeList();
  renderLinkList();

  if (state.selectedNodeId && state.data.nodes.some((node) => node.id === state.selectedNodeId)) {
    selectNode(state.selectedNodeId);
  } else {
    state.selectedNodeId = state.data.nodes[0]?.id || null;
    fillNodeForm(state.selectedNodeId ? state.data.nodes[0] : { type: defaultTypeId(), importance: 5 });
  }

  if (state.selectedLinkIndex !== null && state.data.links[state.selectedLinkIndex]) {
    selectLink(state.selectedLinkIndex);
  } else {
    state.selectedLinkIndex = state.data.links.length ? 0 : null;
    fillLinkForm(state.selectedLinkIndex === null ? {} : state.data.links[0]);
  }
}

function switchTab(tab) {
  state.activeTab = tab;
  $('nodesTab').className = tab === 'nodes' ? 'tab tab-active' : 'tab';
  $('linksTab').className = tab === 'links' ? 'tab tab-active' : 'tab';
  $('nodesPane').classList.toggle('hidden', tab !== 'nodes');
  $('linksPane').classList.toggle('hidden', tab !== 'links');
}

function collectNodeForm() {
  applyCountrySuggestion();

  return {
    id: nodeFields.id.value.trim(),
    type: nodeFields.type.value,
    name: nodeFields.name.value.trim(),
    importance: Number(nodeFields.importance.value),
    year: nodeFields.year.value.trim(),
    summary: nodeFields.summary.value.trim(),
  };
}

function toNodeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function applyCountrySuggestion() {
  if (nodeFields.type.value !== 'country') return;

  const country = state.countryLookup.get(
    String(nodeFields.name.value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_.-]+/g, ''),
  );

  if (!country) return;

  nodeFields.name.value = country.displayName;
  if (!state.selectedNodeId) {
    nodeFields.id.value = toNodeId(country.isoA3 || country.englishName || country.displayName);
  }
}

function collectLinkForm() {
  return {
    source: linkFields.source.value,
    target: linkFields.target.value,
    relation: linkFields.relation.value.trim(),
    strength: Number(linkFields.strength.value),
  };
}

function validateNode(node) {
  if (!/^[a-zA-Z0-9_-]+$/.test(node.id)) throw new Error('节点 ID 只能包含字母、数字、下划线或短横线');
  if (!node.name) throw new Error('节点名称不能为空');
  if (!node.summary) throw new Error('节点摘要不能为空');
  if (!Number.isFinite(node.importance) || node.importance < 0 || node.importance > 10) {
    throw new Error('重要度必须在 0 到 10 之间');
  }
}

function validateLink(link) {
  if (link.source === link.target) throw new Error('关系的 Source 和 Target 不能相同');
  if (!link.relation) throw new Error('关系说明不能为空');
  if (!Number.isFinite(link.strength) || link.strength < 0 || link.strength > 1) {
    throw new Error('关系强度必须在 0 到 1 之间');
  }
}

async function loadData() {
  try {
    const payload = await api('/api/data');
    state.data = payload;
    setMessage(`已读取数据：${payload.nodes.length} 个节点，${payload.links.length} 条关系。`, 'ok');
  } catch (error) {
    state.data = structuredClone(defaultGraphData);
    setMessage(`云端数据读取失败，当前显示默认数据：${error.message}`, 'error');
  }

  state.selectedNodeId = state.data.nodes[0]?.id || null;
  state.selectedLinkIndex = state.data.links.length ? 0 : null;
  renderAll();
}

$('loginButton').addEventListener('click', login);
$('logoutButton').addEventListener('click', logout);
$('reloadButton').addEventListener('click', loadData);
$('nodesTab').addEventListener('click', () => switchTab('nodes'));
$('linksTab').addEventListener('click', () => switchTab('links'));
$('searchInput').addEventListener('input', () => {
  renderNodeList();
  renderLinkList();
});

$('adminTokenInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    login();
  }
});

nodeFields.name.addEventListener('change', applyCountrySuggestion);

nodeFields.type.addEventListener('change', () => {
  if (nodeFields.type.value === 'country') applyCountrySuggestion();
});

$('newButton').addEventListener('click', () => {
  if (state.activeTab === 'nodes') {
    state.selectedNodeId = null;
    fillNodeForm({ type: defaultTypeId(), importance: 5 });
    renderNodeList();
  } else {
    state.selectedLinkIndex = null;
    fillLinkForm({});
    renderLinkList();
  }
  setMessage('已切换到新增模式');
});

$('nodeList').addEventListener('click', (event) => {
  const item = event.target.closest('[data-node-id]');
  if (item) selectNode(item.dataset.nodeId);
});

$('linkList').addEventListener('click', (event) => {
  const item = event.target.closest('[data-link-index]');
  if (item) selectLink(Number(item.dataset.linkIndex));
});

$('nodeForm').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const node = collectNodeForm();
    validateNode(node);
    const duplicate = state.data.nodes.find((item) => item.id === node.id && item.id !== state.selectedNodeId);
    if (duplicate) throw new Error(`节点 ID 已存在：${node.id}`);

    if (state.selectedNodeId) {
      const oldId = state.selectedNodeId;
      const index = state.data.nodes.findIndex((item) => item.id === oldId);
      state.data.nodes[index] = node;
      state.data.links = state.data.links.map((link) => ({
        ...link,
        source: link.source === oldId ? node.id : link.source,
        target: link.target === oldId ? node.id : link.target,
      }));
    } else {
      state.data.nodes.push(node);
    }

    state.selectedNodeId = node.id;
    renderAll();
    setMessage('节点已应用到列表，点击保存到云端后生效。', 'ok');
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

$('linkForm').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const link = collectLinkForm();
    validateLink(link);

    if (state.selectedLinkIndex !== null) {
      state.data.links[state.selectedLinkIndex] = link;
    } else {
      state.data.links.push(link);
      state.selectedLinkIndex = state.data.links.length - 1;
    }

    renderAll();
    setMessage('关系已应用到列表，点击保存到云端后生效。', 'ok');
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

$('deleteNodeButton').addEventListener('click', () => {
  if (!state.selectedNodeId) return;
  const node = state.data.nodes.find((item) => item.id === state.selectedNodeId);
  if (!confirm(`确认删除节点“${node.name}”？相关关系也会一起删除。`)) return;

  state.data.nodes = state.data.nodes.filter((item) => item.id !== state.selectedNodeId);
  state.data.links = state.data.links.filter(
    (link) => link.source !== state.selectedNodeId && link.target !== state.selectedNodeId,
  );
  state.selectedNodeId = state.data.nodes[0]?.id || null;
  state.selectedLinkIndex = state.data.links.length ? 0 : null;
  renderAll();
  setMessage('节点已删除，点击保存到云端后生效。', 'ok');
});

$('deleteLinkButton').addEventListener('click', () => {
  if (state.selectedLinkIndex === null) return;
  const link = state.data.links[state.selectedLinkIndex];
  if (!confirm(`确认删除关系“${nodeName(link.source)} -> ${nodeName(link.target)}”？`)) return;

  state.data.links.splice(state.selectedLinkIndex, 1);
  state.selectedLinkIndex = state.data.links.length ? Math.min(state.selectedLinkIndex, state.data.links.length - 1) : null;
  renderAll();
  setMessage('关系已删除，点击保存到云端后生效。', 'ok');
});

$('saveAllButton').addEventListener('click', async () => {
  if (!state.authed) {
    setMessage('请先输入 admin_token 并点击登录解锁。', 'error');
    return;
  }

  try {
    state.saving = true;
    updateAuthUi();
    const payload = await api('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(state.data),
    });
    state.data = payload.data || state.data;
    renderAll();
    setMessage(`已保存到云端：${state.data.nodes.length} 个节点，${state.data.links.length} 条关系。`, 'ok');
  } catch (error) {
    if (/401|登录|授权|token/i.test(error.message)) {
      state.authed = false;
      setMessage(`保存失败，请重新登录：${error.message}`, 'error');
    } else {
      setMessage(error.message, 'error');
    }
  } finally {
    state.saving = false;
    updateAuthUi();
  }
});

$('exportButton').addEventListener('click', async () => {
  await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2));
  setMessage('JSON 已复制到剪贴板。', 'ok');
});

$('importButton').addEventListener('click', () => {
  const raw = prompt('粘贴完整 JSON 数据');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      throw new Error('JSON 必须包含 nodes 和 links 数组');
    }
    state.data = data;
    state.selectedNodeId = data.nodes[0]?.id || null;
    state.selectedLinkIndex = data.links.length ? 0 : null;
    renderAll();
    setMessage('JSON 已导入列表，点击保存到云端后生效。', 'ok');
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

async function init() {
  updateAuthUi();
  try {
    state.countryCatalog = await loadCountryCatalog();
    state.countryLookup = createCountryLookup(state.countryCatalog);
    syncCountryOptions();
  } catch {
    state.countryCatalog = [];
    state.countryLookup = new Map();
  }
  await Promise.all([loadData(), refreshSession()]);
}

init();
