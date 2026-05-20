import { useCallback, useEffect, useMemo, useState } from 'react';
import EventStarMap from './components/EventStarMap.jsx';
import GlobeMap from './components/GlobeMap.jsx';
import Hud from './components/Hud.jsx';
import { defaultGraphData } from './data/defaultGraph.js';
import { loadGraphData } from './services/graphData.js';
import { createGraphLayers } from './utils/graphLayers.js';
import { createGlobeGraph } from './utils/globeData.js';

export default function App() {
  const [graphData, setGraphData] = useState(defaultGraphData);
  const [dataState, setDataState] = useState({ loading: true, source: 'default', error: null });
  const [activeLayer, setActiveLayer] = useState('globe');
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [nodeSizeMultiplier, setNodeSizeMultiplier] = useState(1);
  const [focusCoreToken, setFocusCoreToken] = useState(0);
  const [globeFilters, setGlobeFilters] = useState({ year: 'all', type: 'all' });
  const [globeFocusId, setGlobeFocusId] = useState(null);
  const graphLayers = useMemo(() => createGraphLayers(graphData), [graphData]);
  const globeGraph = useMemo(() => createGlobeGraph(graphData, globeFilters), [graphData, globeFilters]);
  const graph = useMemo(() => (activeLayer === 'events' ? graphLayers.events : globeGraph), [activeLayer, globeGraph, graphLayers]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const result = await loadGraphData();
      if (cancelled) return;
      setGraphData(result.data);
      setDataState({ loading: false, source: result.source, error: result.error });
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectNode = useCallback((nodeId) => {
    setSelectedId(nodeId);
  }, []);

  const handleGlobeFocus = useCallback((nodeId) => {
    setHoveredId(null);
    setSelectedId(null);
    setGlobeFocusId(nodeId || null);
  }, []);

  const handleLayerChange = useCallback((layerId) => {
    setActiveLayer(layerId);
    setHoveredId(null);
    setSelectedId(null);
    setGlobeFocusId(null);
    setFocusCoreToken((value) => value + 1);
  }, []);

  const handleFocusCore = useCallback(() => {
    setSelectedId(null);
    setFocusCoreToken((value) => value + 1);
  }, []);

  return (
    <main className="app-shell">
        <div className="canvas-layer">
        {activeLayer === 'globe' ? (
          <GlobeMap
            data={graphData}
            filters={globeFilters}
              hoveredId={hoveredId}
              selectedId={selectedId}
              focusId={globeFocusId}
              onHoverNode={setHoveredId}
              onSelectNode={handleSelectNode}
          />
        ) : (
          <EventStarMap
            graph={graph}
            nodeSizeMultiplier={nodeSizeMultiplier}
            hoveredId={hoveredId}
            selectedId={selectedId}
            focusCoreToken={focusCoreToken}
            onHoverNode={setHoveredId}
            onSelectNode={handleSelectNode}
          />
        )}
      </div>
      <div className="scanline" />
      <Hud
        graph={graph}
        dataState={dataState}
        activeLayer={activeLayer}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onClose={() => setSelectedId(null)}
        onFocusCore={handleFocusCore}
        onLayerChange={handleLayerChange}
        onSelectNode={handleSelectNode}
        nodeSizeMultiplier={nodeSizeMultiplier}
        onNodeSizeChange={setNodeSizeMultiplier}
        globeFilters={globeFilters}
        onGlobeFiltersChange={setGlobeFilters}
        onGlobeFocus={handleGlobeFocus}
      />
    </main>
  );
}
