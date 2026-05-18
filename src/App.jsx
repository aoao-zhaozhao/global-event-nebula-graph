import { useCallback, useEffect, useMemo, useState } from 'react';
import EventStarMap from './components/EventStarMap.jsx';
import Hud from './components/Hud.jsx';
import { defaultGraphData } from './data/defaultGraph.js';
import { loadGraphData } from './services/graphData.js';
import { createGraphLayers } from './utils/graphLayers.js';

export default function App() {
  const [graphData, setGraphData] = useState(defaultGraphData);
  const [dataState, setDataState] = useState({ loading: true, source: 'default', error: null });
  const [activeLayer, setActiveLayer] = useState('actors');
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [nodeSizeMultiplier, setNodeSizeMultiplier] = useState(1);
  const [focusCoreToken, setFocusCoreToken] = useState(0);
  const graphLayers = useMemo(() => createGraphLayers(graphData), [graphData]);
  const graph = useMemo(() => graphLayers[activeLayer], [graphLayers, activeLayer]);

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

  const handleLayerChange = useCallback((layerId) => {
    setActiveLayer(layerId);
    setHoveredId(null);
    setSelectedId(null);
    setFocusCoreToken((value) => value + 1);
  }, []);

  const handleFocusCore = useCallback(() => {
    setSelectedId(null);
    setFocusCoreToken((value) => value + 1);
  }, []);

  return (
    <main className="app-shell">
      <div className="canvas-layer">
        <EventStarMap
          graph={graph}
          nodeSizeMultiplier={nodeSizeMultiplier}
          hoveredId={hoveredId}
          selectedId={selectedId}
          focusCoreToken={focusCoreToken}
          onHoverNode={setHoveredId}
          onSelectNode={handleSelectNode}
        />
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
      />
    </main>
  );
}
