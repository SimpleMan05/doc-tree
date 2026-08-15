import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { customAlphabet } from "nanoid";
import { supabase } from "./lib/supabase.js";
import { bumpCounters, getStats, cacheLeaf, getCachedLeaves, rehydrateLeavesCache } from "./lib/redis.js";
import { classifyTheme, themeToColor } from "./lib/groq.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "*").split(","),
  })
);

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6); // no ambiguous chars

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "freedom-tree")).digest("hex");
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

// Golden-angle spiral placement inside a canopy volume — gives natural,
// non-overlapping-looking clustering as leaf count grows.
function computePosition(index) {
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const canopyRadius = 4.5 + Math.log(index + 2) * 0.4; // canopy grows slightly as tree fills
  const y = 3.5 + ((index % 40) / 40) * 3.5; // layered height bands
  const r = canopyRadius * Math.sqrt((index % 500) / 500);
  const theta = index * GOLDEN_ANGLE;
  return {
    x: r * Math.cos(theta),
    y,
    z: r * Math.sin(theta),
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Submit a new leaf
app.post("/api/submit-leaf", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > 100) {
      return res.status(400).json({ error: "Keep it under 100 words." });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    // App-level rate limit check (DB trigger is the hard backstop)
    const { data: existing } = await supabase
      .from("leaves")
      .select("id")
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(429).json({ error: "One leaf per device per day. Yours is already growing 🌳" });
    }

    const theme = await classifyTheme(text.trim());
    const color = themeToColor(theme);

    const { count } = await supabase.from("leaves").select("*", { count: "exact", head: true });
    const position = computePosition(count || 0);
    const id = nanoid();

    const { error: insertError } = await supabase.from("leaves").insert({
      id,
      text: text.trim(),
      theme,
      color,
      position_x: position.x,
      position_y: position.y,
      position_z: position.z,
      ip_hash: ipHash,
    });

    if (insertError) {
      if (insertError.message?.includes("RATE_LIMIT")) {
        return res.status(429).json({ error: "One leaf per device per day. Yours is already growing 🌳" });
      }
      throw insertError;
    }

    const { themeCount, totalCount } = await bumpCounters(theme);

    // Append to the Redis read-cache so /api/leaves reflects this leaf
    // immediately for every other connected client without hitting Postgres.
    await cacheLeaf({ id, theme, color, position: [position.x, position.y, position.z] });

    res.json({
      id,
      theme,
      color,
      position,
      message: `Your leaf has taken root. 🌳 You're one of ${themeCount} who felt ${theme} today.`,
      totalLeaves: totalCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Try again." });
  }
});

// All leaves — used to render the tree. Reads Redis, NOT Postgres, on the
// hot path — this route gets polled by every connected client every 15s,
// so it must stay off the DB as leaf count grows.
app.get("/api/leaves", async (_req, res) => {
  try {
    let leaves = await getCachedLeaves();

    if (leaves === null) {
      // Cache empty (cold start / eviction) — rehydrate once from Supabase,
      // then serve from Redis on every subsequent request.
      await rehydrateLeavesCache(fetchAllLeavesFromDb);
      leaves = (await getCachedLeaves()) || [];
    }

    res.json(leaves);
  } catch (err) {
    console.error("Failed to serve leaves from cache:", err);
    res.status(500).json({ error: "Failed to load tree." });
  }
});

// Only called on cold start / cache miss — never on the regular poll path.
async function fetchAllLeavesFromDb() {
  const { data, error } = await supabase
    .from("leaves")
    .select("id, theme, color, position_x, position_y, position_z, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data.map((l) => ({
    id: l.id,
    theme: l.theme,
    color: l.color,
    position: [l.position_x, l.position_y, l.position_z],
  }));
}

// Locate one leaf by ID — used by the search-fly camera
app.get("/api/leaf/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("leaves")
    .select("id, text, theme, color, position_x, position_y, position_z, created_at")
    .eq("id", req.params.id.toUpperCase())
    .single();

  if (error || !data) return res.status(404).json({ error: "Leaf not found. Check the ID." });

  res.json({
    id: data.id,
    text: data.text,
    theme: data.theme,
    color: data.color,
    position: [data.position_x, data.position_y, data.position_z],
    createdAt: data.created_at,
  });
});

// Live theme/total counters — powers the stats bar
app.get("/api/stats", async (_req, res) => {
  const stats = await getStats();
  res.json(stats);
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, async () => {
  console.log(`Freedom Tree server running on :${PORT}`);
  try {
    await rehydrateLeavesCache(fetchAllLeavesFromDb);
  } catch (err) {
    console.error("Startup cache warm-up failed (will retry on first request):", err);
  }
});

// add deleted = false to both existing Supabase .select() queries:
// fetchAllLeavesFromDb() and GET /api/leaf/:id.eq("deleted", false)

// new route
app.delete("/api/leaf/:id", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const id = req.params.id.toUpperCase();

    const { data: leaf } = await supabase
      .from("leaves")
      .select("id, theme, ip_hash, deleted")
      .eq("id", id)
      .single();

    if (!leaf || leaf.deleted) return res.status(404).json({ error: "Leaf not found." });
    if (leaf.ip_hash !== ipHash) return res.status(403).json({ error: "You can only delete your own leaf." });

    await supabase.from("leaves").update({ deleted: true, text: "[deleted]" }).eq("id", id);
    await decrementCounters(leaf.theme);
    await removeLeafFromCache(id);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete." });
  }
});
