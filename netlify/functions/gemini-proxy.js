// Netlify Function: Secure proxy to Google AI API (Node 18+ has global fetch)
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'; // stable default

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing GEMINI_API_KEY in Netlify env.' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

    const prompt = body.prompt?.toString() || '';
    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing "prompt" in body' }) };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await resp.text();

    // Try to parse JSON for better diagnostics
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch {}

    if (!resp.ok) {
      // Normalize upstream error message
      const upstream =
        parsed?.error?.message ||
        parsed?.error?.status ||
        parsed?.candidates?.[0]?.content?.parts?.[0]?.text ||
        text || 'Upstream error';
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({ error: upstream })
      };
    }

    const data = parsed || {};
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { statusCode: 200, headers, body: JSON.stringify({ text: generatedText }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e && e.message ? e.message : e) }) };
  }
};
