import { useMemo } from 'react';
import { Crosshair, Maximize2, RadioTower, Search, X } from 'lucide-react';
import { typeColors, typeLabels } from '../data/events.js';
import { layerOptions } from '../utils/graphLayers.js';
import { createCountryLookup, findCountryForNode } from '../utils/countryCatalog.js';
import { globeEventTypes } from '../utils/globeData.js';

function normalizeLookupValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.-]+/g, '');
}

function buildCountrySearchOptions(graph, countryCatalog, countryLookup) {
  const seen = new Set();
  const options = [];

  const addOption = (value, label = '') => {
    const key = normalizeLookupValue(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push({ value, label });
  };

  graph.nodes.forEach((node) => {
    const country = findCountryForNode(node, countryLookup);
    if (country) {
      addOption(country.displayName, country.englishName || country.isoA3);
      return;
    }

    addOption(node.name, node.id);
  });

  countryCatalog?.forEach((country) => {
    addOption(country.displayName, country.englishName || country.isoA3);
  });

  return options;
}

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
  globeFilters,
  countryCatalog,
  onGlobeFiltersChange,
  onGlobeFocus,
}) {
  const countryLookup = useMemo(() => createCountryLookup(countryCatalog || []), [countryCatalog]);
  const countryOptions = useMemo(
    () => buildCountrySearchOptions(graph, countryCatalog, countryLookup),
    [graph, countryCatalog, countryLookup],
  );
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const selectedNode = selectedId ? nodeMap.get(selectedId) : null;
  const hoveredNode = hoveredId ? nodeMap.get(hoveredId) : null;
  const activeNode = selectedNode || hoveredNode;
  const related = getRelated(selectedId, graph, nodeMap);
  const visibleTypes = [...new Set(graph.nodes.map((node) => node.type))];
  const years = ['all', ...new Set(graph.links.flatMap((link) => String(link.year || '').match(/20\d{2}/g) || []))].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return Number(a) - Number(b);
  });

  const handleSearch = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = normalizeLookupValue(formData.get('country-search'));
    if (!query) return;

    const directHit = graph.nodes.find(
      (node) => normalizeLookupValue(node.name).includes(query) || normalizeLookupValue(node.id).includes(query),
    );
    if (directHit) {
      onGlobeFocus?.(directHit.id);
      return;
    }

    const country = countryLookup.get(query);
    if (!country) return;

    const countryHit = graph.nodes.find(
      (node) => node.globeCountryId === country.id || findCountryForNode(node, countryLookup)?.id === country.id,
    );

    if (countryHit) onGlobeFocus?.(countryHit.id);
  };

  return (
    <>
      <header className="topbar">
        <div className="title-block">
          <h1>国际关系事件星图</h1>
          <span className="eyebrow">2020-2026 GEOPOLITICAL CONSTELLATION</span>
        </div>
        <button className="focus-button" type="button" onClick={onFocusCore}>
          <Crosshair size={17} />
          {activeLayer === 'globe' ? '回到地球视角' : '聚焦核心事件'}
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

      {activeLayer === 'globe' ? (
        <footer className="globe-controls">
          <form className="globe-search" onSubmit={handleSearch}>
            <Search size={16} />
            <input name="country-search" type="search" placeholder="搜索国家" list="country-options" autoComplete="off" />
            <datalist id="country-options">
              {countryOptions.map((option) => (
                <option key={option.value} value={option.value} label={option.label} />
              ))}
            </datalist>
            <button type="submit">定位</button>
          </form>
          <div className="filter-field">
            <span className="filter-label">年份</span>
            <select
              value={globeFilters?.year || 'all'}
              onChange={(event) => onGlobeFiltersChange((filters) => ({ ...filters, year: event.target.value }))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year === 'all' ? '全部年份' : year}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <span className="filter-label">事件类型</span>
            <select
              value={globeFilters?.type || 'all'}
              onChange={(event) => onGlobeFiltersChange((filters) => ({ ...filters, type: event.target.value }))}
            >
              <option value="all">全部类型</option>
              {globeEventTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-actions">
            <button className="filter-reset" type="button" onClick={() => onGlobeFiltersChange({ year: 'all', type: 'all' })}>
              重置
            </button>
            <button className="filter-reset" type="button" onClick={() => onGlobeFocus(null)}>
              复位国家
            </button>
          </div>
          <div className="legend-spacer" />
          <div className={dataState?.source === 'cloud' ? 'data-state data-state-cloud' : 'data-state'}>
            {dataState?.loading ? '数据加载中' : dataState?.source === 'cloud' ? '云端数据' : '默认数据'}
          </div>
          <div className="hint">
            <Maximize2 size={14} />
            拖拽旋转地球 · 点击国家
          </div>
        </footer>
      ) : (
        <footer className="legend-bar">
          <div className="legend-heading">事件层</div>
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
      )}
    </>
  );
}
