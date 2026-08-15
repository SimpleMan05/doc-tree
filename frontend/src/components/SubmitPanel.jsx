import React, { useState } from "react";
import { submitLeaf } from "../lib/api";

const HAS_SUBMITTED_KEY = "freedom-tree-submitted";

export default function SubmitPanel({ onSuccess }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [deleted, setDeleted] = useState(false);

  const alreadySubmitted = localStorage.getItem(HAS_SUBMITTED_KEY);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  if (alreadySubmitted && !result) {
    const saved = JSON.parse(alreadySubmitted);
    return (
      <div className="panel">
        <p className="panel-title">Your leaf is already growing 🌳</p>
        <p className="panel-sub">
          Leaf ID: <span className="leaf-id">{saved.id}</span>
        </p>
        <p className="panel-hint">Search it above to find it on the tree.</p>
        {!deleted ? (
          <button className="delete-link" onClick={() => handleDelete(saved.id)}>Delete my leaf</button>
        ) : (
          <p className="panel-hint">Your leaf has been removed from the tree.</p>
        )}
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || wordCount > 100) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitLeaf(text.trim());
      localStorage.setItem(HAS_SUBMITTED_KEY, JSON.stringify({ id: data.id }));
      setResult(data);
      onSuccess?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  async function handleDelete(id) {
    if (!confirm("Delete your leaf? This can't be undone, and you won't get another chance to add one today.")) return;
    try {
      await deleteLeaf(id);
      setDeleted(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (result) {
    return (
      <div className="panel">
        <p className="panel-title">Your leaf has taken root 🌳</p>
        <p className="panel-sub">
          Leaf ID: <span className="leaf-id">{result.id}</span>
        </p>
        <p className="panel-hint">{result.message}</p>
        {!deleted ? (
          <button className="delete-link" onClick={() => handleDelete(saved.id)}>Delete my leaf</button>
        ) : (
          <p className="panel-hint">Your leaf has been removed from the tree.</p>
        )}
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <p className="panel-title">What does freedom mean to you?</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="In your own words... (max 100 words)"
        rows={4}
        maxLength={800}
      />
      <div className="panel-row">
        <span className={wordCount > 100 ? "word-count over" : "word-count"}>
          {wordCount}/100 words
        </span>
        <button type="submit" disabled={loading || !text.trim() || wordCount > 100}>
          {loading ? "Planting..." : "Add your leaf"}
        </button>
      </div>
      {error && <p className="panel-error">{error}</p>}
    </form>
  );
}
