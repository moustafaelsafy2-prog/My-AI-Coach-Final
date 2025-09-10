// netlify/functions/gemini-proxy.js
// CommonJS – Netlify Node 18+, no extra deps.

const MODEL = process.env.LLM_MODEL || "gemini-1.5-pro";
const API_KEY = process.env.LLM_API_KEY;
const API_URL =
  process.env.LLM_API_URL || "https://generativelanguage.googleapis.com/v1beta/models";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractText(data) {
  try {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p?.text || "").join("\n");
  } catch {
    return "";
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  try {
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing env: LLM_API_KEY" }),
      };
    }

    const { prompt } = JSON.parse(event.body || "{}");
    const url = `${API_URL}/${MODEL}:generateContent?key=${API_KEY}`;

    const generationConfig = {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 1800,
      candidateCount: 1,
    };

    let lastErr = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: String(prompt || "") }]}],
            generationConfig,
            safetySettings: [],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const raw = await res.text();
        let data = {};
        try { data = JSON.parse(raw); } catch {}

        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            lastErr = new Error(`Upstream ${res.status}: ${raw}`);
            await sleep(700 * (2 ** attempt));
            continue;
          }
          return {
            statusCode: res.status,
            headers: { ...CORS, "content-type": "application/json" },
            body: JSON.stringify({ error: raw }),
          };
        }

        const text = typeof data === "string" ? data : extractText(data);
        return {
          statusCode: 200,
          headers: { ...CORS, "content-type": "application/json" },
          body: JSON.stringify({ text }),
        };
      } catch (err) {
        lastErr = err;
        await sleep(700 * (2 ** attempt));
      }
    }

    return {
      statusCode: 504,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({ error: String(lastErr || "Upstream Timeout") }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
