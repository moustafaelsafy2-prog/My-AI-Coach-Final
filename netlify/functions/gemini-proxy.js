// netlify/functions/gemini-proxy.js
// Secure proxy for Google AI API with enforced long outputs

const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  console.log("⚡ Gemini Proxy invoked");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // Handle preflight (CORS)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    // 🔑 Get API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("❌ Missing GEMINI_API_KEY in Netlify environment variables.");
    }

    // 📩 Parse request body
    const body = JSON.parse(event.body || "{}");
    const userPrompt = body.prompt;
    if (!userPrompt) throw new Error("❌ No prompt provided in body.");

    // 🧩 Payload with enforced strong generation config
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 8192,  // 💡 Enough for very long structured plans
        temperature: 0.7,
        topP: 0.95,
        candidateCount: 1
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    // 🌐 Google AI endpoint
    const api_url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    console.log("➡ Sending request to Google AI");
    const response = await fetch(api_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ Google AI API Error:", errorBody);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: errorBody })
      };
    }

    const data = await response.json();
    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠ لم يتم استلام أي محتوى من الذكاء الاصطناعي.";

    console.log("✅ Success: Response received from Google AI");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: generatedText })
    };
  } catch (error) {
    console.error("🔥 FATAL in proxy:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
