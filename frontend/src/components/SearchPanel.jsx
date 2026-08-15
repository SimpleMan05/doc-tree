import React, { useState } from "react";
import { findLeaf } from "../lib/api";

export default function SearchPanel({ onFound }) {
  const [id, setId] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const leaf = await findLeaf(id.trim());
      onFound(leaf);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="search-bar" onSubmit={handleSearch}>
      <input
        value={id}
        onChange={(e) => setId(e.target.value.toUpperCase())}
        placeholder="Find your leaf (ID)"
        maxLength={8}
      />
      <button type="submit" disabled={loading}>
        {loading ? "..." : "Find"}
      </button>
      {error && <span className="search-error">{error}</span>}
    </form>
  );
}
