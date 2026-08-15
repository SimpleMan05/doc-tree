import React, { useEffect, useState } from "react";
import { fetchStats } from "../lib/api";

const THEME_COLORS = {
  sacrifice: "#FF9933",
  courage: "#FF9933",
  unity: "#F5F5F0",
  hope: "#F5F5F0",
  dreams: "#138808",
  gratitude: "#138808",
};

export default function StatsBar() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await fetchStats();
        if (mounted) setStats(data);
      } catch {
        /* silent — stats are decorative */
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!stats || !stats.total) return null;

  return (
    <div className="stats-bar">
      <span className="stats-total">{stats.total.toLocaleString()} leaves have grown today</span>
      <div className="stats-segments">
        {Object.entries(stats.byTheme).map(([theme, count]) => {
          const pct = stats.total ? (count / stats.total) * 100 : 0;
          return (
            <div
              key={theme}
              title={`${theme}: ${count}`}
              style={{
                width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                background: THEME_COLORS[theme],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
