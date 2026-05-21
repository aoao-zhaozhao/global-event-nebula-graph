import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodes, links, typeLabels, typeColors, nodeLineColors } from '../src/data/events.js';

function parseArgs(argv) {
  const args = {
    out: process.env.GRAPH_OUT || 'graph.json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--out') {
      args.out = argv[++index] || args.out;
      continue;
    }
    if (value.startsWith('--out=')) {
      args.out = value.slice('--out='.length) || args.out;
      continue;
    }
    if (value === '--help' || value === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log([
    'Usage:',
    '  node tools/export-graph-json.mjs [--out graph.json]',
    '',
    'Env vars:',
    '  GRAPH_OUT',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const data = { typeLabels, typeColors, nodeLineColors, nodes, links };
  const outFile = path.resolve(process.cwd(), args.out);
  await writeFile(outFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.basename(outFile)} (${nodes.length} nodes, ${links.length} links)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
