import React, { useEffect, useState, useCallback } from "react";
import Tree from "./components/Tree.jsx";
import SubmitPanel from "./components/SubmitPanel.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import StatsBar from "./components/StatsBar.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { fetchLeaves } from "./lib/api";

export default function App() {
  const [leaves, setLeaves] = useState([]);
  const [highlightLeaf, setHighlightLeaf] = useState(null);
  const [dark, setDark] = useState(true);

  const loadLeaves = useCallback(async () => {
    try {
      const data = await fetchLeaves();
      setLeaves(data);
    } catch {
      /* tree still renders empty on failure */
    }
  }, []);

  useEffect(() => {
    loadLeaves();
    const interval = setInterval(loadLeaves, 15000);
    return () => clearInterval(interval);
  }, [loadLeaves]);

  function handleNewLeaf(data) {
    setLeaves((prev) => [...prev, { id: data.id, theme: data.theme, color: data.color, position: [data.position.x, data.position.y, data.position.z] }]);
  }

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>
      <div className="layout">
        <header className="app-header">
          <h1>The Freedom Tree</h1>
          <p>What does freedom mean to you? Add a leaf. Watch India grow one.</p>
          <ThemeToggle dark={dark} setDark={setDark} />
        </header>

        <div className="tree-panel">
          <Tree leaves={leaves} highlightLeaf={highlightLeaf} dark={dark} />
        </div>

        <div className="form-section">
          <SubmitPanel onSuccess={handleNewLeaf} />

          {highlightLeaf && (
            <div className="leaf-card">
              <p className="leaf-card-id">#{highlightLeaf.id}</p>
              <p className="leaf-card-text">"{highlightLeaf.text}"</p>
              <button onClick={() => setHighlightLeaf(null)}>Back to the tree</button>
            </div>
          )}

          <SearchPanel onFound={setHighlightLeaf} />
          <StatsBar />
        </div>
      </div>
    </div>
  );
}
