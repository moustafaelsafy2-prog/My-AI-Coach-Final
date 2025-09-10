// netlify/functions/gemini-proxy.js
// Robust Gemini proxy — LONG outputs by default (8192 tokens) for ALL sections.

exports.handler = async (event) => {
  const baseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: baseHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: "GEMINI_API_KEY is missing" }) };
    }

    let payloadIn = {};
    try { payloadIn = JSON.parse(event.body || "{}"); } catch {}

    const {
      prompt,
      model = "gemini-2.5-flash-preview-05-20",
      // ✅ افتراضات طويلة لكل الأقسام
      temperature = 0.35,
      top_p = 0.9,
      max_output_tokens = 8192,          // << طول كبير افتراضيًا
      response_mime_type = "text/markdown",
      // optional hint from client; ignored in server logic (we always go long)
      section = ""
    } = payloadIn || {};

    if (!prompt || typeof prompt !== "string") {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

    const reqBody = {
      contents: [{ parts: [{ text: prompt }]}],
      generationConfig: {
        temperature,
        topP: top_p,
        maxOutputTokens: max_output_tokens, // نُبقيها عالية للجميع
        responseMimeType: response_mime_type,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT",         threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUAL_CONTENT",     threshold: "BLOCK_NONE" },
      ],
    };

    // Hard timeout to avoid hangs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let resp;
    try {
      resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const textResp = await resp.text();
    let data; try { data = JSON.parse(textResp); } catch { data = null; }

    if (!resp.ok) {
      const details = (data?.error?.message || data?.message) || textResp.slice(0, 1000);
      return { statusCode: resp.status, headers: baseHeaders, body: JSON.stringify({ error: "Upstream error", details }) };
    }

    // merge all parts into one string
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p?.text || "")
      .join("\n")
      .trim();

    return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ text }) };
  } catch (err) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: String(err) }) };
  }
};
