import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = {
    file: process.env.GRAPH_FILE || 'graph.json',
    baseUrl: process.env.ESA_BASE_URL || process.env.BASE_URL || '',
    token: process.env.ADMIN_TOKEN || process.env.ESA_ADMIN_TOKEN || '',
  };

  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--file') {
      args.file = argv[++index] || args.file;
      continue;
    }
    if (value.startsWith('--file=')) {
      args.file = value.slice('--file='.length) || args.file;
      continue;
    }
    if (value === '--base-url') {
      args.baseUrl = argv[++index] || args.baseUrl;
      continue;
    }
    if (value.startsWith('--base-url=')) {
      args.baseUrl = value.slice('--base-url='.length) || args.baseUrl;
      continue;
    }
    if (value === '--token') {
      args.token = argv[++index] || args.token;
      continue;
    }
    if (value.startsWith('--token=')) {
      args.token = value.slice('--token='.length) || args.token;
      continue;
    }
    if (value === '--help' || value === '-h') {
      args.help = true;
      continue;
    }
    positionals.push(value);
  }

  if (!args.file && positionals[0]) args.file = positionals[0];
  if (!args.baseUrl && positionals[1]) args.baseUrl = positionals[1];
  if (!args.token && positionals[2]) args.token = positionals[2];

  return args;
}

function printHelp() {
  console.log([
    'Usage:',
    '  node tools/upload-graph.mjs --base-url https://your-site --token YOUR_ADMIN_TOKEN [--file graph.json]',
    '',
    'Env vars:',
    '  GRAPH_FILE, ESA_BASE_URL, BASE_URL, ADMIN_TOKEN, ESA_ADMIN_TOKEN',
    '',
    'Examples:',
    '  node tools/upload-graph.mjs --base-url https://example.com --token abc123 --file graph.json',
    '  npm run upload:graph -- --base-url https://example.com --token abc123',
  ].join('\n'));
}

function normalizeBaseUrl(input) {
  if (!input) return '';
  return input.endsWith('/') ? input : `${input}/`;
}

function extractCookie(headers) {
  const setCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : [];
  if (!setCookies.length) return '';
  return String(setCookies[0]).split(';')[0].trim();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return { response, payload };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.baseUrl) {
    throw new Error('Missing base URL. Pass --base-url or set ESA_BASE_URL / BASE_URL.');
  }
  if (!args.token) {
    throw new Error('Missing admin token. Pass --token or set ADMIN_TOKEN / ESA_ADMIN_TOKEN.');
  }

  const filePath = path.resolve(process.cwd(), args.file);
  const raw = await readFile(filePath, 'utf8');
  const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

  if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    throw new Error('JSON must contain nodes and links arrays.');
  }

  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const loginUrl = new URL('/api/admin/login', baseUrl);
  const dataUrl = new URL('/api/data', baseUrl);

  const login = await requestJson(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ token: args.token }),
  });

  const cookie = extractCookie(login.response.headers);
  if (!cookie) {
    throw new Error('Login succeeded but no session cookie was returned.');
  }

  const upload = await requestJson(dataUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Cookie: cookie,
    },
    body: JSON.stringify(data),
  });

  const result = upload.payload.data || {};
  const nodeCount = Array.isArray(result.nodes) ? result.nodes.length : data.nodes.length;
  const linkCount = Array.isArray(result.links) ? result.links.length : data.links.length;

  console.log(`Uploaded ${path.basename(filePath)} to ${dataUrl.href}`);
  console.log(`nodes=${nodeCount} links=${linkCount}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
