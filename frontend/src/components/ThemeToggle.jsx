import React from "react";

export default function ThemeToggle({ dark, setDark }) {
  return (
    <button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
