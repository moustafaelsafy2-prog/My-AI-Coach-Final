exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "";

    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) })
    };
  }
};
