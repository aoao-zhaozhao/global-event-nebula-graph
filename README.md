# International Relations Starmap

Three.js + React project for an international relations graph and globe view.

## Development

```bash
npm install
npm run dev
```

Admin/manager tooling:

```bash
npm run manager
```

Production build:

```bash
npm run build
```

## Data Model

The graph payload uses this shape:

```json
{
  "typeLabels": {},
  "typeColors": {},
  "nodeLineColors": {},
  "nodes": [],
  "links": []
}
```

Source data lives in `src/data/events.js`.

## Bulk Data Workflow

Use this flow for large updates:

1. Edit `src/data/events.js`.
2. Export a JSON payload:

```bash
npm run export:graph -- --out graph.json
```

3. Upload the JSON to the live site:

```bash
npm run upload:graph -- --base-url https://www.global-event-nebula-graph.top --token YOUR_ADMIN_TOKEN --file graph.json
```

`graph.json` is a generated local file. Do not commit it.

## Upload Rules

- Use the live site base URL, not the Aliyun console URL.
- The upload script logs in first, then writes through `PUT /api/data`.
- The API stores data in ESA EdgeKV namespace `xingtu_data`.
- Current storage keys are:
  - `graph_meta`
  - `graph_nodes`
  - `graph_links`
  - `graph` for compatibility and rollback
- The old single-key `graph` layout is kept as a fallback, but new bulk uploads should use the script above.
- Do not use the console's manual KV editor for large graph payloads.

## API Notes

- `GET /api/data` returns the reconstructed graph payload.
- `PUT /api/data` requires an authenticated admin session and updates the KV-backed graph data.
- The live app URL is `https://www.global-event-nebula-graph.top/`.

## Files To Know

- `src/data/events.js` - local source graph data
- `tools/export-graph-json.mjs` - exports JSON from local source data
- `tools/upload-graph.mjs` - uploads JSON to the live ESA site
- `edge/index.js` - edge API and KV read/write logic
