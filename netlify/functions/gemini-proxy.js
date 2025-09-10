// netlify/functions/gemini-proxy.js
exports.handler = async (event) => {
  const baseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: baseHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: "GEMINI_API_KEY is missing" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const {
    prompt,
    model = "gemini-2.5-flash-preview-05-20",
    temperature = 0.5,
    top_p = 0.9,
    max_output_tokens = 2048,
    system,
    response_mime_type = "text/markdown"
  } = body || {};

  if (!prompt || typeof prompt !== "string") {
    return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "Missing prompt" }) };
  }

  const reqBody = {
    contents: [{ parts: [{ text: prompt }]}],
    generationConfig: {
      temperature,
      topP: top_p,
      maxOutputTokens: max_output_tokens,
      responseMimeType: response_mime_type
    }
  };
  if (system && typeof system === "string") {
    reqBody.systemInstruction = { parts: [{ text: system }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${API_KEY}`;

  const MAX_TRIES = 5;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 26000);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: abort.signal
      });
      clearTimeout(timeout);

      const textBody = await resp.text();
      let data; try { data = JSON.parse(textBody); } catch { data = null; }

      if (!resp.ok) {
        const details = (data && (data.error?.message || data.message)) || textBody.slice(0, 700);
        if ((resp.status === 429 || resp.status >= 500) && attempt < MAX_TRIES) {
          await new Promise(r => setTimeout(r, attempt * 900));
          continue;
        }
        return { statusCode: resp.status, headers: baseHeaders, body: JSON.stringify({ error: "Upstream error", details }) };
      }

      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p?.text || "").join("\n").trim();
      if (!text) {
        return { statusCode: 502, headers: baseHeaders, body: JSON.stringify({ error: "Empty/blocked response", raw: data }) };
      }
      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ text }) };
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < MAX_TRIES) {
        await new Promise(r => setTimeout(r, attempt * 900));
        continue;
      }
      return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: String(err && err.message || err) }) };
    }
  }

  return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: "Unknown failure" }) };
};
