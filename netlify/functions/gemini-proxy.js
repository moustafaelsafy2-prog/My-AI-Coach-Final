// Netlify Function: Secure proxy to Google AI API (uses built-in fetch on Node 18+)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'GEMINI_API_KEY is not set in Netlify.' })
      };
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }
    const userPrompt = body.prompt;
    if (!userPrompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing "prompt"' }) };
    }

    // Call Google API
    const payload = { contents: [{ parts: [{ text: userPrompt }] }] };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: text || JSON.stringify({ error: 'Upstream error' }) };
    }

    const data = JSON.parse(text);
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: generatedText })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
