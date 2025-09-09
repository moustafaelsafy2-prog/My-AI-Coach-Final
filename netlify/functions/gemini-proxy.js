// This is a Netlify serverless function.
// It acts as a secure proxy to the Google AI API.
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // First line of defense: Log that the function has been invoked.
  console.log("Function invoked!");

  const headers = {
    'Access-Control-Allow-Origin': '*', // Allows your website to call this function
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle browser's pre-flight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    console.log("Handling OPTIONS request.");
    return { statusCode: 204, headers, body: '' };
  }
  
  console.log(`Received a ${event.httpMethod} request.`);

  // We only accept POST requests
  if (event.httpMethod !== 'POST') {
    console.error("Error: Request method was not POST.");
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    console.log("Attempting to get API key from environment variables...");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("CRITICAL ERROR: GEMINI_API_KEY is not set in Netlify!");
      throw new Error("GEMINI_API_KEY is not set in Netlify environment variables.");
    }
    console.log("API Key successfully retrieved.");

    console.log("Parsing request body to find the prompt...");
    const body = JSON.parse(event.body);
    const userPrompt = body.prompt;
    if (!userPrompt) {
      console.error("CRITICAL ERROR: No prompt found in the request body.");
      throw new Error("No prompt provided in the request body.");
    }
    console.log("Prompt successfully retrieved.");

    const payload = { contents: [{ parts: [{ text: userPrompt }] }] };
    const api_url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    console.log("Sending request to Google AI API...");
    const response = await fetch(api_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`Google AI API responded with status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google AI API Error Body:', errorBody);
      throw new Error(`Google AI API failed. Status: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log("Successfully received and parsed response from Google AI.");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: generatedText })
    };

  } catch (error) {
    // This will catch any error from the try block and log it clearly.
    console.error('FATAL ERROR in proxy function execution:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

