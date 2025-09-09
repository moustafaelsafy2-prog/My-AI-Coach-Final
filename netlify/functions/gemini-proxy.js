// Netlify Function: Google AI Proxy with diagnostics (Node 18+ has global fetch)

const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function json(headers, code, obj) {
  return { statusCode: code, headers, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // Method guard
  if (event.httpMethod !== 'POST') return json(headers, 405, { error: 'Method Not Allowed' });

  // Parse body
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(headers, 400, { error: 'Invalid JSON body' });
  }

  // Ping path (diagnostic)
  if (body?.ping === true) {
    return json(headers, 200, { ok: true, pong: true, model: MODEL, env: !!process.env.GEMINI_API_KEY });
  }

  // API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(headers, 500, { error: 'Missing GEMINI_API_KEY in Netlify env.' });
  }

  // Prompt
  const userPrompt = (body.prompt || '').toString();
  if (!userPrompt) return json(headers, 400, { error: 'Missing "prompt" in body' });

  // Google endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: userPrompt }] }] };

  // Timeout to avoid hanging
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000); // 20s

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(t);

    const text = await resp.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch {}

    // Log upstream in Netlify function logs
    console.log('[GOOGLE_RESP]', resp.status, text?.slice(0, 500));

    if (!resp.ok) {
      const upstream =
        parsed?.error?.message ||
        parsed?.error?.status ||
        parsed?.candidates?.[0]?.content?.parts?.[0]?.text ||
        (text || '').slice(0, 500) ||
        'Upstream error';
      return json(headers, resp.status, {
        error: 'Upstream Google error',
        status: resp.status,
        model: MODEL,
        upstream
      });
    }

    const data = parsed || {};
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return json(headers, 200, { text: generatedText });

  } catch (e) {
    clearTimeout(t);
    const err = (e && e.name === 'AbortError') ? 'Request timed out' : (e?.message || String(e));
    console.error('[FUNCTION_ERROR]', err);
    return json(headers, 500, { error: err, model: MODEL });
  }
};
