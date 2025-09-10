// netlify/functions/gemini-proxy.js
// Proxy to Google Generative AI API (Gemini)
// يعمل بدون أي مكتبات إضافية مثل node-fetch

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // ✅ رد سريع على CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // ✅ السماح فقط بالـ POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    // ✅ التأكد من وجود مفتاح الـ API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "GEMINI_API_KEY is missing" })
      };
    }

    // ✅ قراءة البيانات من الطلب
    const body = JSON.parse(event.body || "{}");
    const userPrompt = body.prompt;
    if (!userPrompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing prompt" })
      };
    }

    // ✅ إعداد الحمولة
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }]
    };

    // ✅ استدعاء API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      return {
        statusCode: resp.status,
        headers,
        body: JSON.stringify({
          error: "Upstream error",
          details: errorBody.slice(0, 500)
        })
      };
    }

    const data = await resp.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(e) })
    };
  }
};
