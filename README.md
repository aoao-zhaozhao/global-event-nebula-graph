# 国际关系星图

这是一个基于 React 和 Three.js 的国际关系事件图与地球视图项目。

## 本地开发

```bash
npm install
npm run dev
```

管理界面：

```bash
npm run manager
```

生产构建：

```bash
npm run build
```

## 数据结构

图谱数据使用以下结构：

```json
{
  "typeLabels": {},
  "typeColors": {},
  "nodeLineColors": {},
  "nodes": [],
  "links": []
}
```

本地源数据位于 `src/data/events.js`。

## 批量数据流程

适合大批量更新时使用：

1. 修改 `src/data/events.js`。
2. 导出 JSON：

```bash
npm run export:graph -- --out graph.json
```

3. 上传到线上站点：

```bash
npm run upload:graph -- --base-url https://www.global-event-nebula-graph.top --token YOUR_ADMIN_TOKEN --file graph.json
```

`graph.json` 是本地生成文件，不要提交到仓库。

## 推送到仓库

修改代码后，把内容同步到 GitHub 的基本流程如下：

1. 查看改动：

```bash
git status
```

2. 添加文件：

```bash
git add .
```

3. 提交到本地仓库：

```bash
git commit -m "你的提交说明"
```

4. 推送到远端仓库：

```bash
git push origin main
```

如果推送时出现 `Connection was reset`，通常是网络传输中断。可以换个网络后重试，或稍后再推。

## 上传规则

- 线上地址使用正式站点地址，不要用控制台地址。
- 上传脚本会先登录，再通过 `PUT /api/data` 写入数据。
- API 使用的 EdgeKV 命名空间是 `xingtu_data`。
- 当前存储键包括：
  - `graph_meta`
  - `graph_nodes`
  - `graph_links`
  - `graph` 兼容旧格式和回滚
- 旧的单键 `graph` 结构保留为兜底方案，但新的批量上传应优先使用脚本。
- 大图谱数据不要手工在控制台里逐条编辑 KV。

## API 说明

- `GET /api/data` 返回重建后的图谱数据。
- `PUT /api/data` 需要已登录的管理员会话。
- 线上应用地址：`https://www.global-event-nebula-graph.top/`

## 相关文件

- `src/data/events.js` - 本地图谱源数据
- `tools/export-graph-json.mjs` - 导出 JSON
- `tools/upload-graph.mjs` - 上传到线上站点
- `edge/index.js` - 边缘 API 和 KV 读写逻辑
