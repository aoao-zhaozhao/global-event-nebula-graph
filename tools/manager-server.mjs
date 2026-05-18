import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const managerRoot = path.join(projectRoot, 'manager');
const dataFile = path.join(projectRoot, 'src', 'data', 'events.js');
const backupRoot = path.join(projectRoot, 'backups');
const managerPort = Number(process.env.MANAGER_PORT || 4174);
const preferredProjectUrl = 'http://localhost:5173/';

let projectProcess = null;
let projectUrl = null;
const logs = [];

function pushLog(message) {
  const line = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${message}`;
  logs.push(line);
  if (logs.length > 160) logs.shift();
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(new Error('请求体过大'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function loadGraphData() {
  const url = `${pathToFileURL(dataFile).href}?v=${Date.now()}`;
  const module = await import(url);
  return {
    typeLabels: module.typeLabels,
    typeColors: module.typeColors,
    nodeLineColors: module.nodeLineColors,
    nodes: module.nodes,
    links: module.links,
  };
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

  const textFields = [
    ...Object.values(data.typeLabels),
    ...data.nodes.flatMap((node) => [node.name, node.type, node.year, node.summary]),
    ...data.links.flatMap((link) => [link.source, link.target, link.relation]),
  ].map((value) => String(value ?? ''));

  const suspiciousChineseLoss = textFields.some((value) => /\?{2,}/.test(value));
  const hasReadableChinese = textFields.some((value) => /[\u4e00-\u9fff]/.test(value));
  if (suspiciousChineseLoss && !hasReadableChinese) {
    throw new Error('保存内容疑似发生中文编码损坏，已阻止写入。请使用管理页面保存，或确保请求体为 UTF-8。');
  }
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

function toExport(name, value) {
  return `export const ${name} = ${JSON.stringify(value, null, 2)};\n`;
}

function renderEventsModule(data) {
  return [
    toExport('typeLabels', data.typeLabels),
    toExport('typeColors', data.typeColors),
    toExport('nodeLineColors', data.nodeLineColors),
    toExport('nodes', data.nodes),
    toExport('links', data.links),
  ].join('\n');
}

function timestampForFile() {
  const value = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
    '-',
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds()),
  ].join('');
}

async function saveGraphData(data) {
  const normalized = normalizeGraphData(data);
  validateGraphData(normalized);

  await mkdir(backupRoot, { recursive: true });
  const backupFile = path.join(backupRoot, `events-${timestampForFile()}.js`);
  await copyFile(dataFile, backupFile);
  await writeFile(dataFile, renderEventsModule(normalized), 'utf8');

  return {
    backupFile: path.relative(projectRoot, backupFile),
    data: normalized,
  };
}

function isProjectChildAlive() {
  return Boolean(projectProcess && !projectProcess.killed && projectProcess.exitCode === null);
}

async function isUrlReachable(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function getProjectStatus() {
  if (isProjectChildAlive()) {
    return {
      state: projectUrl ? 'running' : 'starting',
      url: projectUrl || preferredProjectUrl,
      pid: projectProcess.pid,
    };
  }

  if (await isUrlReachable(preferredProjectUrl)) {
    return {
      state: 'external',
      url: preferredProjectUrl,
      pid: null,
    };
  }

  return {
    state: 'stopped',
    url: preferredProjectUrl,
    pid: null,
  };
}

async function startProject() {
  const status = await getProjectStatus();
  if (status.state === 'running' || status.state === 'starting' || status.state === 'external') {
    return status;
  }

  const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  projectUrl = null;
  try {
    projectProcess = spawn(process.execPath, [viteCli, '--host', '0.0.0.0', '--port', '5173'], {
      cwd: projectRoot,
      shell: false,
      windowsHide: true,
      env: process.env,
    });
  } catch (error) {
    pushLog(`启动失败：${error.message}`);
    throw new Error(`无法从管理器启动星图：${error.message}`);
  }

  pushLog(`启动星图项目，进程 PID ${projectProcess.pid}`);

  const handleOutput = (chunk) => {
    const text = stripAnsi(chunk.toString());
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        pushLog(line);
        const match = line.match(/http:\/\/localhost:\d+\/?/i);
        if (match) projectUrl = match[0].endsWith('/') ? match[0] : `${match[0]}/`;
      });
  };

  projectProcess.stdout.on('data', handleOutput);
  projectProcess.stderr.on('data', handleOutput);
  projectProcess.on('exit', (code, signal) => {
    pushLog(`星图项目进程退出：code=${code ?? '-'} signal=${signal ?? '-'}`);
    projectProcess = null;
    projectUrl = null;
  });
  projectProcess.on('error', (error) => {
    pushLog(`启动失败：${error.message}`);
  });

  return getProjectStatus();
}

async function serveStatic(requestPath, response) {
  const cleanPath = requestPath === '/' || requestPath === '/manager' || requestPath === '/manager/'
    ? '/index.html'
    : requestPath;
  const requested = path.normalize(decodeURIComponent(cleanPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(managerRoot, requested);

  if (!filePath.startsWith(managerRoot) || !existsSync(filePath)) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const content = await readFile(filePath);
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  }[ext] || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/api/status') {
      sendJson(response, 200, {
        manager: { port: managerPort },
        project: await getProjectStatus(),
        logs: logs.slice(-80),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/project/start') {
      sendJson(response, 200, {
        project: await startProject(),
        logs: logs.slice(-80),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/data') {
      sendJson(response, 200, await loadGraphData());
      return;
    }

    if (request.method === 'PUT' && url.pathname === '/api/data') {
      const body = await readRequestBody(request);
      const result = await saveGraphData(JSON.parse(body));
      pushLog(`数据已保存，备份：${result.backupFile}`);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET') {
      await serveStatic(url.pathname, response);
      return;
    }

    sendJson(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(managerPort, () => {
  pushLog(`星图管理器已启动：http://localhost:${managerPort}/`);
  console.log(`星图管理器：http://localhost:${managerPort}/`);
});
