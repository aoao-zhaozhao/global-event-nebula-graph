import { Crosshair, Maximize2, RadioTower, X } from 'lucide-react';
import { typeColors, typeLabels } from '../data/events.js';
import { layerOptions } from '../utils/graphLayers.js';

function getRelated(selectedId, graph, nodeMap) {
  if (!selectedId) return [];

  return graph.links
    .filter((link) => link.source === selectedId || link.target === selectedId)
    .map((link) => {
      const relatedId = link.source === selectedId ? link.target : link.source;
      return {
        node: nodeMap.get(relatedId),
        relation: link.relation,
      };
    })
    .filter((item) => item.node)
    .slice(0, 10);
}

export default function Hud({
  graph,
  dataState,
  activeLayer,
  selectedId,
  hoveredId,
  onClose,
  onFocusCore,
  onLayerChange,
  onSelectNode,
  nodeSizeMultiplier,
  onNodeSizeChange,
}) {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const selectedNode = selectedId ? nodeMap.get(selectedId) : null;
  const hoveredNode = hoveredId ? nodeMap.get(hoveredId) : null;
  const activeNode = selectedNode || hoveredNode;
  const related = getRelated(selectedId, graph, nodeMap);
  const visibleTypes = [...new Set(graph.nodes.map((node) => node.type))];

  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <h1>国际关系事件星图</h1>
          <span className="eyebrow">2020-2026 GEOPOLITICAL CONSTELLATION</span>
        </div>
        <button className="focus-button" type="button" onClick={onFocusCore}>
          <Crosshair size={17} />
          聚焦核心事件
        </button>
      </header>

      <nav className="layer-switch" aria-label="星图层级">
        {layerOptions.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className={activeLayer === layer.id ? 'layer-button layer-button-active' : 'layer-button'}
            onClick={() => onLayerChange(layer.id)}
          >
            {layer.label}
          </button>
        ))}
      </nav>

      <aside className={`info-card ${selectedNode ? 'info-card-open' : ''}`}>
        {selectedNode && (
          <>
            <button className="close-button" type="button" onClick={onClose} aria-label="关闭信息卡片">
              <X size={18} />
            </button>
            <div className="card-kicker" style={{ color: typeColors[selectedNode.type] }}>
              <RadioTower size={15} />
              {typeLabels[selectedNode.type]}
            </div>
            <h2>{selectedNode.name}</h2>
            <div className="meta-row">
              <span>{selectedNode.year}</span>
              <span>重要度 {selectedNode.importance.toFixed(1)}</span>
            </div>
            <p>{selectedNode.summary}</p>
            <div className="related-block">
              <h3>相关节点</h3>
              <div className="related-list">
                {related.map(({ node, relation }) => (
                  <button
                    key={`${node.id}-${relation}`}
                    type="button"
                    className="related-pill"
                    onClick={() => onSelectNode(node.id)}
                  >
                    <i style={{ background: typeColors[node.type] }} />
                    {relation} · {node.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>

      <div className={`hover-readout ${activeNode ? 'hover-readout-show' : ''}`}>
        {activeNode && (
          <>
            <span style={{ background: typeColors[activeNode.type] }} />
            <strong>{activeNode.name}</strong>
            <em>{typeLabels[activeNode.type]}</em>
          </>
        )}
      </div>

      <footer className="legend-bar">
        <div className="legend-heading">{activeLayer === 'actors' ? '行为体' : '事件层'}</div>
        {visibleTypes.map((type) => (
          <div className="legend-item" key={type}>
            <span style={{ background: typeColors[type], boxShadow: `0 0 18px ${typeColors[type]}` }} />
            {typeLabels[type]}
          </div>
        ))}
        <div className="legend-spacer" />
        <div className={dataState?.source === 'cloud' ? 'data-state data-state-cloud' : 'data-state'}>
          {dataState?.loading ? '数据加载中' : dataState?.source === 'cloud' ? '云端数据' : '默认数据'}
        </div>
        <div className="size-control">
          <label htmlFor="node-size-control">节点大小</label>
          <input
            id="node-size-control"
            type="range"
            min="0.45"
            max="2.4"
            step="0.05"
            value={nodeSizeMultiplier}
            onChange={(event) => onNodeSizeChange(Number(event.target.value))}
          />
          <span>{`${nodeSizeMultiplier.toFixed(2)}x`}</span>
        </div>
        <div className="hint">
          <Maximize2 size={14} />
          拖拽旋转 · 滚轮缩放 · 点击节点
        </div>
      </footer>
    </>
  );
}
