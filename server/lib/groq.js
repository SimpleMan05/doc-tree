import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const THEMES = ["sacrifice", "hope", "unity", "dreams", "gratitude", "courage"];

// Zero-latency fallback if Groq times out or errors — a submission should
// never fail just because the classification call hiccuped.
const KEYWORD_MAP = {
  sacrifice: ["sacrifice", "martyr", "died", "gave up", "lost", "struggle"],
  courage: ["courage", "brave", "fight", "stand up", "fearless", "protest"],
  unity: ["together", "unity", "united", "one nation", "diversity", "brotherhood"],
  hope: ["hope", "future", "better", "change", "believe"],
  dreams: ["dream", "aspire", "ambition", "want to become", "wish"],
  gratitude: ["grateful", "thank", "blessed", "fortunate", "appreciate"],
};

function keywordFallback(text) {
  const lower = text.toLowerCase();
  for (const [theme, words] of Object.entries(KEYWORD_MAP)) {
    if (words.some((w) => lower.includes(w))) return theme;
  }
  // default bucket if nothing matches
  return "hope";
}

export async function classifyTheme(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `Classify this "what freedom means to me" response into exactly ONE of these themes: sacrifice, hope, unity, dreams, gratitude, courage.
Respond with ONLY the single theme word, lowercase, nothing else.

Response: "${text}"`,
        },
      ],
      max_tokens: 5,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim().toLowerCase();
    if (THEMES.includes(raw)) return raw;
    return keywordFallback(text);
  } catch (err) {
    console.error("Groq classification failed, using fallback:", err.message);
    return keywordFallback(text);
  }
}

export function themeToColor(theme) {
  if (["sacrifice", "courage"].includes(theme)) return "saffron";
  if (["unity", "hope"].includes(theme)) return "white";
  return "green"; // dreams, gratitude
}
