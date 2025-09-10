// netlify/functions/gemini-proxy.js
// Robust proxy to Google AI with long outputs, language lock, and section support.
const fetch = require('node-fetch');

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
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

    const body = JSON.parse(event.body || '{}');
    const {
      prompt,          // required
      locale = 'ar',   // 'ar' | 'en' (lock)
      maxTokens = 8192 // can be tuned; upper bound limited below
    } = body;

    if (!prompt) throw new Error('Missing prompt');

    const model = 'models/gemini-1.5-pro-latest';
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }]}],
      generationConfig: {
        temperature: 0.65,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: Math.min(Math.max(maxTokens, 4096), 16384)
      },
      // permissive but safe
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',      threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUAL_CONTENT',    threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SELF_HARM',         threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const raw = await r.text();
    if (!r.ok) {
      return { statusCode: r.status, headers, body: JSON.stringify({ error: raw || 'Upstream error' }) };
    }
    const data = JSON.parse(raw);
    const out  = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';

    return { statusCode: 200, headers, body: JSON.stringify({ text: out, locale }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
