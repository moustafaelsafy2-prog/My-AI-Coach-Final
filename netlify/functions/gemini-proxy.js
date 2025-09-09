// Netlify Function: Gemini Proxy
export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key missing" }) };
    }

    const body = JSON.parse(event.body || '{}');
    const userPrompt = body.prompt;
    if (!userPrompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No prompt provided" }) };
    }

    const payload = { contents: [{ parts: [{ text: userPrompt }] }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers, body: JSON.stringify(data) };
    }

    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { statusCode: 200, headers, body: JSON.stringify({ text: generatedText }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
