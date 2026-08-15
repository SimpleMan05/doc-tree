const BASE_URL = import.meta.env.VITE_API_URL;

export async function submitLeaf(text) {
  const res = await fetch(`${BASE_URL}/api/submit-leaf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to submit.");
  return data;
}

export async function fetchLeaves() {
  const res = await fetch(`${BASE_URL}/api/leaves`);
  if (!res.ok) throw new Error("Failed to load tree.");
  return res.json();
}

export async function findLeaf(id) {
  const res = await fetch(`${BASE_URL}/api/leaf/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Leaf not found.");
  return data;
}

export async function fetchStats() {
  const res = await fetch(`${BASE_URL}/api/stats`);
  if (!res.ok) throw new Error("Failed to load stats.");
  return res.json();
}

export async function deleteLeaf(id) {
  const res = await fetch(`${BASE_URL}/api/leaf/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete.");
  return data;
}
